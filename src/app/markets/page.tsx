import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { MarketsClient } from "@/components/MarketsClient";
import { PageBackground } from "@/components/PageBackground";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { pageSeo } from "@/lib/seo";

export const metadata: Metadata = pageSeo({
  title: "Markets",
  description:
    "Live Web3 market data in one place - crypto market cap, volume, BTC dominance, Fear & Greed, DeFi TVL, top protocols and chains. Powered by CoinGecko, DefiLlama and more.",
  path: "/markets",
});

export default function MarketsPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Markets", path: "/markets" }])} />
      <Navbar />
      <main className="relative min-h-screen pt-20 sm:pt-24 pb-24 sm:pb-16 bg-[#e9edf4] dark:bg-[#0c0e14] text-zinc-900 dark:text-zinc-100 selection:bg-amber-500/25 overflow-x-clip">
        <PageBackground />
        {/* Soft Neumorphic Studio Lighting: Directional Top-Left Soft Ambience */}
        <div aria-hidden className="pointer-events-none absolute -left-40 top-0 h-[37.5rem] w-[37.5rem] rounded-full bg-gradient-to-br from-amber-400/[0.06] via-gold-500/[0.03] to-transparent blur-[140px]" />
        <div aria-hidden className="pointer-events-none absolute right-0 top-1/3 h-[31.25rem] w-[31.25rem] rounded-full bg-gradient-to-bl from-indigo-500/[0.05] via-purple-500/[0.02] to-transparent blur-[140px]" />
        <div className="relative mx-auto max-w-[90rem] px-3 sm:px-[1.125rem]">
          <MarketsClient />
        </div>
      </main>
    </>
  );
}
