import "server-only";
import { PaiflowApiError } from "@paiflow/sdk";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import { getDeployment } from "./client";
import { expectedPayouts, formatXlm, getPaiflowConfig } from "./config";
import type { Order, OrderStatus } from "./orders";

const HORIZON_TESTNET = "https://horizon-testnet.stellar.org";

export interface Verification {
  status: OrderStatus;
  chainStatus: string;
  detail?: string;
  payouts?: { shop: string; community: string };
}

/** Parses a 7-decimal Horizon amount ("0.9000000") into stroops without floats. */
function toStroops(amount: string): bigint {
  const [whole, frac = ""] = amount.split(".");
  return BigInt(whole) * 10_000_000n + BigInt(frac.padEnd(7, "0").slice(0, 7));
}

interface HorizonEffect {
  type: string;
  account?: string;
  amount?: string;
  asset_type?: string;
}

/** Native XLM credited/debited per account in one transaction, from chain effects. */
async function nativeTransfers(txHash: string) {
  const res = await fetch(`${HORIZON_TESTNET}/transactions/${txHash}/effects?limit=200`, {
    cache: "no-store",
  });
  if (!res.ok) return undefined;
  const body = (await res.json()) as { _embedded?: { records?: HorizonEffect[] } };
  const credited = new Map<string, bigint>();
  const debited = new Map<string, bigint>();
  for (const effect of body._embedded?.records ?? []) {
    if (effect.asset_type !== "native" || !effect.account || !effect.amount) continue;
    const target = effect.type === "account_credited" ? credited : effect.type === "account_debited" ? debited : null;
    target?.set(effect.account, (target.get(effect.account) ?? 0n) + toStroops(effect.amount));
  }
  return { credited, debited };
}

// Ledger close times can trail wall-clock time slightly.
const TIME_BOUNDS_GRACE_S = 60;

/**
 * True only when the prepared transaction can never execute: its time bounds
 * have passed and the chain has no record of its hash. Anything uncertain
 * (no time bounds, Horizon unavailable) returns false and keeps the order.
 */
export async function provenNeverIncluded(order: Order): Promise<boolean> {
  if (!order.prepared || !order.txHash) return false;
  const { xdr, networkPassphrase } = order.prepared.data;
  const tx = TransactionBuilder.fromXDR(xdr, networkPassphrase);
  const maxTime = Number(("timeBounds" in tx && tx.timeBounds?.maxTime) || 0);
  if (!maxTime || Date.now() / 1000 < maxTime + TIME_BOUNDS_GRACE_S) return false;
  const res = await fetch(`${HORIZON_TESTNET}/transactions/${order.txHash}`, { cache: "no-store" });
  return res.status === 404;
}

/**
 * Receipt verifier: the order is paid only when Paiflow reports SUCCESS for the
 * original hash AND chain evidence shows the payer, exact amount and both payouts.
 * Anything uncertain stays pending; it never authorises another payment.
 */
export async function verifyOrder(order: Order): Promise<Verification> {
  if (!order.txHash) return { status: order.status, chainStatus: "NOT_SUBMITTED" };

  const deployment = await getDeployment();
  let chainStatus: string;
  let chainError: string | undefined;
  try {
    const { data } = await deployment.transactions.get(order.txHash);
    if (data.network !== order.network) {
      return { status: "pending_verification", chainStatus: data.status, detail: "Network mismatch" };
    }
    chainStatus = data.status;
    chainError = data.error?.message;
  } catch (error) {
    if (error instanceof PaiflowApiError && error.status === 404) {
      return { status: "pending_verification", chainStatus: "NOT_FOUND" };
    }
    throw error;
  }

  if (chainStatus === "FAILED") return { status: "failed", chainStatus, detail: chainError };
  if (chainStatus !== "SUCCESS") return { status: "pending_verification", chainStatus };

  const { shopAddress, communityAddress } = getPaiflowConfig();
  const amount = BigInt(order.amountStroops);
  const expected = expectedPayouts(amount);
  const transfers = await nativeTransfers(order.txHash);
  if (!transfers) {
    return { status: "pending_verification", chainStatus, detail: "Chain transfer evidence unavailable" };
  }

  const shop = transfers.credited.get(shopAddress) ?? 0n;
  const community = transfers.credited.get(communityAddress) ?? 0n;
  const paid = transfers.debited.get(order.walletAddress) ?? 0n;
  const payouts = { shop: formatXlm(shop), community: formatXlm(community) };

  // Horizon ingests a transaction and its effects together, so once SUCCESS
  // effects are readable a mismatch is final, not a lag.
  if (paid !== amount || shop !== expected.shop || community !== expected.community) {
    return {
      status: "payout_mismatch",
      chainStatus,
      payouts,
      detail:
        `Expected payer ${formatXlm(amount)}, shop ${formatXlm(expected.shop)}, community ${formatXlm(expected.community)} XLM; ` +
        `saw payer ${formatXlm(paid)}, shop ${payouts.shop}, community ${payouts.community} XLM`,
    };
  }
  return { status: "paid", chainStatus, payouts };
}
