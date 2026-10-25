import { NextResponse } from "next/server";
import { StrKey } from "@stellar/stellar-sdk";
import { getPaiflowConfig, ORDER_AMOUNT_STROOPS } from "@/lib/paiflow/config";
import { BadRequestError, errorResponse, getSession, readJson, stringField } from "@/lib/paiflow/http";
import { createOrder } from "@/lib/paiflow/orders";

// Creates a server-priced order bound to this deployment, network and wallet.
// The browser never chooses the price, deployment or network.
export async function POST(request: Request) {
  try {
    const walletAddress = stringField(await readJson(request), "walletAddress", 56);
    if (!StrKey.isValidEd25519PublicKey(walletAddress)) throw new BadRequestError("Invalid walletAddress");

    const { deploymentId } = getPaiflowConfig();
    const session = (await getSession(true))!;
    const order = await createOrder({
      ownerSession: session,
      deploymentId,
      network: "testnet",
      walletAddress,
      amountStroops: ORDER_AMOUNT_STROOPS.toString(),
    });
    return NextResponse.json({ orderId: order.id, status: order.status });
  } catch (error) {
    return errorResponse(error);
  }
}
