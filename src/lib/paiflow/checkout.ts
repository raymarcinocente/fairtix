import "server-only";
import { OrderNotFoundError, type OrderStatus, withOrder } from "./orders";
import { verifyOrder, type Verification } from "./verify";

export interface CheckResult extends Partial<Omit<Verification, "status">> {
  orderId: string;
  status: OrderStatus;
  txHash?: string;
  expired?: boolean;
}

/** Runs the receipt verifier on the order's original hash and records the result. */
export async function checkOrder(orderId: string, session: string | undefined): Promise<CheckResult> {
  return withOrder<CheckResult>(orderId, async (order) => {
    if (!session || order.ownerSession !== session) throw new OrderNotFoundError();
    const base = { orderId: order.id, txHash: order.txHash };

    // Paid is final; never re-open or re-send it.
    if (order.status === "paid") return { result: { ...base, status: order.status } };

    if (!order.txHash || !order.signedXdr) {
      // A lost signing response is not proof that nothing happened, so the
      // order is kept for recovery rather than replaced.
      const expired = order.prepared && Date.parse(order.prepared.data.expiresAt) < Date.now();
      const detail = expired
        ? "Preparation expired with no saved signature. If your wallet may have signed, contact support with the order ID before paying again."
        : "Not yet signed.";
      return { result: { ...base, status: order.status, expired: Boolean(expired), detail } };
    }

    const verification = await verifyOrder(order);
    const status = verification.status === "failed" || verification.status === "paid" ? verification.status : "pending_verification";
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
