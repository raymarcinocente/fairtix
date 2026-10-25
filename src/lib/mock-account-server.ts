import "server-only";
import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
} from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { Account, Role, Transaction } from "./auth-types";
import type { ShowcaseBooking } from "./showcase-store";
import type { Ticket } from "./demo-store";
import {
  eventSeatingDefaults,
  venueDefaults,
  type EventSeating,
  type VenueLayout,
} from "./seating-data";

// Local, single-process demo repository. Replace this boundary with SQL transactions.
type User = Account & { password: string; balance: number };
type Session = { hash: string; userId: string; expires: number };
type Token = {
  hash: string;
  userId: string;
  kind: "verify" | "reset";
  expires: number;
};
type OwnedBooking = ShowcaseBooking & { customerId: string };
type OwnedTicket = Ticket & { customerId: string };
type Database = {
  users: User[];
  sessions: Session[];
  tokens: Token[];
  bookings: OwnedBooking[];
  tickets: OwnedTicket[];
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
  outbox: { email: string; kind: string; link: string; createdAt: string }[];
};
const dir = path.join(process.cwd(), ".data");
const file = path.join(dir, "mock-accounts.json");
export const SESSION_COOKIE = "fairtix_session";
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
function matches(password: string, encoded: string) {
  const [salt, digest] = encoded.split(":");
  const result = scryptSync(password, salt, 64);
  return timingSafeEqual(result, Buffer.from(digest, "hex"));
}
export function publicAccount(user: User): Account {
  const { id, firstName, lastName, email, verified, role, wallet } = user;
  return { id, firstName, lastName, email, verified, role, wallet };
}
function fresh(): Omit<Database, "events" | "venues" | "holds"> {
  return {
    users: ["ana", "ben", "organizer", "admin"].map((name) => ({
      id: randomUUID(),
      firstName: name[0].toUpperCase() + name.slice(1),
      lastName: "Demo",
      email: `${name}@fairtix.demo`,
      verified: true,
      role:
        name === "admin"
          ? "administrator"
          : name === "organizer"
            ? "organizer"
            : "customer",
      wallet: null,
      password: passwordHash("DemoPass123!"),
      balance: 10,
    })),
    sessions: [],
    tokens: [],
    bookings: [],
    tickets: [],
    transactions: [],
    history: [],
    outbox: [],
  };
}
export function database(): Database {
  if (existsSync(file)) {
    const db = JSON.parse(readFileSync(file, "utf8"));
    return {
      ...db,
      events: db.events || structuredClone(eventSeatingDefaults),
      venues: db.venues || structuredClone(venueDefaults),
      holds: db.holds || [],
      transactions: db.transactions || [],
    };
  }
  const db = {
    ...fresh(),
    events: structuredClone(eventSeatingDefaults),
    venues: structuredClone(venueDefaults),
    holds: [],
  };
  persist(db);
  return db;
}
export function persist(db: Database) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(file + ".tmp", JSON.stringify(db, null, 2), { mode: 0o600 });
  renameSync(file + ".tmp", file);
}
export async function sessionUser(db = database()) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session =
    token &&
    db.sessions.find((s) => s.hash === hash(token) && s.expires > Date.now());
  return session ? db.users.find((u) => u.id === session.userId) || null : null;
}
export async function requireUser(returnTo: string, roles?: Role[]) {
  await connection();
  const user = await sessionUser();
  if (!user) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  if (roles && !roles.includes(user.role)) redirect("/account?access=denied");
  return publicAccount(user);
}
export async function apiUser(db: Database, staff = false) {
  const user = await sessionUser(db);
  if (!user) throw new ApiError("Sign in to continue.", 401);
  if (staff && user.role === "customer")
    throw new ApiError("Organizer or administrator access is required.", 403);
  return user;
}
export async function createSession(
  db: Database,
  user: User,
  remember: boolean,
) {
  const jar = await cookies();
  const previous = jar.get(SESSION_COOKIE)?.value;
  const token = randomBytes(32).toString("hex");
  const duration = remember ? 7 * 86400 : 8 * 3600;
  db.sessions = db.sessions.filter(
    (s) => s.expires > Date.now() && s.hash !== hash(previous || ""),
  );
  db.sessions.push({
    hash: hash(token),
    userId: user.id,
    expires: Date.now() + duration * 1000,
  });
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(remember ? { maxAge: duration } : {}),
  });
}
export async function endSession(db: Database) {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  db.sessions = db.sessions.filter((s) => s.hash !== hash(token || ""));
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
export function text(value: unknown, name: string, max = 100) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new ApiError(`Enter a valid ${name}.`);
  return value.trim();
}
export function email(value: unknown) {
  const result = text(value, "email address", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))
    throw new ApiError("Enter a valid email address.");
  return result;
}
export function validPassword(value: unknown) {
  if (typeof value !== "string" || value.length < 12 || value.length > 128)
    throw new ApiError("Use a password between 12 and 128 characters.");
  return value;
}
export function issueToken(db: Database, user: User, kind: "verify" | "reset") {
  const token = randomBytes(32).toString("hex");
  db.tokens = db.tokens.filter((t) => t.userId !== user.id || t.kind !== kind);
  db.tokens.push({
    hash: hash(token),
    userId: user.id,
    kind,
    expires: Date.now() + (kind === "reset" ? 1800000 : 86400000),
  });
  db.outbox.push({
    email: user.email,
    kind,
    link: `/${kind === "reset" ? "reset-password" : "verify-email"}?token=${token}`,
    createdAt: new Date().toISOString(),
  });
}
const attempts = new Map<string, { count: number; until: number }>();
export function throttle(key: string) {
  const entry = attempts.get(key);
  if (!entry || entry.until < Date.now())
    attempts.set(key, { count: 1, until: Date.now() + 900000 });
  else if (++entry.count > 20)
    throw new ApiError("Too many attempts. Try again in 15 minutes.", 429);
}
export async function authAction(
  action: string,
  body: Record<string, unknown>,
  db: Database,
) {
  if (action === "logout") {
    await endSession(db);
    return { user: null };
  }
  if (action === "login") {
    const address = email(body.email);
    throttle(`login:${address}`);
    const user = db.users.find((u) => u.email === address);
    const candidate =
      typeof body.password === "string" && body.password.length <= 128
        ? body.password
        : "";
    const encoded = user?.password || db.users[0].password;
    const correct = matches(candidate, encoded);
    if (!user || !correct)
      throw new ApiError("Email or password is incorrect.", 401);
    await createSession(db, user, body.remember === true);
    return { user: publicAccount(user) };
  }
  if (action === "register") {
    const firstName = text(body.firstName, "first name"),
      lastName = text(body.lastName, "last name"),
      address = email(body.email),
      password = validPassword(body.password);
    if (body.terms !== true)
      throw new ApiError("Agree to the Terms and Conditions to continue.");
    if (body.confirmPassword !== password)
      throw new ApiError("Passwords do not match.");
    if (db.users.some((u) => u.email === address))
      throw new ApiError(
        "An account with this email already exists. Sign in or reset your password.",
      );
    const user: User = {
      id: randomUUID(),
      firstName,
      lastName,
      email: address,
      password: passwordHash(password),
      verified: false,
      role: "customer",
      wallet: null,
      balance: 10,
    };
    db.users.push(user);
    issueToken(db, user, "verify");
    await createSession(db, user, false);
    return { user: publicAccount(user) };
  }
  if (action === "forgot") {
    const address = email(body.email);
    throttle(`reset:${address}`);
    const user = db.users.find((u) => u.email === address);
    if (user) issueToken(db, user, "reset");
    return {
      message:
        "If this email has an account, reset instructions have been added to the local demo outbox. No email was sent.",
    };
  }
  if (action === "reset" || action === "verify") {
    const token = db.tokens.find(
      (t) =>
        t.hash === hash(String(body.token || "")) &&
        t.kind === (action === "reset" ? "reset" : "verify") &&
        t.expires > Date.now(),
    );
    if (!token)
      throw new ApiError(
        "This link is invalid or has expired. Request a new link.",
      );
    const user = db.users.find((u) => u.id === token.userId)!;
    if (action === "reset") {
      const password = validPassword(body.password);
      if (password !== body.confirmPassword)
        throw new ApiError("Passwords do not match.");
      user.password = passwordHash(password);
      db.sessions = db.sessions.filter((s) => s.userId !== user.id);
    } else user.verified = true;
    db.tokens = db.tokens.filter((t) => t !== token);
    return {
      message:
        action === "reset"
          ? "Password updated. Sign in with your new password."
          : "Email address verified.",
    };
  }
  const user = await apiUser(db);
  if (action === "profile") {
    const address = email(body.email);
    if (db.users.some((u) => u.id !== user.id && u.email === address))
      throw new ApiError("This email address is already in use.");
    user.firstName = text(body.firstName, "first name");
    user.lastName = text(body.lastName, "last name");
    if (user.email !== address) {
      user.email = address;
      user.verified = false;
      db.tokens = db.tokens.filter((t) => t.userId !== user.id);
      issueToken(db, user, "verify");
    }
  } else if (action === "password") {
    if (
      typeof body.currentPassword !== "string" ||
      !matches(body.currentPassword.slice(0, 128), user.password)
    )
      throw new ApiError("Current password is incorrect.");
    const password = validPassword(body.password);
    if (password !== body.confirmPassword)
      throw new ApiError("Passwords do not match.");
    user.password = passwordHash(password);
    db.tokens = db.tokens.filter(
      (t) => t.userId !== user.id || t.kind !== "reset",
    );
    db.sessions = db.sessions.filter((s) => s.userId !== user.id);
    await createSession(db, user, false);
  } else if (action === "wallet") {
    if (body.wallet !== null && body.wallet !== "ana" && body.wallet !== "ben")
      throw new ApiError("Choose a supported demo wallet.");
    user.wallet = body.wallet as string | null;
  } else if (action === "resend") {
    throttle(`verify:${user.id}`);
    issueToken(db, user, "verify");
    return {
      message:
        "Verification instructions added to the local demo outbox. No email was sent.",
    };
  } else throw new ApiError("Unknown account action.", 404);
  return { user: publicAccount(user) };
}
