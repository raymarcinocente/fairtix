"use client";
import { useSyncExternalStore } from "react";
import { currentAccount, demoApi } from "./auth-client";
import type { Ticket } from "./demo-store";
import type { ShowcaseBooking } from "./showcase-store";
import { applyServerSeating } from "./seating-store";
import type { EventSeating, VenueLayout } from "./seating-data";
import type { Transaction } from "./auth-types";
type Records = {
  loading: boolean;
  error: string;
  transactions: Transaction[];
  tickets: Ticket[];
  market: Ticket[];
  soldCount: number;
  bookings: ShowcaseBooking[];
  inventory: { eventId: string; seats: string[] }[];
  balance: number;
  history: { id: string; ok: boolean; message: string }[];
};
const initial: Records = {
  loading: true,
  error: "",
  transactions: [],
  tickets: [],
  market: [],
  soldCount: 0,
  bookings: [],
  inventory: [],
  balance: 10,
  history: [],
};
let state = initial;
let generation = 0;
const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((fn) => fn());
}
export function useRecords() {
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
export function records() {
  return state;
}
export function clearRecords() {
  generation++;
  state = {
    ...initial,
    inventory: state.inventory,
    soldCount: state.soldCount,
  };
  emit();
}
export async function refreshRecords() {
  const run = ++generation;
  const user = currentAccount();
  try {
    const [publicData, privateData] = await Promise.all([
      demoApi<
        Pick<Records, "inventory" | "market" | "soldCount"> & {
          events: EventSeating[];
          venues: VenueLayout[];
        }
      >("inventory"),
      user
        ? demoApi<
            Pick<
              Records,
              "bookings" | "tickets" | "balance" | "history" | "transactions"
            >
          >("records")
        : Promise.resolve({
            transactions: [],
            bookings: [],
            tickets: [],
            balance: 10,
            history: [],
          }),
    ]);
    if (run !== generation || currentAccount()?.id !== user?.id) return;
    applyServerSeating(publicData.events, publicData.venues);
    state = { ...publicData, ...privateData, loading: false, error: "" };
    emit();
  } catch (e) {
    if (run === generation) {
      state = {
        ...initial,
        inventory: state.inventory,
        loading: false,
        error:
          e instanceof Error ? e.message : "Unable to load account records.",
      };
      emit();
    }
  }
}
