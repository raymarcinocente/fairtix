"use client";
import Link from "next/link";
import { useState } from "react";
import { useDemo, wallets, connect } from "@/lib/demo-store";
import { concerts } from "@/lib/concerts";
import { refreshRecords } from "@/lib/customer-records";

export default function PrototypeAccount({
  section = "overview",
  onWallet,
}: {
  section?: string;
  onWallet: () => void;
}) {
  const data = useDemo();
  const wallet = wallets.find((w) => w.id === data.wallet);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="account-container">
      <h1>
        {section === "transactions" ? "Transaction History" : "My Wallet"}
      </h1>
      <nav className="account-tabs" aria-label="Tickets and wallet navigation">
        {[
          ["My Tickets", "/tickets"],
          ["My Wallet", "/account/wallet"],
          ["Transactions", "/account/transactions"],
          ["Saved Concerts", "/saved"],
        ].map(([label, path]) => (
          <Link key={path} href={path}>
            {label}
          </Link>
        ))}
      </nav>
      {(error || data.error) && (
        <p role="alert" className="seat-error">
          {error || data.error}
          <button onClick={() => void refreshRecords()}>Retry</button>
        </p>
      )}
      {section !== "transactions" && (
        <section className="account-panel">
          <h2>Wallet</h2>
          <p>
            {wallet
              ? `${wallet.name}’s sample wallet · ${wallet.address}`
              : "No wallet connected."}
          </p>
          <p>Sample balance: {data.balance.toFixed(2)} XLM</p>
          <button className="button secondary" onClick={onWallet}>
            {wallet ? "Change Wallet" : "Connect Wallet"}
          </button>
          {wallet && (
            <button
              className="button quiet"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await connect(null);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Disconnect Wallet
            </button>
          )}
          <p className="field-help">
            Payments are simulated. No real funds are transferred.
          </p>
        </section>
      )}
      <section className="account-panel">
        <h2>Transactions</h2>
        {data.loading ? (
          <p>Loading transactions…</p>
        ) : !data.transactions.length ? (
          <p>No transactions yet.</p>
        ) : (
          <div className="account-bookings">
            {[...data.transactions].reverse().map((t) => (
              <article key={t.id}>
                <h3>{concerts.find((c) => c.id === t.eventId)?.title}</h3>
                <p>
                  {t.kind} · {t.amount.toFixed(2)} {t.currency} · Simulated
                  payment
                </p>
                <p>{new Date(t.createdAt).toLocaleString()}</p>
                <p className="mono">{t.reference}</p>
                <Link href="/tickets">View Ticket</Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
