import { NextRequest, NextResponse } from "next/server";
import { ApiError } from "@/lib/mock-account-server";
import { checkPaidBooking, startPaidBooking, submitPaidBooking } from "@/lib/paid-booking";
import { errorResponse, stringField } from "@/lib/paiflow/http";

// Live seat-booking checkout through Paiflow: prepare -> (wallet signs) ->
// submit -> check. The API token never leaves the server.
const headers = { "Cache-Control": "private, no-store" };
type Context = { params: Promise<{ action: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    // JSON + exact-origin requests prevent cross-site form and fetch mutations.
    if (
      request.headers.get("origin") !== request.nextUrl.origin ||
      !request.headers.get("content-type")?.startsWith("application/json")
    )
      throw new ApiError("This request origin is not allowed.", 403);
    const raw = await request.text();
    if (raw.length > 120_000) throw new ApiError("Request is too large.", 413);
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError("Invalid request.");
    const input = body as Record<string, unknown>;

    const { action } = await context.params;
    if (action === "prepare") return NextResponse.json(await startPaidBooking(input), { headers });
    if (action === "submit") {
      const result = await submitPaidBooking(stringField(input, "orderId", 64), stringField(input, "signedXdr", 100_000));
      return NextResponse.json(result, { status: result.warning ? 202 : 200, headers });
    }
    if (action === "check")
      return NextResponse.json(await checkPaidBooking(stringField(input, "orderId", 64)), { headers });
    throw new ApiError("Not found.", 404);
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request." }, { status: 400, headers });
    return errorResponse(error);
  }
}
