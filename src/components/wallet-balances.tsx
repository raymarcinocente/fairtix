"use client";
import { useDemo } from "@/lib/demo-store";

export default function WalletBalances() {
  const wallet = useDemo();
  const format = (amount: number) => new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  }).format(amount);
  return <section className="wallet-balances" aria-label="Wallet balances">
    <h3>Wallet Balances</h3>
    {!wallet.wallet ? <p>Connect a sample wallet to view your balances.</p> : <>
      <dl>
        <div><dt>USDC</dt><dd>{format(wallet.usdcBalance)}</dd></div>
        <div><dt>XLM</dt><dd>{format(wallet.balance)}</dd></div>
      </dl>
      <p>Sample funds</p>
    </>}
  </section>;
}
