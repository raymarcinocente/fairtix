import "server-only";
import { PaiflowApiError } from "@paiflow/sdk";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import { getDeployment } from "./client";
import { expectedPayouts, formatXlm, getPaiflowConfig } from "./config";
import { assertOriginalEnvelope, transactionHash } from "./envelope";
import { BadRequestError } from "./http";
import { type Order, OrderNotFoundError, type OrderStatus, readOrder, withOrder } from "./orders";
import { provenNeverIncluded, verifyOrder, type Verification } from "./verify";

const FINAL = new Set<OrderStatus>(["paid", "failed", "expired", "payout_mismatch"]);

export interface CheckResult extends Partial<Omit<Verification, "status">> {
  orderId: string;
  status: OrderStatus;
  txHash?: string;
  expired?: boolean;
  warning?: string;
  code?: string;
  requestId?: string;
}

function assertOwner(order: Order, owner: string | undefined): void {
  if (!owner || order.ownerSession !== owner) throw new OrderNotFoundError();
}

/** Prepares the order's payment once; repeated calls return the original preparation. */
export async function prepareOrder(orderId: string, owner: string | undefined): Promise<Order> {
  return withOrder(orderId, async (order) => {
    assertOwner(order, owner);
    if (order.prepared) return { result: order };

    const config = getPaiflowConfig();
    if (order.deploymentId !== config.deploymentId || order.network !== "testnet") {
      throw new BadRequestError("Order is bound to a different deployment or network");
    }
    const deployment = await getDeployment();
    const prepared = await deployment.execute.prepare({
      from: order.walletAddress,
      amount: order.amountStroops,
    });
    if (prepared.data.network !== order.network) {
      throw new BadRequestError("Preparation network does not match the order");
    }
    const next: Order = {
      ...order,
      status: "prepared",
      prepared,
      txHash: transactionHash(prepared.data.xdr, prepared.data.networkPassphrase),
    };
    return { order: next, result: next };
  });
}

/** Unsigned XDR plus trusted review details for the consent screen. No credentials. */
export function orderReview(order: Order) {
  const { data } = order.prepared!;
  const { shopAddress, communityAddress } = getPaiflowConfig();
  const amount = BigInt(order.amountStroops);
  const payouts = expectedPayouts(amount);
  const fee = BigInt(TransactionBuilder.fromXDR(data.xdr, data.networkPassphrase).fee);
  return {
    orderId: order.id,
    status: order.status,
    xdr: data.xdr,
    network: data.network,
    networkPassphrase: data.networkPassphrase,
    expiresAt: data.expiresAt,
    txHash: order.txHash,
    review: {
      walletAddress: order.walletAddress,
      amountXlm: formatXlm(amount),
      maxFeeXlm: formatXlm(fee),
      recipients: [
        { label: "Shop", address: shopAddress, amountXlm: formatXlm(payouts.shop) },
        { label: "Community fund", address: communityAddress, amountXlm: formatXlm(payouts.community) },
      ],
    },
  };
}

/**
 * Binds the signed envelope to the original preparation, persists it BEFORE
 * sending, submits once and verifies. An already saved submission is never
 * replaced; an uncertain submission is recovered by its hash, never re-paid.
 */
export async function submitOrder(orderId: string, signedXdr: string, owner: string | undefined): Promise<CheckResult> {
  const alreadySubmitted = await withOrder(orderId, async (order) => {
    assertOwner(order, owner);
    if (!order.prepared) throw new BadRequestError("Order has not been prepared");
    if (order.signedXdr) return { result: true };

    const { xdr, networkPassphrase } = order.prepared.data;
    const txHash = assertOriginalEnvelope(signedXdr, xdr, networkPassphrase);
    return {
      order: { ...order, signedXdr, txHash, status: "submitted", submittedAt: new Date().toISOString() },
      result: false,
    };
  });
  if (alreadySubmitted) return checkOrder(orderId, owner);

  const order = (await readOrder(orderId))!;
  try {
    const deployment = await getDeployment();
    await deployment.execute.submit(
      { signedXdr: order.signedXdr! },
      { wait: false, preparationRequestId: order.prepared!.metadata.historyRequestId },
    );
  } catch (error) {
    const safe = error instanceof PaiflowApiError ? { code: error.code, requestId: error.metadata.requestId } : {};
    console.error("Submission uncertain; recover by hash", { orderId, txHash: order.txHash, ...safe });
    return {
      orderId,
      status: "submitted",
      txHash: order.txHash,
      warning: "Submission uncertain. Use Check payment; do not pay again.",
      ...safe,
    };
  }

  // HTTP 200 alone is not payment; run the receipt verifier.
  return checkOrder(orderId, owner);
}

/** Runs the receipt verifier on the order's original hash and records the result. */
export async function checkOrder(orderId: string, owner: string | undefined): Promise<CheckResult> {
  return withOrder<CheckResult>(orderId, async (order) => {
    assertOwner(order, owner);
    const base = { orderId: order.id, txHash: order.txHash };

    // Final states are never re-opened or re-sent.
    if (FINAL.has(order.status)) {
      return { result: { ...base, status: order.status, detail: order.lastCheck?.detail } };
    }

    if (!order.signedXdr) {
      // A lost signing response is not proof that nothing happened, so an
      // unsigned order is released only once the chain proves it can never run.
      if (await provenNeverIncluded(order)) {
        const detail = "This payment was never sent and has expired. No funds moved.";
        return {
          order: { ...order, status: "expired", lastCheck: { at: new Date().toISOString(), status: "NOT_FOUND", detail } },
          result: { ...base, status: "expired", expired: true, detail },
        };
      }
      return {
        result: {
          ...base,
          status: order.status,
          detail: "Not signed yet. If you don't sign it, it expires within a few minutes and you can pay again.",
        },
      };
    }

    const verification = await verifyOrder(order);
    const status = FINAL.has(verification.status) ? verification.status : "pending_verification";
    return {
      order: {
        ...order,
        status,
        lastCheck: { at: new Date().toISOString(), status: verification.chainStatus, detail: verification.detail },
      },
      result: { ...base, ...verification, status },
    };
  });
}
