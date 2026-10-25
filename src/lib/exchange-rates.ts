export const fiatCurrencies = ["PHP", "USD", "EUR", "JPY"] as const;
export type FiatCurrency = (typeof fiatCurrencies)[number];
export type CryptoCurrency = "USDC" | "XLM";
export type ExchangeRates = {
  rates: Record<CryptoCurrency, Record<FiatCurrency, number>>;
};

// Fixed prototype rates supplied by the project owner. USDC uses 1 USD.
export const demoExchangeRates: ExchangeRates = {
  rates: {
    XLM: { PHP: 10.93, USD: 0.17, EUR: 0.15, JPY: 27 },
    USDC: { PHP: 10.93 / 0.17, USD: 1, EUR: 0.15 / 0.17, JPY: 27 / 0.17 },
  },
};

export function fiatToCrypto(amount: number, rate: number) {
  return Number.isFinite(amount) && amount >= 0 && Number.isFinite(rate) && rate > 0
    ? amount / rate
    : null;
}
