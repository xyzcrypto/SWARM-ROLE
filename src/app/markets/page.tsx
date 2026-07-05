import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MarketTicker } from "@/components/MarketTicker";
import { MarketsClient } from "@/components/MarketsClient";

export const metadata: Metadata = {
  title: "Markets",
  description:
    "Live Web3 market data in one place — crypto market cap, volume, BTC dominance, Fear & Greed, DeFi TVL, top protocols and chains. Powered by CoinGecko, DefiLlama and more.",
};

// The shell is static; all numbers are fetched live client-side (cached proxy
// routes), so there's nothing per-request to render here.
export const revalidate = 300;

export default function MarketsPage() {
  return (
    <>
      <Navbar />
      <MarketTicker />
      <main className="relative min-h-screen pt-14">
        <div className="mesh" />
        <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold-400">
              Live Data
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold text-zinc-50 sm:text-6xl">
              Web3 <span className="text-gold-gradient">Markets</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-zinc-400">
              The whole market at a glance — prices, dominance, sentiment and DeFi,
              aggregated live from CoinGecko, DefiLlama and more.
            </p>
          </div>

          <div className="mt-12">
            <MarketsClient />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
