"use client";
import { useSyncExternalStore } from "react";
import { currentAccount, demoApi } from "./auth-client";
import type { Ticket } from "./demo-store";
import type { ShowcaseBooking } from "./showcase-store";
import { applyServerSeating } from "./seating-store";
import type { EventSeating, VenueLayout } from "./seating-data";
import type { Transaction } from "./auth-types";
import type { ResaleListing } from "./resale-types";
type Records = {
  ownResale: { id: string; bookingId: string; price: number }[];
  resale: ResaleListing[];
  loading: boolean;
  error: string;
  inventoryError: string;
  inventoryLoaded: boolean;
  transactions: Transaction[];
  tickets: Ticket[];
  market: Ticket[];
  soldCount: number;
  bookings: ShowcaseBooking[];
  inventory: { eventId: string; seats: string[] }[];
  balance: number;
  usdcBalance: number;
  history: { id: string; ok: boolean; message: string }[];
};
const initial: Records = {
  ownResale: [],
  resale: [],
  loading: true,
  error: "",
  inventoryError: "",
  inventoryLoaded: false,
  transactions: [],
  tickets: [],
  market: [],
  soldCount: 0,
  bookings: [],
  inventory: [],
  balance: 10,
  usdcBalance: 0,
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
    resale: state.resale,
    market: state.market,
    inventoryLoaded: state.inventoryLoaded,
  };
  emit();
}
export async function refreshRecords() {
  const run = ++generation;
  const user = currentAccount();
  await Promise.all([
    (async () => {
      try {
        const publicData = await demoApi<
          Pick<Records, "inventory" | "market" | "soldCount" | "resale"> & {
            events: EventSeating[];
            venues: VenueLayout[];
          }
        >("inventory");
        if (run !== generation) return;
        applyServerSeating(publicData.events, publicData.venues);
        state = { ...state, ...publicData, loading: false, inventoryLoaded: true, inventoryError: "" };
      } catch (e) {
        if (run !== generation) return;
        state = {
          ...state,
          loading: false,
          inventoryError: e instanceof Error ? e.message : "Unable to load ticket listings.",
        };
      }
      emit();
    })(),
    (async () => {
      try {
        const privateData = await (user
          ? demoApi<
              Pick<
                Records,
                "bookings" | "tickets" | "balance" | "usdcBalance" | "history" | "transactions" | "ownResale"
              >
            >("records")
          : Promise.resolve({
              transactions: [],
              ownResale: [],
              bookings: [],
              tickets: [],
              balance: 10,
              usdcBalance: 0,
              history: [],
            }));
        if (run !== generation || currentAccount()?.id !== user?.id) return;
        state = { ...state, ...privateData, error: "" };
        emit();
      } catch (e) {
        if (run !== generation || currentAccount()?.id !== user?.id) return;
        state = {
          ...state,
          error: e instanceof Error ? e.message : "Unable to load account records.",
        };
        emit();
      }
    })(),
  ]);
}
