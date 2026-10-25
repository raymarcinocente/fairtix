import { demoExchangeRates } from "./exchange-rates";

/**
 * Converts a USDC (= USD) total to XLM stroops at the project's fixed demo
 * rate, rounding up so the shop is never underpaid. Integer maths only.
 * Shared by the server (what is charged) and the browser (what is shown).
 */
export function usdcToStroops(total: number): bigint {
  const cents = BigInt(Math.round(total * 100));
  const usdCentsPerXlm = BigInt(Math.round(demoExchangeRates.rates.XLM.USD * 100));
  return (cents * 10_000_000n + usdCentsPerXlm - 1n) / usdCentsPerXlm;
}

export function formatStroops(stroops: bigint): string {
  const whole = stroops / 10_000_000n;
  const frac = (stroops % 10_000_000n).toString().padStart(7, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}
