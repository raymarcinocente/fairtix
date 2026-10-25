import { NextResponse } from "next/server";
import { checkOrder } from "@/lib/paiflow/checkout";
import { errorResponse, getSession, readJson, stringField } from "@/lib/paiflow/http";

// "Check payment": re-verifies the original transaction hash. Never prepares,
// signs or sends a replacement.
export async function POST(request: Request) {
  try {
    const orderId = stringField(await readJson(request), "orderId", 64);
    return NextResponse.json(await checkOrder(orderId, await getSession()));
  } catch (error) {
    return errorResponse(error);
  }
}
