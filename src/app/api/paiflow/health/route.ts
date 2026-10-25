import { NextResponse } from "next/server";
import { getCapabilities } from "@/lib/paiflow/client";
import { errorResponse } from "@/lib/paiflow/http";

// Step 8 checkpoint: the backend can read the intended testnet deployment.
// Returns non-secret metadata only.
export async function GET() {
  try {
    const capabilities = await getCapabilities();
    return NextResponse.json({
      ok: true,
      deploymentId: capabilities.deploymentId,
      network: capabilities.network,
      triggerType: capabilities.triggerType,
      inputAsset: capabilities.inputAsset,
      execute: capabilities.operations.execute,
    });
  } catch (error) {
    if (error instanceof Error && /configuration|deployment and token|testnet|execute/.test(error.message)) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return errorResponse(error);
  }
}
