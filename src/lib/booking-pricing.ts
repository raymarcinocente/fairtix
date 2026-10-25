import { ApiError, type Database } from "./mock-account-server";
import { legacySeatId, sectionSeats, type SeatTicket } from "./seating-data";

// Server-side booking validation and pricing shared by the demo checkout and
// the live Paiflow checkout, so both always charge the same server price.
export function priceBooking(db: Database, body: Record<string, unknown>) {
  const event = db.events.find((e) => e.eventId === body.eventId);
  const venue = db.venues.find((v) => v.id === event?.venueId);
  if (!event || !venue) throw new ApiError("Event not found.");
  if (
    typeof body.holdExpiresAt !== "number" ||
    body.holdExpiresAt <= Date.now() ||
    body.holdExpiresAt > Date.now() + 301000
  )
    throw new ApiError("Your reservation expired. Select your tickets again.");
  const seats = body.seats;
  const reservation = db.holds.find(
    (h) =>
      h.session === body.holdSession &&
      h.eventId === body.eventId &&
      h.expires > Date.now(),
  );
  if (
    !reservation ||
    !Array.isArray(seats) ||
    seats.some((s: string) => !reservation.seats.includes(s))
  )
    throw new ApiError("Your reservation expired. Select your tickets again.");
  if (
    !Array.isArray(seats) ||
    !seats.length ||
    seats.length > 6 ||
    new Set(seats).size !== seats.length
  )
    throw new ApiError("Select between 1 and 6 tickets.");
  const lines: SeatTicket[] = seats.map((id: unknown) => {
    if (typeof id !== "string") throw new ApiError("Invalid seat.");
    const section = venue.sections.find((s) =>
      sectionSeats(s).some((seat) => seat.id === id),
    );
    const seat = section && sectionSeats(section).find((s) => s.id === id);
    const category = venue.categories.find((c) => c.id === section?.categoryId);
    if (!seat || !section || !category || event.overrides[id] === "blocked")
      throw new ApiError("This seat is unavailable.");
    if (
      db.bookings.some(
        (b) =>
          b.eventId === event.eventId &&
          b.seats.some((s) => legacySeatId(s) === id),
      )
    )
      throw new ApiError(
        "One of these seats was booked. Select your tickets again.",
        409,
      );
    return {
      ...seat,
      sectionName: section.name,
      categoryId: category.id,
      categoryName: category.name,
      color: category.color,
      price: event.prices[category.id],
    };
  });
  if (!event.allowMixed && new Set(lines.map((l) => l.categoryId)).size > 1)
    throw new ApiError("Choose one ticket category per booking.");
  const subtotal =
    Math.round(lines.reduce((sum, l) => sum + l.price, 0) * 100) / 100;
  const fee = Math.round(subtotal * 5) / 100;
  if (
    !Number.isFinite(subtotal) ||
    typeof body.total !== "number" ||
    !Number.isFinite(body.total) ||
    Math.abs(body.total - subtotal - fee) > 0.001
  )
    throw new ApiError("Prices changed. Review your order.");
  const total = Math.round((subtotal + fee) * 100) / 100;
  return { event, reservation, lines, subtotal, fee, total };
}

