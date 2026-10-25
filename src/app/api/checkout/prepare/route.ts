import { NextResponse } from "next/server";
import { orderReview, prepareOrder } from "@/lib/paiflow/checkout";
import { errorResponse, getSession, readJson, stringField } from "@/lib/paiflow/http";

export async function POST(request: Request) {
  try {
    const orderId = stringField(await readJson(request), "orderId", 64);
    const order = await prepareOrder(orderId, await getSession());
    return NextResponse.json(orderReview(order));
  } catch (error) {
    return errorResponse(error);
  }
}
