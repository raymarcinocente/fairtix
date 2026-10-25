import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ApiResponse, ExecutePrepared } from "@paiflow/sdk";
import { DATA_DIR } from "../data-dir";
import type { SeatTicket } from "../seating-data";

// DEVELOPMENT ONLY: a file-per-order JSON store with an in-process lock.
// Replace with a durable database and row/advisory locks before production.
// Orders hold signed envelopes, so the directory must stay access-restricted
// and out of git (.data/ is ignored).
const DIR = path.join(DATA_DIR, "orders");

export type OrderStatus =
  | "created"
  | "prepared"
  | "submitted"
  | "paid"
  | "failed"
  | "pending_verification";

export interface Order {
  id: string;
  ownerSession: string;
  deploymentId: string;
  network: "testnet";
  walletAddress: string;
  amountStroops: string;
  status: OrderStatus;
  createdAt: string;
  prepared?: ApiResponse<ExecutePrepared>;
  txHash?: string;
  signedXdr?: string;
  submittedAt?: string;
  lastCheck?: { at: string; status: string; detail?: string };
  /** Seats being paid for; the booking is created only after verification. */
  booking?: BookingDraft;
}

export interface BookingDraft {
  eventId: string;
  seats: string[];
  lineItems: SeatTicket[];
  category: string;
  subtotal: number;
  fee: number;
  total: number;
  holdSession: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const locks = new Map<string, Promise<unknown>>();

function file(id: string): string {
  if (!UUID.test(id)) throw new Error("Invalid order id");
  return path.join(DIR, `${id}.json`);
}

async function write(order: Order): Promise<void> {
  await mkdir(DIR, { recursive: true });
  const target = file(order.id);
  const tmp = `${target}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(order, null, 2), { mode: 0o600 });
  await rename(tmp, target);
}

export async function readOrder(id: string): Promise<Order | undefined> {
  try {
    return JSON.parse(await readFile(file(id), "utf8")) as Order;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function createOrder(input: Omit<Order, "id" | "status" | "createdAt">): Promise<Order> {
  const order: Order = { ...input, id: randomUUID(), status: "created", createdAt: new Date().toISOString() };
  await write(order);
  return order;
}

/** Serialises read-modify-write for one order. Return undefined to leave it unchanged. */
export async function withOrder<T>(
  id: string,
  fn: (order: Order) => Promise<{ order?: Order; result: T }>,
): Promise<T> {
  const previous = locks.get(id) ?? Promise.resolve();
  const run = previous.catch(() => {}).then(async () => {
    const order = await readOrder(id);
    if (!order) throw new OrderNotFoundError();
    const { order: next, result } = await fn(structuredClone(order));
    if (next) await write(next);
    return result;
  });
  locks.set(id, run);
  try {
    return await run;
  } finally {
    if (locks.get(id) === run) locks.delete(id);
  }
}

export class OrderNotFoundError extends Error {
  constructor() {
    super("Order not found");
  }
}
