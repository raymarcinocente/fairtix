"use client";
import { getNetworkDetails, isConnected, requestAccess, signTransaction } from "@stellar/freighter-api";
import type { ShowcaseBooking } from "./showcase-store";

// Browser adapter for the live booking checkout. Freighter signs here; the
// Paiflow SDK and API token stay on the server. Only the order ID is kept in
// the browser so a reload can check the original payment instead of re-paying.

export type PaymentReview = {
  orderId: string;
  xdr: string;
  networkPassphrase: string;
  expiresAt: string;
  totalUsdc: number;
  review: {
    walletAddress: string;
    amountXlm: string;
    maxFeeXlm: string;
    recipients: { label: string; address: string; amountXlm: string }[];
  };
};

export type PaymentResult = {
  orderId: string;
  status:
    | "created"
    | "prepared"
    | "submitted"
    | "paid"
    | "failed"
    | "pending_verification"
    | "expired"
    | "payout_mismatch"
    // The server no longer has this order (demo storage was reset).
    | "not_found";
  txHash?: string;
  detail?: string;
  warning?: string;
  booking?: ShowcaseBooking;
};

const PENDING_KEY = "fairtix:pending-booking-payment";

async function post<T>(action: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/bookings/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 202)
    throw new CheckoutError(json.error ?? "Unable to reach checkout. Your order is kept.", res.status);
  return json as T;
}

class CheckoutError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function connectFreighter(): Promise<string> {
  if (!(await isConnected()).isConnected) throw new Error("Install and unlock the Freighter wallet extension.");
  const access = await requestAccess();
  if (access.error) throw new Error(access.error.message);
  const network = await getNetworkDetails();
  if (network.error) throw new Error(network.error.message);
  if (network.network !== "TESTNET") throw new Error("Switch Freighter to Stellar Testnet.");
  return access.address;
}

export async function prepareBookingPayment(input: {
  eventId: string;
  seats: string[];
  total: number;
  holdSession: string;
  holdExpiresAt: number | null;
  walletAddress: string;
}): Promise<PaymentReview> {
  const review = await post<PaymentReview>("prepare", input);
  savePending({ orderId: review.orderId, eventId: input.eventId });
  return review;
}

export async function signAndSubmitBookingPayment(review: PaymentReview, address: string): Promise<PaymentResult> {
  if (address !== review.review.walletAddress) throw new Error("The connected Freighter account does not match this payment.");
  if (Date.parse(review.expiresAt) < Date.now()) throw new Error("This payment expired before signing. Use Check payment.");
  const network = await getNetworkDetails();
  if (network.networkPassphrase !== review.networkPassphrase) throw new Error("Freighter is on a different network.");
  const signed = await signTransaction(review.xdr, { networkPassphrase: review.networkPassphrase, address });
  if (signed.error) throw new Error(signed.error.message);
  return settle(await post<PaymentResult>("submit", { orderId: review.orderId, signedXdr: signed.signedTxXdr }));
}

export async function checkBookingPayment(orderId: string): Promise<PaymentResult> {
  try {
    return settle(await post<PaymentResult>("check", { orderId }));
  } catch (e) {
    if (e instanceof CheckoutError && e.status === 404) return settle({ orderId, status: "not_found" });
    throw e;
  }
}

const FINAL: PaymentResult["status"][] = ["paid", "failed", "expired", "payout_mismatch", "not_found"];

function settle(result: PaymentResult): PaymentResult {
  if (FINAL.includes(result.status)) clearPending();
  return result;
}

export function pendingPayment(): { orderId: string; eventId: string } | null {
  try {
    const value = JSON.parse(localStorage.getItem(PENDING_KEY) || "null");
    return value && typeof value.orderId === "string" ? value : null;
  } catch {
    return null;
  }
}

function savePending(value: { orderId: string; eventId: string }) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(value));
  } catch {}
}

export function clearPending() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {}
}

export const shortAddress = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;
