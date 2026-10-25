"use client";

import { useState, useSyncExternalStore } from "react";
import { getNetworkDetails, isConnected, requestAccess, signTransaction } from "@stellar/freighter-api";

// Browser adapter: the wallet signs here; the Paiflow SDK and API token stay on
// the server. Only the order ID is kept in the browser so a reload can recover.

interface Review {
  orderId: string;
  xdr: string;
  network: string;
  networkPassphrase: string;
  expiresAt: string;
  txHash?: string;
  review: {
    walletAddress: string;
    amountXlm: string;
    maxFeeXlm: string;
    recipients: { label: string; address: string; amountXlm: string }[];
  };
}

interface Result {
  orderId: string;
  status: string;
  txHash?: string;
  chainStatus?: string;
  detail?: string;
  warning?: string;
  expired?: boolean;
  payouts?: { shop: string; community: string };
  error?: string;
}

const ORDER_KEY = "fairtix:pendingOrder";

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok && res.status !== 202) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

function storage(action: "get" | "set" | "remove", value?: string): string | null {
  try {
    if (action === "get") return localStorage.getItem(ORDER_KEY);
    if (action === "set") localStorage.setItem(ORDER_KEY, value!);
    else localStorage.removeItem(ORDER_KEY);
    window.dispatchEvent(new Event(ORDER_KEY));
  } catch {}
  return null;
}

function subscribeSavedOrder(onChange: () => void) {
  window.addEventListener(ORDER_KEY, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(ORDER_KEY, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-6)}`;

export default function CheckoutPage() {
  const [address, setAddress] = useState<string>();
  const [prepared, setPrepared] = useState<Review>();
  const [result, setResult] = useState<Result>();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const savedOrder = useSyncExternalStore(subscribeSavedOrder, () => storage("get"), () => null);


  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const connect = () =>
    run(async () => {
      if (!(await isConnected()).isConnected) throw new Error("Install and unlock the Freighter extension");
      const access = await requestAccess();
      if (access.error) throw new Error(access.error.message);
      const network = await getNetworkDetails();
      if (network.error) throw new Error(network.error.message);
      if (network.network !== "TESTNET") throw new Error("Switch Freighter to Stellar Testnet");
      setAddress(access.address);
    });

  const startOrder = () =>
    run(async () => {
      if (!address) return;
      const order = await post<{ orderId: string }>("/api/checkout/orders", { walletAddress: address });
      storage("set", order.orderId);
      setPrepared(await post<Review>("/api/checkout/prepare", { orderId: order.orderId }));
    });

  const pay = () =>
    run(async () => {
      if (!prepared || !address) return;
      if (address !== prepared.review.walletAddress) {
        throw new Error(`Connected wallet ${short(address)} does not match the order wallet ${short(prepared.review.walletAddress)}`);
      }
      if (Date.parse(prepared.expiresAt) < Date.now()) {
        throw new Error("This preparation has expired. Use Check payment; a new order should be deliberate.");
      }
      const network = await getNetworkDetails();
      if (network.networkPassphrase !== prepared.networkPassphrase) throw new Error("Freighter is on a different network");

      const signed = await signTransaction(prepared.xdr, { networkPassphrase: prepared.networkPassphrase, address });
      if (signed.error) throw new Error(signed.error.message);
      setResult(await post<Result>("/api/checkout/submit", { orderId: prepared.orderId, signedXdr: signed.signedTxXdr }));
    });

  const check = (orderId: string) =>
    run(async () => {
      const checked = await post<Result>("/api/checkout/check", { orderId });
      setResult(checked);
      if (checked.status === "paid" || checked.status === "failed") {
        storage("remove");
      }
    });

  const done = result?.status === "paid";

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-12 font-sans">
      <header>
        <h1 className="text-2xl font-semibold">Fairtix checkout</h1>
        <p className="text-sm text-zinc-500">Testnet only: 1 XLM split 90% shop / 10% community via Paiflow.</p>
      </header>

      {savedOrder && !done && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:bg-amber-950/30">
          <p>You have an unfinished order. Check it before paying again.</p>
          <button disabled={busy} onClick={() => check(savedOrder)} className="mt-2 rounded bg-amber-600 px-3 py-1.5 text-white disabled:opacity-50">
            Check payment
          </button>
        </section>
      )}

      {!address ? (
        <button disabled={busy} onClick={connect} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black">
          Connect Freighter
        </button>
      ) : (
        <p className="text-sm">Connected: <code>{short(address)}</code> on TESTNET</p>
      )}

      {address && !prepared && (
        <button disabled={busy} onClick={startOrder} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black">
          Start 1 XLM order
        </button>
      )}

      {prepared && !result && (
        <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
          <h2 className="font-semibold">Review payment</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt>Network</dt><dd className="font-semibold">TESTNET</dd>
            <dt>From</dt><dd><code>{short(prepared.review.walletAddress)}</code></dd>
            <dt>Amount</dt><dd>{prepared.review.amountXlm} XLM</dd>
            {prepared.review.recipients.map((r) => (
              <div key={r.address} className="contents">
                <dt>{r.label}</dt><dd>{r.amountXlm} XLM → <code>{short(r.address)}</code></dd>
              </div>
            ))}
            <dt>Max fee</dt><dd>{prepared.review.maxFeeXlm} XLM (in addition to the amount)</dd>
            <dt>Expires</dt><dd>{new Date(prepared.expiresAt).toLocaleTimeString()}</dd>
          </dl>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            I approve paying {prepared.review.amountXlm} XLM plus the network fee on Testnet.
          </label>
          <button disabled={busy || !consent} onClick={pay} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black">
            Sign with Freighter and pay
          </button>
        </section>
      )}

      {result && (
        <section className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
          <h2 className="font-semibold">
            {result.status === "paid" ? "Payment verified" : result.status === "failed" ? "Payment failed" : "Payment pending verification"}
          </h2>
          {result.warning && <p className="text-amber-600">{result.warning}</p>}
          {result.detail && <p className="text-zinc-500">{result.detail}</p>}
          {result.payouts && <p>Shop received {result.payouts.shop} XLM · Community received {result.payouts.community} XLM</p>}
          {result.txHash && (
            <a className="underline" target="_blank" rel="noreferrer" href={`https://stellar.expert/explorer/testnet/tx/${result.txHash}`}>
              {result.txHash.slice(0, 16)}… on Stellar Expert
            </a>
          )}
          {!done && (
            <button disabled={busy} onClick={() => check(result.orderId)} className="self-start rounded border px-3 py-1.5 disabled:opacity-50">
              Check payment
            </button>
          )}
        </section>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </main>
  );
}
