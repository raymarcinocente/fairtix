import "server-only";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
} from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import type { Account, Transaction } from "./auth-types";
import type { ShowcaseBooking } from "./showcase-store";
import type { Ticket } from "./demo-store";
import type { StoredResaleListing } from "./resale-types";
import { seedResale } from "./resale-service";
import {
  eventSeatingDefaults,
  venueDefaults,
  type EventSeating,
  type VenueLayout,
} from "./seating-data";

type Visitor = Account & { balance: number; usdcBalance?: number };
export type Database = {
  resaleListings: StoredResaleListing[];
  resaleSeeded: boolean;
  users: Visitor[];
  sessions: { hash: string; userId: string; expires: number }[];
  bookings: (ShowcaseBooking & { customerId: string })[];
  tickets: (Ticket & { customerId: string })[];
  transactions: (Transaction & { customerId: string })[];
  events: EventSeating[];
  venues: VenueLayout[];
  holds: {
    session: string;
    eventId: string;
    seats: string[];
    expires: number;
  }[];
  history: { customerId: string; id: string; ok: boolean; message: string }[];
};
const dir = path.join(process.cwd(), ".data");
const file = path.join(dir, "mock-accounts.json");
export const SESSION_COOKIE = "fairtix_prototype";
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function publicAccount(user: Visitor): Account {
  const { id, firstName, lastName, email, verified, role, wallet } = user;
  return { id, firstName, lastName, email, verified, role, wallet };
}
export function database(): Database {
  if (existsSync(file)) {
    const db = JSON.parse(readFileSync(file, "utf8"));
    const restored: Database = {
      ...db,
      events: db.events || structuredClone(eventSeatingDefaults),
      venues: db.venues || structuredClone(venueDefaults),
      holds: db.holds || [],
      transactions: db.transactions || [],
      resaleListings: db.resaleListings || [],
      resaleSeeded: db.resaleSeeded || false,
    };
    if (seedResale(restored)) persist(restored);
    return restored;
  }
  const db: Database = {
    resaleListings: [],
    resaleSeeded: false,
    users: [],
    sessions: [],
    bookings: [],
    tickets: [],
    transactions: [],
    history: [],
    events: structuredClone(eventSeatingDefaults),
    venues: structuredClone(venueDefaults),
    holds: [],
  };
  seedResale(db);
  persist(db);
  return db;
}
export function persist(db: Database) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(file + ".tmp", JSON.stringify(db, null, 2), { mode: 0o600 });
  renameSync(file + ".tmp", file);
}
// The cookie only keeps prototype data in the same browser; it is not an account login.
export async function sessionUser(db = database()) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session =
    token &&
    db.sessions.find((s) => s.hash === hash(token) && s.expires > Date.now());
  return session
    ? db.users.find(
        (u) => u.id === session.userId && u.id.startsWith("prototype-"),
      ) || null
    : null;
}
export async function prototypeVisitor(db: Database) {
  const existing = await sessionUser(db);
  if (existing) return publicAccount(existing);
  const visitor: Visitor = {
    id: `prototype-${randomUUID()}`,
    firstName: "Prototype",
    lastName: "Visitor",
    email: "",
    verified: false,
    role: "organizer",
    wallet: null,
    balance: 10,
  };
  db.users.push(visitor);
  const token = randomBytes(32).toString("hex");
  db.sessions = db.sessions.filter((s) => s.expires > Date.now());
  db.sessions.push({
    hash: hash(token),
    userId: visitor.id,
    expires: Date.now() + 30 * 86400000,
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 86400,
  });
  return publicAccount(visitor);
}
export async function apiUser(db: Database, staff = false) {
  const visitor = await sessionUser(db);
  if (!visitor)
    throw new ApiError(
      "Prototype data is still loading. Refresh the page and try again.",
      401,
    );
  // Prototype organizer tools are public; records and scanning remain browser-scoped.
  if (staff && !visitor.id.startsWith("prototype-"))
    throw new ApiError("Prototype access required.", 403);
  return visitor;
}
export async function authAction(
  action: string,
  body: Record<string, unknown>,
  db: Database,
) {
  if (action !== "wallet")
    throw new ApiError(
      "Account authentication is disabled in this prototype.",
      410,
    );
  if (body.wallet !== null && body.wallet !== "ana" && body.wallet !== "ben")
    throw new ApiError("Choose a supported sample wallet.");
  const account = await prototypeVisitor(db);
  const visitor = db.users.find((user) => user.id === account.id)!;
  visitor.wallet = body.wallet as string | null;
  return { user: publicAccount(visitor) };
}
