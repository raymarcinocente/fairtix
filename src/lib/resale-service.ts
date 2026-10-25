import "server-only";
import { randomUUID } from "node:crypto";
import type { Database } from "./mock-account-server";
import { sectionSeats, seededStatus, type SeatTicket } from "./seating-data";
import type { ResaleListing } from "./resale-types";

const examples = [
  ["neon-nights", "vvip"],
  ["golden-hour", "vip"],
  ["wild-hearts", "gold"],
  ["beyond-the-noise", "silver"],
  ["pulse-festival", "ga"],
];
export function seedResale(db: Database) {
  if (db.resaleSeeded) return false;
  const sellerId = "prototype-market-seller";
  if (!db.users.some((u) => u.id === sellerId))
    db.users.push({
      id: sellerId,
      firstName: "Marketplace",
      lastName: "Seller",
      email: "",
      verified: false,
      role: "customer",
      wallet: "ben",
      balance: 10,
    });
  for (const [eventId, categoryId] of examples) {
    const event = db.events.find((e) => e.eventId === eventId),
      venue = db.venues.find((v) => v.id === event?.venueId);
    if (!event || !venue) continue;
    const section = venue.sections.find(
      (s) =>
        s.categoryId === categoryId &&
        Number.isFinite(event.prices[categoryId]),
    );
    const category = venue.categories.find((c) => c.id === categoryId);
    if (!section || !category) continue;
    const seats = sectionSeats(section);
    const candidates = [
      ...seats.filter((s) => s.row === "B" && s.number === 1),
      ...seats,
    ];
    const seat = candidates.find(
      (s) =>
        seededStatus(eventId, s) === "available" &&
        event.overrides[s.id] !== "blocked" &&
        !db.bookings.some(
          (b) => b.eventId === eventId && b.seats.includes(s.id),
        ) &&
        !db.holds.some(
          (h) =>
            h.eventId === eventId &&
            h.expires > Date.now() &&
            h.seats.includes(s.id),
        ),
    );
    if (!seat) continue;
    const faceValue = event.prices[categoryId],
      price = Math.round(faceValue * 0.95 * 100) / 100;
    const ticket: SeatTicket = {
      ...seat,
      sectionName: section.name,
      categoryId,
      categoryName: category.name,
      color: category.color,
      price: faceValue,
    };
    const bookingId = `DEMO-${randomUUID()}`;
    db.bookings.push({
      id: bookingId,
      eventId,
      wallet: "ben",
      customerId: sellerId,
      category: category.name,
      seats: [seat.id],
      lineItems: [ticket],
      subtotal: faceValue,
      fee: 0,
      total: faceValue,
      status: "demo-confirmed",
      createdAt: new Date().toISOString(),
    });
    db.resaleListings.push({
      id: `resale-${eventId}`,
      bookingId,
      sellerId,
      eventId,
      price,
      faceValue,
      status: "listed",
    });
  }
  db.resaleSeeded = true;
  return true;
}
export function publicResale(
  db: Database,
  visitorId?: string,
): ResaleListing[] {
  return db.resaleListings
    .filter((l) => l.status === "listed")
    .flatMap((l) => {
      const booking = db.bookings.find(
        (b) =>
          b.id === l.bookingId && b.customerId === l.sellerId && !b.entryStatus,
      );
      const ticket = booking?.lineItems?.[0];
      if (!ticket) return [];
      return [
        {
          id: l.id,
          eventId: l.eventId,
          price: l.price,
          faceValue: l.faceValue,
          ticket,
          reservedUntil:
            l.reservedUntil && l.reservedUntil > Date.now()
              ? l.reservedUntil
              : null,
          reservedByMe: l.reservedBy === visitorId,
        },
      ];
    });
}
export function restoreResale(db: Database, visitorId: string) {
  for (const listing of db.resaleListings) {
    if (listing.reservedBy === visitorId) {
      delete listing.reservedBy;
      delete listing.reservedUntil;
    }
    const booking = db.bookings.find(
      (b) => b.id === listing.bookingId && b.customerId === visitorId,
    );
    if (listing.status !== "sold" || !booking) continue;
    booking.customerId = listing.sellerId;
    booking.wallet = "ben";
    delete booking.entryStatus;
    booking.subtotal = listing.faceValue;
    booking.fee = 0;
    booking.total = listing.faceValue;
    if (booking.lineItems)
      booking.lineItems = booking.lineItems.map((t) => ({
        ...t,
        price: listing.faceValue,
      }));
    listing.status = "listed";
    delete listing.reservedBy;
    delete listing.reservedUntil;
  }
}
