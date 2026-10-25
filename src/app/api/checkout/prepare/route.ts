import { NextResponse } from "next/server";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import { getDeployment } from "@/lib/paiflow/client";
import { expectedPayouts, formatXlm, getPaiflowConfig } from "@/lib/paiflow/config";
import { assertOwner, BadRequestError, errorResponse, getSession, readJson, stringField } from "@/lib/paiflow/http";
import { transactionHash } from "@/lib/paiflow/envelope";
import { type Order, withOrder } from "@/lib/paiflow/orders";

export async function POST(request: Request) {
  try {
    const orderId = stringField(await readJson(request), "orderId", 64);
    const session = await getSession();

    const order = await withOrder(orderId, async (order) => {
      assertOwner(order, session);
      // A repeated request returns the original preparation, never a new payment.
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

    return NextResponse.json(review(order));
  } catch (error) {
    return errorResponse(error);
  }
}

/** Unsigned XDR plus trusted review details for the consent screen. No credentials. */
function review(order: Order) {
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
