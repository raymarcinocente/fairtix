"use client";
import { useId, useRef, useState } from "react";
import { demoExchangeRates, fiatCurrencies, fiatToCrypto, type CryptoCurrency, type FiatCurrency } from "@/lib/exchange-rates";
import { useDemo } from "@/lib/demo-store";
import { demoApi } from "@/lib/auth-client";
import { refreshRecords } from "@/lib/customer-records";

export default function CurrencyConverter({ total, asset = "USDC" }: { total?: number; asset?: CryptoCurrency }) {
  const id = useId();
  const [currency, setCurrency] = useState<FiatCurrency>("PHP");
  const [amount, setAmount] = useState("1000");
  const [target, setTarget] = useState<CryptoCurrency>(asset);
  const [fundingMethod, setFundingMethod] = useState<"gcash" | "mastercard">("gcash");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const request = useRef<{ key: string; id: string } | null>(null);
  const wallet = useDemo();
  const rates = demoExchangeRates;
  const value = amount.trim() ? Number(amount) : NaN;
  const valid = Number.isFinite(value) && value >= 0;
  const formatFiat = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency }).format(value);
  return <section className="currency-converter" aria-label="Currency converter">
    <h3>Currency Converter</h3>
    <fieldset className="conversion-funding" disabled={busy}>
      <legend>Payment Method</legend>
      {(["gcash", "mastercard"] as const).map((method) => <label key={method} className={fundingMethod === method ? "selected" : ""}>
        <input type="radio" name={`${id}-funding`} value={method} checked={fundingMethod === method} onChange={() => {
          setFundingMethod(method); if (method === "gcash") setCurrency("PHP"); setMessage(""); setError("");
        }} />
        {method === "gcash" ? "GCash" : "Mastercard"}
        <small>Demo</small>
      </label>)}
    </fieldset>
    <p className="conversion-note">Demo mode. No GCash login, card details, or payment is required.</p>
    {rates && total !== undefined && <p className="conversion-order">
      Order total: {total.toFixed(asset === "XLM" ? 4 : 2)} {asset} ≈ <strong>{formatFiat(total * rates.rates[asset][currency])}</strong>
    </p>}
    <div className="conversion-inputs">
      <label htmlFor={`${id}-amount`}>Amount
        <input id={`${id}-amount`} disabled={busy} type="number" min="0" max="1000000" step="any" inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); setMessage(""); setError(""); }} />
      </label>
      <label htmlFor={`${id}-currency`}>Currency
        <select id={`${id}-currency`} disabled={busy || fundingMethod === "gcash"} aria-label="Currency" value={currency} onChange={(event) => { setCurrency(event.target.value as FiatCurrency); setMessage(""); setError(""); }}>
          {fiatCurrencies.map((code) => <option key={code}>{code}</option>)}
        </select>
      </label>
    </div>
    {fundingMethod === "gcash" && <p className="conversion-note">GCash demo payments use PHP. Select Mastercard for other currencies.</p>}
    {!valid && amount !== "" && <p role="alert">Enter an amount of zero or more.</p>}
    {rates && <>
      <div className="conversion-results" aria-live="polite">
        {(["USDC", "XLM"] as const).map((symbol) => {
          const result = valid ? fiatToCrypto(value, rates.rates[symbol][currency]) : null;
          return <div key={symbol}><span>{symbol}</span><strong>{result === null ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: symbol === "USDC" ? 4 : 7 }).format(result)}</strong></div>;
        })}
      </div>
      <p className="conversion-note">Fixed demo rates: 1 XLM ≈ ₱10.93 / $0.17 / €0.15 / ¥27. 1 USDC = $1.</p>
    </>}
    <div className="conversion-inputs conversion-credit">
      <label htmlFor={`${id}-asset`}>Add to wallet as
        <select id={`${id}-asset`} aria-label="Add to wallet as" disabled={busy} value={target} onChange={(event) => { setTarget(event.target.value as CryptoCurrency); setMessage(""); setError(""); }}>
          <option value="USDC">USDC</option><option value="XLM">XLM</option>
        </select>
      </label>
    </div>
    <button type="button" className="button primary full" disabled={busy || !wallet.wallet || !valid || value <= 0 || value > 1000000} onClick={async () => {
      setBusy(true); setMessage(""); setError("");
      const key = JSON.stringify([value, currency, target, wallet.wallet, fundingMethod]);
      if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
      try {
        const result = await demoApi<{ credited: number; asset: CryptoCurrency }>("wallet/convert", {
          amount: value, currency, asset: target, fundingMethod, paymentMode: "demo", requestId: request.current.id,
        });
        request.current = null;
        setMessage(`${result.credited.toFixed(7)} ${result.asset} added to your sample wallet.`);
        void refreshRecords();
      } catch (e) { setError(e instanceof Error ? e.message : "Unable to convert. Please try again."); }
      finally { setBusy(false); }
    }}>{busy ? "Converting…" : "Convert and Add to Wallet"}</button>
    {!wallet.wallet && <p className="conversion-note">Connect a sample wallet to add funds.</p>}
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
    <p className="conversion-note">Demo conversion only. Credits sample funds and records a transaction. No money is charged or exchanged.</p>
  </section>;
}
