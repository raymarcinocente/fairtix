"use client";
import { useSyncExternalStore } from "react";
import type { Account } from "./auth-types";
export async function demoApi<T = Record<string, unknown>>(
  action: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api/demo/${action}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Unable to complete this request.");
  return data;
}
// Anonymous prototype storage transport; no login or credentials.
export interface PrototypeAdapter {
  session(): Promise<{ user: Account | null }>;
  action(
    action: string,
    body: unknown,
  ): Promise<{ user?: Account | null; message?: string }>;
}
export const prototypeAdapter: PrototypeAdapter = {
  session: () => demoApi("prototype", {}),
  action: (action, body) => demoApi(`auth/${action}`, body),
};
const initial = {
  user: null as Account | null,
  ready: false,
  error: "",
  identityVersion: 0,
};
let state = initial;
let revision = 0;
const listeners = new Set<() => void>();
export function useAuth() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => state,
    () => initial,
  );
}
function emit() {
  listeners.forEach((fn) => fn());
}
export async function refreshAuth() {
  const call = ++revision;
  try {
    const result = await prototypeAdapter.session();
    if (call !== revision) return;
    state = {
      user: result.user,
      ready: true,
      error: "",
      identityVersion:
        state.identityVersion +
        (state.ready && state.user?.id !== result.user?.id ? 1 : 0),
    };
  } catch (e) {
    if (call !== revision) return;
    state = {
      user: null,
      ready: true,
      error: e instanceof Error ? e.message : "Unable to load session.",
      identityVersion: state.identityVersion + (state.user ? 1 : 0),
    };
  }
  emit();
}
export async function accountAction(action: string, body: unknown = {}) {
  revision++;
  const result = await prototypeAdapter.action(action, body);
  if ("user" in result) {
    revision++;
    state = {
      user: result.user || null,
      ready: true,
      error: "",
      identityVersion:
        state.identityVersion + (state.user?.id !== result.user?.id ? 1 : 0),
    };
    emit();
    window.dispatchEvent(new Event("fairtix-account"));
  } else if (action === "verify" || action === "reset") {
    await refreshAuth();
    window.dispatchEvent(new Event("fairtix-account"));
  }
  return result;
}
export function currentAccount() {
  return state.user;
}
