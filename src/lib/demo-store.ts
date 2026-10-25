"use client";
import { accountAction, useAuth, demoApi } from "./auth-client";
import { useRecords, refreshRecords } from "./customer-records";
export type Ticket = {
  id: string;
  owner: string;
  status: "valid" | "listed" | "redeemed";
  price: number | null;
};
const sampleWallet = (id: string, name: string, publicKey: string) => ({
  id,
  name,
  publicKey,
  address: `${publicKey.slice(0, 4)}…${publicKey.slice(-4)}`,
});
export const wallets = [
  sampleWallet("ana", "Ana", "GDTP7VRHF37U6ZQS6TLENXGUNXHNFAQGKBB7WYPRFZLDLACQV5CVWZ5C"),
  sampleWallet("ben", "Ben", "GB4MT4IXWZJ555CJAW2HZHF43YNCUVSBBX5SDHDFUL6MRHDHEACAWVVU"),
];
export const PRICE = 1,
  CAP = 1.1,
  SUPPLY = 50;
export function useDemo() {
  const data = useRecords();
  const { user } = useAuth();
  return {
    ...data,
    wallet: user?.wallet || null,
    balances: { ana: data.balance, ben: data.balance } as Record<
      string,
      number
    >,
    nextId: data.soldCount + 1,
  };
}
export async function connect(wallet: string | null) {
  await accountAction("wallet", { wallet });
  void refreshRecords();
}
export async function resetDemo() {
  await demoApi("reset", {});
  await refreshRecords();
}
export async function buyTicket() {
  const { ticket } = await demoApi<{ ticket: Ticket }>("tickets/buy", {});
  await refreshRecords();
  return ticket;
}
export async function listTicket(id: string, price: number) {
  await demoApi("tickets/list", { id, price });
  await refreshRecords();
}
export async function cancelListing(id: string) {
  await demoApi("tickets/cancel", { id });
  await refreshRecords();
}
export async function transferTicket(id: string) {
  await demoApi("tickets/transfer", { id });
  await refreshRecords();
}
export async function scanTicket(id: string) {
  const result = await demoApi<{ ok: boolean; message: string }>("scan", {
    id,
  });
  await refreshRecords();
  return result;
}
