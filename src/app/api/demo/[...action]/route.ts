import { NextRequest, connection } from "next/server";
import { randomUUID } from "node:crypto";
import { publicResale, restoreResale } from "@/lib/resale-service";
import {
  ApiError,
  apiUser,
  authAction,
  database,
  persist,
  publicAccount,
  sessionUser,
  prototypeVisitor,
} from "@/lib/mock-account-server";
import {
  sectionSeats,
  legacySeatId,
  seededStatus,
  type SeatTicket,
  type EventSeating,
  type VenueLayout,
} from "@/lib/seating-data";

const headers = { "Cache-Control": "private, no-store" };
type Context = { params: Promise<{ action: string[] }> };
export async function GET(request: NextRequest, context: Context) {
  await connection();
  try {
    const action = (await context.params).action.join("/");
    const db = database();
    const user = await sessionUser(db);
    if (action === "session")
      return Response.json(
        { user: user ? publicAccount(user) : null, adapter: "local-mock" },
        { headers },
      );
    if (action === "inventory")
      return Response.json(
        {
          inventory: db.bookings.map((b) => ({
            eventId: b.eventId,
            seats: b.seats,
          })),
          market: db.tickets
            .filter((t) => t.status === "listed")
            .map((t) => ({
              id: t.id,
              owner: t.customerId === user?.id ? user.wallet : "seller",
              status: t.status,
              price: t.price,
            })),
          soldCount: db.tickets.length,
          resale: publicResale(db, user?.id),
          events: db.events,
          venues: db.venues,
        },
        { headers },
      );
    const account = await apiUser(
      db,
      action === "organizer/bookings" || action === "admin/accounts",
    );
    if (action === "admin/accounts") {
      throw new ApiError(
        "Account management is disabled in this prototype.",
        404,
      );
    }
    if (action !== "records" && action !== "organizer/bookings")
      throw new ApiError("Not found.", 404);
    return Response.json(
      {
        bookings: db.bookings
          .filter((b) => b.customerId === account.id)
          .map(publicRecord),
        tickets: db.tickets
          .filter((t) => t.customerId === account.id)
          .map(publicRecord),
        transactions: db.transactions
          .filter((t) => t.customerId === account.id)
          .map(publicRecord),
        balance: account.balance,
        ownResale: db.resaleListings
          .filter((listing) => listing.sellerId === account.id && listing.status === "listed")
          .map(({ id, bookingId, price }) => ({ id, bookingId, price })),
        history: db.history
          .filter((h) => h.customerId === account.id)
          .map(publicRecord),
      },
      { headers },
    );
  } catch (e) {
    return failure(e);
  }
}
let queue: Promise<unknown> = Promise.resolve();
export async function POST(request: NextRequest, context: Context) {
  const work = queue.then(() => mutate(request, context));
  queue = work.catch(() => {});
  return work;
}
async function mutate(request: NextRequest, context: Context) {
  try {
    // JSON + exact-origin requests prevent cross-site form and fetch mutations.
    if (
      request.headers.get("origin") !== request.nextUrl.origin ||
      !request.headers.get("content-type")?.startsWith("application/json")
    )
      throw new ApiError("This request origin is not allowed.", 403);
    const raw = await request.text();
    if (raw.length > 32000) throw new ApiError("Request is too large.", 413);
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new ApiError("Invalid request.");
    const action = (await context.params).action.join("/");
    const db = database();
    let result: unknown;
    if (action === "prototype") {
      const user = await prototypeVisitor(db);
      persist(db);
      return Response.json(
        { user, adapter: "anonymous-prototype" },
        { headers },
      );
    }
    if (action.startsWith("auth/") && action !== "auth/wallet")
      throw new ApiError(
        "Account authentication is disabled in this prototype.",
        410,
      );
    if (action === "holds/release") {
      if (
        typeof body.session !== "string" ||
        !/^[a-f0-9-]{36}$/i.test(body.session)
      )
        throw new ApiError("Invalid reservation.");
      db.holds = db.holds.filter(
        (h) =>
          h.session !== body.session ||
          (body.eventId && h.eventId !== body.eventId),
      );
      persist(db);
      return Response.json({ ok: true }, { headers });
    }
    if (action === "holds") {
      const event = db.events.find((e) => e.eventId === body.eventId);
      const venue = db.venues.find((v) => v.id === event?.venueId);
      if (
        !event ||
        !venue ||
        typeof body.session !== "string" ||
        !/^[a-f0-9-]{36}$/i.test(body.session) ||
        !Array.isArray(body.seats) ||
        !body.seats.length ||
        body.seats.length > 6 ||
        new Set(body.seats).size !== body.seats.length
      )
        throw new ApiError("Invalid seat reservation.");
      if (typeof body.expires !== "number" || body.expires <= Date.now())
        throw new ApiError(
          "Your reservation expired. Select your tickets again.",
        );
      db.holds = db.holds.filter((h) => h.expires > Date.now());
      for (const id of body.seats) {
        const seat = venue.sections
          .flatMap(sectionSeats)
          .find((s) => s.id === id);
        if (
          !seat ||
          event.overrides[id] === "blocked" ||
          ["sold", "held"].includes(seededStatus(event.eventId, seat)) ||
          (seededStatus(event.eventId, seat) === "blocked" &&
            event.overrides[id] !== "available") ||
          db.bookings.some(
            (b) => b.eventId === event.eventId && b.seats.includes(id),
          ) ||
          db.holds.some(
            (h) =>
              h.eventId === event.eventId &&
              h.session !== body.session &&
              h.seats.includes(id),
          )
        )
          throw new ApiError(
            "These seats are no longer available. Select your tickets again.",
            409,
          );
      }
      const previous = db.holds.find(
        (h) => h.eventId === event.eventId && h.session === body.session,
      );
      const expires = Math.min(
        body.expires,
        Date.now() + 300000,
        previous?.expires || Infinity,
      );
      db.holds = db.holds.filter((h) => h !== previous);
      db.holds.push({
        session: body.session,
        eventId: event.eventId,
        seats: body.seats,
        expires,
      });
      persist(db);
      return Response.json({ expires }, { headers });
    }
    if (action.startsWith("auth/"))
      result = await authAction(action.slice(5), body, db);
    else {
      const user = await apiUser(
        db,
        action.startsWith("organizer/") || action === "scan",
      );
      if (action === "resale/list") {
        const booking = db.bookings.find((b) => b.id === body.bookingId && b.customerId === user.id);
        const ticket = booking?.lineItems?.find((ticket) => ticket.id === body.seatId);
        if (!booking || !ticket) throw new ApiError("Choose a ticket from My Tickets.", 404);
        if (booking.entryStatus) throw new ApiError("Redeemed tickets cannot be resold.");
        if (db.resaleListings.some((l) => l.bookingId === booking.id && l.status === "listed"))
          throw new ApiError("This ticket is already listed.", 409);
        const faceValue = ticket.price;
        const maximum = Math.round(faceValue * 1.1 * 100) / 100;
        if (typeof body.price !== "number" || !Number.isFinite(body.price) || body.price <= 0 || body.price > maximum || Math.abs(body.price * 100 - Math.round(body.price * 100)) > 0.0001)
          throw new ApiError(`Enter a price between 0.01 and ${maximum.toFixed(2)} USDC.`);
        let saleBooking = booking;
        if (booking.seats.length > 1) {
          saleBooking = {
            ...booking, id: `DEMO-${randomUUID()}`, seats: [ticket.id],
            lineItems: [ticket], category: ticket.categoryName,
            subtotal: faceValue, fee: 0, total: faceValue,
          };
          db.bookings.push(saleBooking);
          booking.seats = booking.seats.filter((seat) => seat !== ticket.id);
          booking.lineItems = booking.lineItems!.filter((seat) => seat.id !== ticket.id);
          booking.subtotal = Math.round(booking.lineItems.reduce((sum, seat) => sum + seat.price, 0) * 100) / 100;
          booking.fee = Math.round(booking.subtotal * 5) / 100;
          booking.total = Math.round((booking.subtotal + booking.fee) * 100) / 100;
          booking.category = [...new Set(booking.lineItems.map((seat) => seat.categoryName))].join(", ");
        }
        const listing = {
          id: `resale-${randomUUID()}`, bookingId: saleBooking.id,
          sellerId: user.id, eventId: booking.eventId,
          price: body.price, faceValue, status: "listed" as const,
        };
        db.resaleListings.push(listing);
        result = { id: listing.id };
      } else if (action === "resale/cancel") {
        const listing = db.resaleListings.find((l) => l.id === body.id && l.sellerId === user.id && l.status === "listed");
        if (!listing) throw new ApiError("Listing not found.", 404);
        if (listing.reservedUntil && listing.reservedUntil > Date.now())
          throw new ApiError("A buyer is reviewing this ticket. Try again when their reservation expires.", 409);
        db.resaleListings = db.resaleListings.filter((l) => l !== listing);
        result = { ok: true };
      } else if (
        action === "resale/hold" ||
        action === "resale/release" ||
        action === "resale/buy"
      ) {
        const listing = db.resaleListings.find((l) => l.id === body.id);
        const booking =
          listing && db.bookings.find((b) => b.id === listing.bookingId);
        if (
          !listing ||
          !booking ||
          listing.status !== "listed" ||
          booking.entryStatus ||
          booking.customerId !== listing.sellerId
        )
          throw new ApiError("This resale ticket is no longer available.", 409);
        if (action === "resale/release") {
          if (listing.reservedBy === user.id) {
            delete listing.reservedBy;
            delete listing.reservedUntil;
          }
          result = { ok: true };
        } else if (action === "resale/hold") {
          if (listing.sellerId === user.id)
            throw new ApiError("You cannot buy your own listing. Manage it from My Tickets.");
          if (
            listing.reservedUntil &&
            listing.reservedUntil > Date.now() &&
            listing.reservedBy !== user.id
          )
            throw new ApiError(
              "Another buyer is reviewing this ticket. Please try again later.",
              409,
            );
          const expires =
            listing.reservedBy === user.id &&
            listing.reservedUntil &&
            listing.reservedUntil > Date.now()
              ? listing.reservedUntil
              : Date.now() + 300000;
          listing.reservedBy = user.id;
          listing.reservedUntil = expires;
          result = { expires };
        } else {
          if (listing.sellerId === user.id) throw new ApiError("You cannot buy your own listing.");
          if (!user.wallet) throw new ApiError("Connect a wallet to continue.");
          if (body.paymentMode !== "demo")
            throw new ApiError(
              "Live payment verification is not configured.",
              503,
            );
          if (
            listing.reservedBy !== user.id ||
            !listing.reservedUntil ||
            listing.reservedUntil <= Date.now()
          )
            throw new ApiError(
              "Your reservation expired. Close this ticket and try again.",
              409,
            );
          const fee = Math.round(listing.price * 5) / 100,
            total = Math.round((listing.price + fee) * 100) / 100;
          if (
            typeof body.total !== "number" ||
            !Number.isFinite(body.total) ||
            Math.abs(body.total - total) > 0.001
          )
            throw new ApiError(
              "The order total changed. Review this ticket again.",
            );
          const createdAt = new Date().toISOString();
          booking.customerId = user.id;
          booking.wallet = user.wallet;
          booking.subtotal = listing.price;
          booking.fee = fee;
          booking.total = total;
          booking.createdAt = createdAt;
          booking.lineItems = booking.lineItems?.map((t) => ({
            ...t,
            price: listing.price,
          }));
          listing.status = "sold";
          delete listing.reservedBy;
          delete listing.reservedUntil;
          db.transactions.push(
            {
              id: randomUUID(),
              reference: booking.id,
              eventId: booking.eventId,
              customerId: user.id,
              kind: "resale purchase",
              amount: total,
              currency: "USDC",
              createdAt,
            },
            {
              id: randomUUID(),
              reference: booking.id,
              eventId: booking.eventId,
              customerId: listing.sellerId,
              kind: "resale sale",
              amount: listing.price,
              currency: "USDC",
              createdAt,
            },
          );
          result = { booking: publicRecord(booking) };
        }
      } else if (action === "organizer/config") {
        const event = body.event as EventSeating;
        const venue = body.venue as VenueLayout;
        validateConfig(event, venue);
        if (
          !db.events.some((e) => e.eventId === event.eventId) ||
          !db.venues.some((v) => v.id === venue.id)
        )
          throw new ApiError("Unknown event or venue.");
        const affected = db.events
          .filter((e) => e.venueId === venue.id)
          .map((e) => e.eventId);
        const nextSeats = new Set(
          venue.sections.flatMap(sectionSeats).map((s) => s.id),
        );
        if (
          db.bookings.some(
            (b) =>
              affected.includes(b.eventId) &&
              b.seats.some((s) => !nextSeats.has(legacySeatId(s))),
          ) ||
          db.holds.some(
            (h) =>
              h.expires > Date.now() &&
              affected.includes(h.eventId) &&
              h.seats.some((s) => !nextSeats.has(s)),
          )
        )
          throw new ApiError(
            "This change would remove sold or reserved seats.",
          );
        db.events = db.events.map((e) =>
          e.eventId === event.eventId ? event : e,
        );
        db.venues = db.venues.map((v) => (v.id === venue.id ? venue : v));
        result = { ok: true };
      } else if (action === "organizer/block") {
        const event = db.events.find((e) => e.eventId === body.eventId);
        const venue = db.venues.find((v) => v.id === event?.venueId);
        if (
          !event ||
          !venue ||
          typeof body.seatId !== "string" ||
          typeof body.blocked !== "boolean" ||
          !venue.sections
            .flatMap(sectionSeats)
            .some((s) => s.id === body.seatId)
        )
          throw new ApiError("Invalid seat.");
        if (
          db.bookings.some(
            (b) => b.eventId === event.eventId && b.seats.includes(body.seatId),
          ) ||
          db.holds.some(
            (h) =>
              h.eventId === event.eventId &&
              h.expires > Date.now() &&
              h.seats.includes(body.seatId),
          )
        )
          throw new ApiError("Sold or reserved seats cannot be changed.");
        event.overrides[body.seatId] = body.blocked ? "blocked" : "available";
        result = { ok: true };
      } else if (action === "organizer/authorize")
        result = { authorized: true };
      else if (action === "bookings") {
        if (!user.wallet)
          throw new ApiError("Connect a demo wallet to continue.");
        if (body.paymentMode !== "demo")
          throw new ApiError(
            "Live payment verification is not configured.",
            503,
          );
        const event = db.events.find((e) => e.eventId === body.eventId);
        const venue = db.venues.find((v) => v.id === event?.venueId);
        if (!event || !venue) throw new ApiError("Event not found.");
        if (
          typeof body.holdExpiresAt !== "number" ||
          body.holdExpiresAt <= Date.now() ||
          body.holdExpiresAt > Date.now() + 301000
        )
          throw new ApiError(
            "Your reservation expired. Select your tickets again.",
          );
        const reservation = db.holds.find(
          (h) =>
            h.session === body.holdSession &&
            h.eventId === body.eventId &&
            h.expires > Date.now(),
        );
        if (
          !reservation ||
          !Array.isArray(body.seats) ||
          body.seats.some((s: string) => !reservation.seats.includes(s))
        )
          throw new ApiError(
            "Your reservation expired. Select your tickets again.",
          );
        if (
          !Array.isArray(body.seats) ||
          !body.seats.length ||
          body.seats.length > 6 ||
          new Set(body.seats).size !== body.seats.length
        )
          throw new ApiError("Select between 1 and 6 tickets.");
        const lines: SeatTicket[] = body.seats.map((id: unknown) => {
          if (typeof id !== "string") throw new ApiError("Invalid seat.");
          const section = venue.sections.find((s) =>
            sectionSeats(s).some((seat) => seat.id === id),
          );
          const seat =
            section && sectionSeats(section).find((s) => s.id === id);
          const category = venue.categories.find(
            (c) => c.id === section?.categoryId,
          );
          if (
            !seat ||
            !section ||
            !category ||
            event.overrides[id] === "blocked"
          )
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
        if (
          !event.allowMixed &&
          new Set(lines.map((l) => l.categoryId)).size > 1
        )
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
        const booking = {
          id: `DEMO-${randomUUID()}`,
          eventId: event.eventId,
          wallet: user.wallet,
          category: [...new Set(lines.map((l) => l.categoryName))].join(", "),
          seats: lines.map((l) => l.id),
          lineItems: lines,
          subtotal,
          fee,
          total: Math.round((subtotal + fee) * 100) / 100,
          status: "demo-confirmed" as const,
          createdAt: new Date().toISOString(),
          customerId: user.id,
        };
        db.holds = db.holds.filter((h) => h !== reservation);
        db.bookings.push(booking);
        const receipt = publicRecord(booking);
        db.transactions.push({
          id: randomUUID(),
          customerId: user.id,
          reference: booking.id,
          eventId: booking.eventId,
          kind: "purchase",
          amount: booking.total,
          currency: "USDC",
          createdAt: booking.createdAt,
        });
        result = { booking: receipt };
      } else if (action === "tickets/buy") {
        if (!user.wallet) throw new ApiError("Connect a demo wallet first.");
        if (db.tickets.length >= 50)
          throw new ApiError("This event is sold out.");
        if (user.balance < 1) throw new ApiError("Not enough demo XLM.");
        user.balance -= 1;
        const ticket = {
          id: `FTX-${randomUUID()}`,
          owner: user.wallet,
          status: "valid" as const,
          price: null,
          customerId: user.id,
        };
        db.tickets.push(ticket);
        const receipt = publicRecord(ticket);
        db.transactions.push({
          id: randomUUID(),
          customerId: user.id,
          reference: ticket.id,
          eventId: "event-1",
          kind: "purchase",
          amount: 1,
          currency: "XLM",
          createdAt: new Date().toISOString(),
        });
        result = { ticket: receipt };
      } else if (
        action === "tickets/list" ||
        action === "tickets/cancel" ||
        action === "tickets/transfer"
      ) {
        const ticket = db.tickets.find((t) => t.id === body.id);
        if (!ticket) throw new ApiError("Ticket not found.", 404);
        if (action === "tickets/transfer") {
          if (!user.wallet) throw new ApiError("Connect a demo wallet first.");
          if (ticket.customerId === user.id)
            throw new ApiError("You already own this ticket.");
          if (ticket.status !== "listed" || ticket.price === null)
            throw new ApiError("This listing is no longer available.");
          if (user.balance < ticket.price)
            throw new ApiError("Not enough demo XLM.");
          db.transactions.push(
            {
              id: randomUUID(),
              customerId: user.id,
              reference: ticket.id,
              eventId: "event-1",
              kind: "resale purchase",
              amount: ticket.price,
              currency: "XLM",
              createdAt: new Date().toISOString(),
            },
            {
              id: randomUUID(),
              customerId: ticket.customerId,
              reference: ticket.id,
              eventId: "event-1",
              kind: "resale sale",
              amount: ticket.price,
              currency: "XLM",
              createdAt: new Date().toISOString(),
            },
          );
          user.balance -= ticket.price;
          db.users.find((u) => u.id === ticket.customerId)!.balance +=
            ticket.price;
          ticket.customerId = user.id;
          ticket.owner = user.wallet;
          ticket.status = "valid";
          ticket.price = null;
        } else {
          if (ticket.customerId !== user.id)
            throw new ApiError("Only the owner can change this ticket.", 403);
          if (action === "tickets/list") {
            if (ticket.status !== "valid")
              throw new ApiError("Only valid tickets can be listed.");
            if (
              typeof body.price !== "number" ||
              !Number.isFinite(body.price) ||
              body.price <= 0 ||
              body.price > 1.1
            )
              throw new ApiError(
                "Enter a resale price above 0 and up to 1.1 XLM.",
              );
            ticket.status = "listed";
            ticket.price = body.price;
          } else {
            if (ticket.status !== "listed")
              throw new ApiError("This ticket is not listed.");
            ticket.status = "valid";
            ticket.price = null;
          }
        }
        result = { ok: true };
      } else if (action === "scan") {
        const booking = db.bookings.find(
          (b) =>
            b.customerId === user.id &&
            b.id.toUpperCase() === String(body.id).toUpperCase(),
        );
        const ticket = db.tickets.find(
          (t) =>
            t.customerId === user.id &&
            t.id.toUpperCase() === String(body.id).toUpperCase(),
        );
        const ok =
          (!!booking && !booking.entryStatus && !db.resaleListings.some((listing) => listing.bookingId === booking.id && listing.status === "listed")) || ticket?.status === "valid";
        const message = ok
          ? "Entry granted"
          : !booking && !ticket
            ? "Ticket not found"
            : "Entry refused: ticket is listed or already redeemed";
        if (ok) {
          if (booking) booking.entryStatus = "redeemed";
          if (ticket) ticket.status = "redeemed";
        }
        db.history.unshift({
          customerId: user.id,
          id: String(body.id),
          ok,
          message,
        });
        result = { ok, message };
      } else if (action === "reset") {
        restoreResale(db, user.id);
        db.bookings = db.bookings.filter((b) => b.customerId !== user.id);
        db.resaleListings = db.resaleListings.filter((listing) => db.bookings.some((booking) => booking.id === listing.bookingId));
        db.tickets = db.tickets.filter((t) => t.customerId !== user.id);
        db.history = db.history.filter((h) => h.customerId !== user.id);
        db.transactions = db.transactions.filter(
          (t) => t.customerId !== user.id,
        );
        user.balance = 10;
        result = { ok: true };
      } else throw new ApiError("Not found.", 404);
    }
    persist(db);
    return Response.json(result, { headers });
  } catch (e) {
    return failure(e);
  }
}
function failure(error: unknown) {
  if (!(error instanceof ApiError) && !(error instanceof SyntaxError))
    console.error("Mock account API failed", error);
  return Response.json(
    {
      error:
        error instanceof ApiError
          ? error.message
          : error instanceof SyntaxError
            ? "Invalid JSON request."
            : "Unable to complete this request.",
    },
    {
      status:
        error instanceof ApiError
          ? error.status
          : error instanceof SyntaxError
            ? 400
            : 500,
      headers,
    },
  );
}
function validateConfig(event: EventSeating, venue: VenueLayout) {
  if (
    !event ||
    !venue ||
    typeof venue.name !== "string" ||
    !venue.name.trim() ||
    venue.name.length > 120 ||
    event.venueId !== venue.id ||
    typeof event.allowMixed !== "boolean" ||
    !event.prices ||
    !event.overrides ||
    !Array.isArray(venue.categories) ||
    !venue.categories.length ||
    venue.categories.length > 20 ||
    !Array.isArray(venue.sections) ||
    !venue.sections.length ||
    venue.sections.length > 40
  )
    throw new ApiError("Invalid seating configuration.");
  if (
    new Set(venue.categories.map((c) => c.id)).size !==
      venue.categories.length ||
    new Set(venue.sections.map((s) => s.id)).size !== venue.sections.length
  )
    throw new ApiError("Section and category IDs must be unique.");
  for (const c of venue.categories)
    if (
      typeof c.id !== "string" ||
      typeof c.name !== "string" ||
      !c.name.trim() ||
      c.name.length > 100 ||
      !/^#[0-9a-f]{6}$/i.test(c.color)
    )
      throw new ApiError("Invalid ticket category.");
  for (const value of Object.values(event.prices))
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value <= 0 ||
      value > 1000000
    )
      throw new ApiError("Ticket prices must be greater than zero.");
  for (const value of Object.values(event.overrides))
    if (value !== "blocked" && value !== "available")
      throw new ApiError("Invalid seat availability.");
  for (const s of venue.sections) {
    if (
      typeof s.id !== "string" ||
      typeof s.name !== "string" ||
      !s.name.trim() ||
      !venue.categories.some((c) => c.id === s.categoryId) ||
      !["numbered", "general"].includes(s.mode) ||
      ![s.rows, s.seatsPerRow, s.capacity].every(Number.isInteger) ||
      s.rows < 1 ||
      s.rows > 26 ||
      s.seatsPerRow < 1 ||
      s.seatsPerRow > 30 ||
      s.capacity < 1 ||
      s.capacity > 1000 ||
      !Array.isArray(s.accessible) ||
      ![s.x, s.y, s.width, s.height].every(Number.isFinite) ||
      s.x < 0 ||
      s.y < 16 ||
      s.width < 8 ||
      s.height < 8 ||
      s.x + s.width > 100 ||
      s.y + s.height > 98
    )
      throw new ApiError("Invalid venue section.");
  }
  for (let i = 0; i < venue.sections.length; i++)
    for (let j = i + 1; j < venue.sections.length; j++) {
      const a = venue.sections[i],
        b = venue.sections[j];
      if (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
      )
        throw new ApiError("Sections cannot overlap.");
    }
}

function publicRecord<T extends { customerId: string }>(record: T) {
  const { customerId, ...result } = record;
  void customerId;
  return result;
}
