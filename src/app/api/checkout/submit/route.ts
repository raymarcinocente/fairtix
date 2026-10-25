import { NextResponse } from "next/server";
import { submitOrder } from "@/lib/paiflow/checkout";
import { errorResponse, getSession, readJson, stringField } from "@/lib/paiflow/http";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const orderId = stringField(body, "orderId", 64);
    const signedXdr = stringField(body, "signedXdr", 100_000);
    const result = await submitOrder(orderId, signedXdr, await getSession());
    return NextResponse.json(result, { status: result.warning ? 202 : 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
