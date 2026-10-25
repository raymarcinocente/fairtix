"use client";
import { useSyncExternalStore } from "react";
import { demoApi } from "./auth-client";
import {
  eventSeatingDefaults,
  legacySeatId,
  seededStatus,
  sectionSeats,
  venueDefaults,
  type EventSeating,
  type Seat,
  type SeatStatus,
  type SeatTicket,
  type VenueLayout,
} from "./seating-data";

type Hold = { session: string; expiresAt: number };
type SeatingState = {
  venues: VenueLayout[];
  events: EventSeating[];
  holds: Record<string, Record<string, Hold>>;
  createdAt: number;
  session: string;
};
type Booked = { eventId: string; seats: string[] };
const initial: SeatingState = {
  venues: venueDefaults,
  events: eventSeatingDefaults,
  holds: {},
  createdAt: 0,
  session: "",
};
const key = "fairtix-seating-v1";
let state = initial;
let loaded = false;
const listeners = new Set<() => void>();
function read(session: string) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    if (
      Array.isArray(value?.venues) &&
      Array.isArray(value?.events) &&
      value?.holds &&
      Number.isFinite(value.createdAt)
    )
      return { ...value, session } as SeatingState;
  } catch {
    if (state.createdAt) return { ...state, session };
  }
  return { ...state, session, createdAt: state.createdAt || Date.now() };
}
export function getSeating() {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    let session = "";
    try {
      session = sessionStorage.getItem(key) || "";
      if (!session) {
        session = crypto.randomUUID();
        sessionStorage.setItem(key, session);
      }
    } catch {
      session = crypto.randomUUID();
    }
    state = read(session);
    persist();
  }
  return state;
}
function persist() {
  try {
    const { session: _session, ...saved } = state;
    void _session;
    localStorage.setItem(key, JSON.stringify(saved));
  } catch {
    /* Keep an in-memory fallback. */
  }
}
function fresh() {
  const current = getSeating();
  state = read(current.session);
  return state;
}
function save(next: SeatingState) {
  state = next;
  persist();
  listeners.forEach((fn) => fn());
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === key) {
      state = read(state.session);
      listeners.forEach((cb) => cb());
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}
export function useSeating() {
  return useSyncExternalStore(subscribe, getSeating, () => initial);
}
export function applyServerSeating(
  events: EventSeating[],
  venues: VenueLayout[],
) {
  const current = getSeating();
  if (
    JSON.stringify(current.events) === JSON.stringify(events) &&
    JSON.stringify(current.venues) === JSON.stringify(venues)
  )
    return;
  save({ ...current, events, venues });
}
export function seatingFor(s: SeatingState, eventId: string) {
  const event = s.events.find((e) => e.eventId === eventId);
  const venue = s.venues.find((v) => v.id === event?.venueId);
  if (!event || !venue)
    throw new Error("No seating configuration exists for this concert.");
  return { event, venue };
}
export function resolveStatus(
  s: SeatingState,
  eventId: string,
  seat: Seat,
  bookings: Booked[],
  now: number,
  showOwn = true,
): SeatStatus {
  if (
    bookings.some(
      (b) =>
        b.eventId === eventId &&
        b.seats.some((id) => legacySeatId(id) === seat.id),
    )
  )
    return "sold";
  const { event, venue } = seatingFor(s, eventId);
  const section = venue.sections.find((v) => v.id === seat.sectionId)!;
  if (!Number.isFinite(event.prices[section.categoryId])) return "blocked";
  const seed = seededStatus(eventId, seat);
  if (seed === "sold") return "sold";
  const hold = s.holds[eventId]?.[seat.id];
  if (hold && hold.expiresAt > now)
    return showOwn && hold.session === s.session ? "selected" : "held";
  if (event.overrides[seat.id])
    return event.overrides[seat.id] === "blocked" ? "blocked" : "available";
  if (seed === "held") return now < s.createdAt + 600000 ? "held" : "available";
  return seed;
}
export function ownSelection(
  s: SeatingState,
  eventId: string,
  bookings: Booked[],
  now: number,
): SeatTicket[] {
  const { event, venue } = seatingFor(s, eventId);
  return venue.sections.flatMap((section) => {
    const category = venue.categories.find((c) => c.id === section.categoryId)!;
    return sectionSeats(section)
      .filter(
        (seat) => resolveStatus(s, eventId, seat, bookings, now) === "selected",
      )
      .map((seat) => ({
        ...seat,
        sectionName: section.name,
        categoryId: category.id,
        categoryName: category.name,
        color: category.color,
        price: event.prices[category.id],
      }));
  });
}
export function toggleSeat(
  eventId: string,
  seatId: string,
  bookings: Booked[],
) {
  const s = fresh();
  const now = Date.now();
  const { event, venue } = seatingFor(s, eventId);
  const section = venue.sections.find((v) =>
    sectionSeats(v).some((seat) => seat.id === seatId),
  );
  const seat = section && sectionSeats(section).find((v) => v.id === seatId);
  if (!seat || !section) throw new Error("Seat not found.");
  const status = resolveStatus(s, eventId, seat, bookings, now);
  const holds = Object.fromEntries(
    Object.entries(s.holds[eventId] || {}).filter(
      ([, hold]) => hold.expiresAt > now,
    ),
  );
  if (status === "selected") {
    delete holds[seatId];
    save({ ...s, holds: { ...s.holds, [eventId]: holds } });
    return;
  }
  if (status !== "available")
    throw new Error(`This seat is ${status}. Choose an available seat.`);
  const selected = ownSelection(s, eventId, bookings, now);
  if (selected.length >= 6)
    throw new Error("Select up to six tickets per booking.");
  if (
    !event.allowMixed &&
    selected.some((v) => v.categoryId !== section.categoryId)
  )
    throw new Error(
      "This event allows one category per booking. Remove your current selection to change categories.",
    );
  const expiresAt = selected.length
    ? Math.min(...selected.map((v) => holds[v.id].expiresAt))
    : now + 300000;
  holds[seatId] = { session: s.session, expiresAt };
  save({ ...s, holds: { ...s.holds, [eventId]: holds } });
}
export function releaseSelection(eventId: string) {
  const s = fresh();
  void demoApi("holds/release", { session: s.session, eventId }).catch(
    () => {},
  );
  const holds = Object.fromEntries(
    Object.entries(s.holds[eventId] || {}).filter(
      ([, h]) => h.session !== s.session,
    ),
  );
  save({ ...s, holds: { ...s.holds, [eventId]: holds } });
}
export function selectionDeadline(s: SeatingState, eventId: string) {
  const held = Object.values(s.holds[eventId] || {}).filter(
    (h) => h.session === s.session,
  );
  return held.length ? Math.min(...held.map((h) => h.expiresAt)) : null;
}
export function validateSeatingBooking(
  eventId: string,
  lines: SeatTicket[],
  session: string,
  bookings: Booked[],
) {
  const s = fresh();
  const now = Date.now();
  if (session !== s.session)
    throw new Error("This reservation belongs to another session.");
  const actual = ownSelection(s, eventId, bookings, now);
  if (
    !seatingFor(s, eventId).event.allowMixed &&
    new Set(lines.map((line) => line.categoryId)).size > 1
  )
    throw new Error(
      "This event allows one category per booking. Review your selection.",
    );
  if (
    !lines.length ||
    lines.length > 6 ||
    new Set(lines.map((v) => v.id)).size !== lines.length
  )
    throw new Error("Select between one and six tickets.");
  if (
    lines.some(
      (v) =>
        !actual.some(
          (a) =>
            a.id === v.id &&
            a.price === v.price &&
            a.categoryId === v.categoryId,
        ),
    )
  )
    throw new Error(
      "The reservation or ticket price changed. Review your seats before paying.",
    );
  return actual.filter((v) => lines.some((l) => l.id === v.id));
}
export function saveEventSeating(config: EventSeating) {
  const s = fresh();
  if (Object.values(config.prices).some((v) => !Number.isFinite(v) || v <= 0))
    throw new Error("Ticket prices must be greater than 0 USDC.");
  save({
    ...s,
    events: s.events.map((e) => (e.eventId === config.eventId ? config : e)),
  });
}
export function setSeatBlocked(
  eventId: string,
  seatId: string,
  blocked: boolean,
  bookings: Booked[],
) {
  const s = fresh();
  const { event, venue } = seatingFor(s, eventId);
  const seat = venue.sections
    .flatMap(sectionSeats)
    .find((v) => v.id === seatId);
  if (!seat) throw new Error("Seat not found.");
  const status = resolveStatus(s, eventId, seat, bookings, Date.now());
  if (["sold", "held", "selected"].includes(status))
    throw new Error(
      "Sold or reserved tickets cannot be blocked or released here.",
    );
  save({
    ...s,
    events: s.events.map((e) =>
      e.eventId === eventId
        ? {
            ...event,
            overrides: {
              ...event.overrides,
              [seatId]: blocked ? "blocked" : "available",
            },
          }
        : e,
    ),
  });
}
export function saveVenue(venue: VenueLayout, bookings: Booked[]) {
  const s = fresh();
  if (!venue.name.trim() || !venue.categories.length || !venue.sections.length)
    throw new Error("Provide a venue name, category, and section.");
  if (
    new Set(venue.categories.map((v) => v.id)).size !==
      venue.categories.length ||
    new Set(venue.sections.map((v) => v.id)).size !== venue.sections.length
  )
    throw new Error("Category and section IDs must be unique.");
  for (const c of venue.categories)
    if (!c.name.trim() || !/^#[0-9a-f]{6}$/i.test(c.color))
      throw new Error("Provide a category name and valid color.");
  for (const v of venue.sections) {
    if (!v.name.trim() || !venue.categories.some((c) => c.id === v.categoryId))
      throw new Error("Every section needs a name and category.");
    if (
      ![v.x, v.y, v.width, v.height].every(Number.isFinite) ||
      v.x < 0 ||
      v.y < 16 ||
      v.width < 8 ||
      v.height < 8 ||
      v.x + v.width > 100 ||
      v.y + v.height > 98
    )
      throw new Error("Sections must fit within the map, below the stage.");
    if (
      ![v.rows, v.seatsPerRow, v.capacity].every(Number.isInteger) ||
      v.rows < 1 ||
      v.rows > 26 ||
      v.seatsPerRow < 1 ||
      v.seatsPerRow > 30 ||
      v.capacity < 1 ||
      v.capacity > 1000
    )
      throw new Error(
        "Use 1–26 rows, 1–30 seats per row, or 1–1000 general admission tickets.",
      );
    const seats = sectionSeats(v);
    if (
      v.accessible.some(
        (a) => !seats.some((seat) => `${seat.row || "GA"}${seat.number}` === a),
      )
    )
      throw new Error(
        `Check accessible seat references in ${v.name}. Use row and number, such as A1.`,
      );
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
        throw new Error("Sections cannot overlap. Adjust their map positions.");
    }
  const events = s.events
    .filter((e) => e.venueId === venue.id)
    .map((e) => e.eventId);
  const nextSeats = new Set(
    venue.sections.flatMap(sectionSeats).map((v) => v.id),
  );
  const occupied = [
    ...bookings
      .filter((b) => events.includes(b.eventId))
      .flatMap((b) => b.seats.map(legacySeatId)),
    ...events.flatMap((id) =>
      Object.entries(s.holds[id] || {})
        .filter(([, h]) => h.expiresAt > Date.now())
        .map(([seat]) => seat),
    ),
  ];
  if (occupied.some((id) => !nextSeats.has(id)))
    throw new Error(
      "This layout change would remove sold or held seats. Keep their section, row, and seat IDs.",
    );
  save({
    ...s,
    venues: s.venues.map((v) =>
      v.id === venue.id ? structuredClone(venue) : v,
    ),
  });
}
export function resetSeating() {
  const s = getSeating();
  void demoApi("holds/release", { session: s.session }).catch(() => {});
  save({ ...s, holds: {} });
}
