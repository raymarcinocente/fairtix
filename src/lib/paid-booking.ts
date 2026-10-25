import "server-only";
import { randomUUID } from "node:crypto";
import { StrKey } from "@stellar/stellar-sdk";
import { priceBooking } from "./booking-pricing";
import { serialize } from "./db-queue";
import { ApiError, apiUser, database, persist } from "./mock-account-server";
import { checkOrder, type CheckResult, orderReview, prepareOrder, submitOrder } from "./paiflow/checkout";
import { formatXlm, getPaiflowConfig } from "./paiflow/config";
import { createOrder, readOrder } from "./paiflow/orders";
import { legacySeatId } from "./seating-data";
import { usdcToStroops } from "./xlm-price";
import type { ShowcaseBooking } from "./showcase-store";

// Live checkout for seat bookings: the customer pays the booking total in
// testnet XLM through the Paiflow Receive -> Split deployment, and the booking
// is created only after the payment and its 90/10 payouts are verified.

// Seats stay reserved this long past the preparation's expiry, covering
// signing, submission and confirmation.
const HOLD_GRACE_MS = 120_000;

export type PaidBookingResult = CheckResult & { booking?: ShowcaseBooking };

async function currentUserId(): Promise<string> {
  return (await apiUser(database())).id;
}

export async function startPaidBooking(body: Record<string, unknown>) {
  const walletAddress = body.walletAddress;
  if (typeof walletAddress !== "string" || !StrKey.isValidEd25519PublicKey(walletAddress))
    throw new ApiError("Connect a Stellar testnet wallet to continue.");
  const { shopAddress, communityAddress, deploymentId } = getPaiflowConfig();
  if (walletAddress === shopAddress || walletAddress === communityAddress)
    throw new ApiError("Pay from a customer wallet, not the shop or community fund wallet.");

  const { userId, draft } = await serialize(async () => {
    const db = database();
    const user = await apiUser(db);
    const { event, lines, subtotal, fee, total } = priceBooking(db, body);
    return {
      userId: user.id,
      draft: {
        eventId: event.eventId,
        seats: lines.map((l) => l.id),
        lineItems: lines,
        category: [...new Set(lines.map((l) => l.categoryName))].join(", "),
        subtotal,
        fee,
        total,
        holdSession: String(body.holdSession),
      },
    };
  });

  const created = await createOrder({
    ownerSession: userId,
    deploymentId,
    network: "testnet",
    walletAddress,
    amountStroops: usdcToStroops(draft.total).toString(),
    booking: draft,
  });
  const order = await prepareOrder(created.id, userId);

  // Keep the seats reserved while the customer signs and the payment confirms.
  const holdUntil = Date.parse(order.prepared!.data.expiresAt) + HOLD_GRACE_MS;
  await serialize(async () => {
    const db = database();
    const hold = db.holds.find((h) => h.session === draft.holdSession && h.eventId === draft.eventId);
    if (hold && hold.expires < holdUntil) {
      hold.expires = holdUntil;
      persist(db);
    }
  });

  return { ...orderReview(order), totalUsdc: draft.total };
}

export async function submitPaidBooking(orderId: string, signedXdr: string): Promise<PaidBookingResult> {
  const owner = await currentUserId();
  return finalize(await submitOrder(orderId, signedXdr, owner));
}

export async function checkPaidBooking(orderId: string): Promise<PaidBookingResult> {
  const owner = await currentUserId();
  return finalize(await checkOrder(orderId, owner));
}

/** Creates the booking for a verified payment. Idempotent per order. */
async function finalize(result: CheckResult): Promise<PaidBookingResult> {
  if (result.status !== "paid") return result;
  const order = await readOrder(result.orderId);
  const draft = order?.booking;
  if (!order || !draft) return result;

  const booking = await serialize(async () => {
    const db = database();
    const id = `FTX-${order.id}`;
    const existing = db.bookings.find((b) => b.id === id);
    if (existing) return withoutCustomer(existing);

    const taken = db.bookings.some(
      (b) => b.eventId === draft.eventId && b.seats.some((s) => draft.seats.includes(legacySeatId(s))),
    );
    if (taken)
      throw new ApiError(
        `Your payment was verified, but a seat was booked by someone else. Contact the organizer with transaction ${order.txHash} for a refund.`,
        409,
      );

    const paidXlm = formatXlm(BigInt(order.amountStroops));
    const createdAt = new Date().toISOString();
    const record = {
      id,
      eventId: draft.eventId,
      wallet: order.walletAddress,
      category: draft.category,
      seats: draft.seats,
      lineItems: draft.lineItems,
      subtotal: draft.subtotal,
      fee: draft.fee,
      total: draft.total,
      status: "confirmed" as const,
      txHash: order.txHash,
      paidXlm,
      createdAt,
      customerId: order.ownerSession,
    };
    db.holds = db.holds.filter((h) => !(h.session === draft.holdSession && h.eventId === draft.eventId));
    db.bookings.push(record);
    db.transactions.push({
      id: randomUUID(),
      customerId: order.ownerSession,
      reference: id,
      eventId: draft.eventId,
      kind: "purchase",
      amount: Number(paidXlm),
      currency: "XLM",
      createdAt,
      txHash: order.txHash,
    });
    persist(db);
    return withoutCustomer(record);
  });
  return { ...result, booking };
}

function withoutCustomer<T extends { customerId: string }>(record: T): Omit<T, "customerId"> {
  const { customerId, ...rest } = record;
  void customerId;
  return rest;
}
