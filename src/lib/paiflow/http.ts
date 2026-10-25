import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { PaiflowApiError, PaiflowTransportError } from "@paiflow/sdk";
import { EnvelopeMismatchError } from "./envelope";
import { OrderNotFoundError } from "./orders";

// Placeholder ownership: an httpOnly browser session cookie. Replace with your
// app's real user authentication when Fairtix gets accounts.
const SESSION_COOKIE = "fairtix_session";

export async function getSession(create = false): Promise<string | undefined> {
  const jar = await cookies();
  const existing = jar.get(SESSION_COOKIE)?.value;
  if (existing || !create) return existing;
  const session = randomUUID();
  jar.set(SESSION_COOKIE, session, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/" });
  return session;
}

export class BadRequestError extends Error {}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {}
  throw new BadRequestError("Expected a JSON object body");
}

export function stringField(body: Record<string, unknown>, key: string, max = 200_000): string {
  const value = body[key];
  if (typeof value !== "string" || value.length === 0 || value.length > max) {
    throw new BadRequestError(`Invalid ${key}`);
  }
  return value;
}

/** Maps errors to safe responses. Never echoes tokens, envelopes or raw bodies. */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof BadRequestError) return NextResponse.json({ error: error.message }, { status: 400 });
  if (error instanceof OrderNotFoundError) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (error instanceof EnvelopeMismatchError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof PaiflowApiError) {
    console.error("Paiflow API error", { status: error.status, code: error.code, requestId: error.metadata.requestId });
    const status = error.status === 422 || error.status === 429 ? error.status : 502;
    return NextResponse.json(
      { error: error.message, code: error.code, requestId: error.metadata.requestId },
      { status, headers: error.metadata.retryAfter ? { "Retry-After": error.metadata.retryAfter } : undefined },
    );
  }
  if (error instanceof PaiflowTransportError) {
    console.error("Paiflow transport error", { name: error.name });
    return NextResponse.json({ error: "Paiflow is unreachable; your order is kept. Check payment again shortly." }, { status: 502 });
  }
  console.error("Checkout error", error instanceof Error ? error.message : error);
  return NextResponse.json({ error: "Something went wrong; your order is kept." }, { status: 500 });
}
