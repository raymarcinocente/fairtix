import { NextResponse } from "next/server";
import { PaiflowApiError } from "@paiflow/sdk";
import { checkOrder } from "@/lib/paiflow/checkout";
import { getDeployment } from "@/lib/paiflow/client";
import { assertOwner, BadRequestError, errorResponse, getSession, readJson, stringField } from "@/lib/paiflow/http";
import { assertOriginalEnvelope } from "@/lib/paiflow/envelope";
import { readOrder, withOrder } from "@/lib/paiflow/orders";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const orderId = stringField(body, "orderId", 64);
    const signedXdr = stringField(body, "signedXdr", 100_000);
    const session = await getSession();

    // Phase 1: bind the envelope to the original preparation and persist it
    // BEFORE sending. An already saved submission is never replaced.
    const alreadySubmitted = await withOrder(orderId, async (order) => {
      assertOwner(order, session);
      if (!order.prepared) throw new BadRequestError("Order has not been prepared");
      if (order.signedXdr) return { result: true };

      const { xdr, networkPassphrase } = order.prepared.data;
      const txHash = assertOriginalEnvelope(signedXdr, xdr, networkPassphrase);
      return {
        order: { ...order, signedXdr, txHash, status: "submitted", submittedAt: new Date().toISOString() },
        result: false,
      };
    });
    if (alreadySubmitted) return NextResponse.json(await checkOrder(orderId, session));

    // Phase 2: submit the saved envelope. An error does not prove nothing was
    // broadcast, so the order stays "submitted" and is recovered by its hash.
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
      return NextResponse.json(
        { orderId, status: "submitted", txHash: order.txHash, warning: "Submission uncertain. Use Check payment; do not pay again.", ...safe },
        { status: 202 },
      );
    }

    // HTTP 200 alone is not payment; run the receipt verifier.
    return NextResponse.json(await checkOrder(orderId, session));
  } catch (error) {
    return errorResponse(error);
  }
}
