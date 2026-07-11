import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MarketsClient } from "@/components/MarketsClient";
import { PageHeader } from "@/components/PageHeader";
import { PageBackground } from "@/components/PageBackground";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { pageSeo } from "@/lib/seo";

export const metadata: Metadata = pageSeo({
  title: "Markets",
  description:
    "Live Web3 market data in one place - crypto market cap, volume, BTC dominance, Fear & Greed, DeFi TVL, top protocols and chains. Powered by CoinGecko, DefiLlama and more.",
  path: "/markets",
});

// The shell is static; all numbers are fetched live client-side (cached proxy
// routes), so there's nothing per-request to render here.
export const revalidate = 300;

export default function MarketsPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Markets", path: "/markets" }])} />
      <Navbar />
      <main className="relative min-h-screen pt-28">
        <PageBackground />
        <div className="relative mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <PageHeader
            eyebrow="Live Data"
            title={<>Web3 <span className="text-shine">Markets</span></>}
            subtitle="The whole market at a glance - prices, dominance, sentiment and DeFi, aggregated live from CoinGecko, DefiLlama and more."
          />

          <div className="mt-12">
            <MarketsClient />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
