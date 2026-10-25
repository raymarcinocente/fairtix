"use client";
import { useId, useState } from "react";
import { demoExchangeRates, fiatCurrencies, fiatToCrypto, type CryptoCurrency, type FiatCurrency } from "@/lib/exchange-rates";

export default function CurrencyConverter({ total, asset = "USDC" }: { total?: number; asset?: CryptoCurrency }) {
  const id = useId();
  const [currency, setCurrency] = useState<FiatCurrency>("PHP");
  const [amount, setAmount] = useState("1000");
  const rates = demoExchangeRates;
  const value = amount.trim() ? Number(amount) : NaN;
  const valid = Number.isFinite(value) && value >= 0;
  const formatFiat = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency }).format(value);
  return <section className="currency-converter" aria-label="Currency converter">
    <h3>Currency Converter</h3>
    {rates && total !== undefined && <p className="conversion-order">
      Order total: {total.toFixed(asset === "XLM" ? 4 : 2)} {asset} ≈ <strong>{formatFiat(total * rates.rates[asset][currency])}</strong>
    </p>}
    <div className="conversion-inputs">
      <label htmlFor={`${id}-amount`}>Amount
        <input id={`${id}-amount`} type="number" min="0" step="any" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </label>
      <label htmlFor={`${id}-currency`}>Currency
        <select id={`${id}-currency`} aria-label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value as FiatCurrency)}>
          {fiatCurrencies.map((code) => <option key={code}>{code}</option>)}
        </select>
      </label>
    </div>
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
    <p className="conversion-note">Estimates only. Fees are excluded. This calculator does not exchange money or change your sample balance.</p>
  </section>;
}
