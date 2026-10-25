"use client";
import { useSyncExternalStore } from "react";
import { type SeatTicket } from "./seating-data";
import {
  releaseSelection,
  resetSeating,
  validateSeatingBooking,
  selectionDeadline,
  getSeating,
} from "./seating-store";
import { demoApi } from "./auth-client";
import { records, useRecords, refreshRecords } from "./customer-records";
export type ShowcaseBooking = {
  id: string;
  eventId: string;
  wallet: string;
  category: string;
  seats: string[];
  subtotal: number;
  fee: number;
  total: number;
  status: "demo-confirmed";
  createdAt: string;
  entryStatus?: "redeemed";
  lineItems?: SeatTicket[];
};
let saved: string[] = [];
let loaded = false;
const empty: string[] = [];
const listeners = new Set<() => void>();
function getSaved() {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try {
      const legacy = JSON.parse(
        localStorage.getItem("fairtix-showcase-v1") || "null",
      );
      saved = JSON.parse(
        localStorage.getItem("fairtix-saved-events") ||
          JSON.stringify(legacy?.saved || []),
      );
      if (!Array.isArray(saved)) saved = [];
      saved = saved.filter((id) => typeof id === "string");
      localStorage.setItem("fairtix-saved-events", JSON.stringify(saved));
      localStorage.removeItem("fairtix-showcase-v1");
      localStorage.removeItem("fairtix-ui-demo-v1");
    } catch {
      saved = [];
    }
  }
  return saved;
}
export function useShowcase() {
  const data = useRecords();
  const list = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    getSaved,
    () => empty,
  );
  return { ...data, saved: list };
}
export function toggleSaved(id: string) {
  const current = getSaved();
  saved = current.includes(id)
    ? current.filter((v) => v !== id)
    : [...current, id];
  try {
    localStorage.setItem("fairtix-saved-events", JSON.stringify(saved));
  } catch {}
  listeners.forEach((fn) => fn());
}
export async function createShowcaseBooking(
  data: Omit<ShowcaseBooking, "id" | "createdAt" | "status"> & {
    holdSession?: string;
  },
) {
  if (!data.lineItems) throw new Error("Select your tickets again.");
  validateSeatingBooking(
    data.eventId,
    data.lineItems,
    data.holdSession || "",
    records().inventory,
  );
  const { booking } = await demoApi<{ booking: ShowcaseBooking }>("bookings", {
    eventId: data.eventId,
    seats: data.seats,
    total: data.total,
    paymentMode: "demo",
    holdSession: data.holdSession,
    holdExpiresAt: selectionDeadline(getSeating(), data.eventId),
  });
  releaseSelection(data.eventId);
  await refreshRecords();
  return booking;
}
export function resetShowcase() {
  saved = [];
  try {
    localStorage.removeItem("fairtix-saved-events");
  } catch {}
  resetSeating();
  listeners.forEach((fn) => fn());
}
export async function redeemShowcase(id: string) {
  const result = await demoApi<{ ok: boolean; message: string }>("scan", {
    id,
  });
  await refreshRecords();
  return result;
}
