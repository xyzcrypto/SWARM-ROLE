import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
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
//
// ⚠️ There is deliberately NO `export const revalidate` any more, and the old
// comment above is exactly why it should never have had one. This component is
// not `async`, awaits nothing, and reads no database - so every regeneration
// produced byte-identical HTML. It carried `revalidate = 300`, which told Next
// to rebuild that unchanging shell every five minutes: **304 ISR Writes against
// 175 Reads** in Vercel analytics, for a page whose output cannot change.
//
// Without the export the page is prerendered once at build time and served from
// the CDN until the next deploy - the same shape as `/login` and `/premium`,
// which report 0 writes. Market data freshness is unaffected: every number on
// this page comes from `MarketsClient` polling the cached `/api/markets/*`
// routes, which keep their own (tested) windows.
//
// If server-side data is ever added here, this needs a window again.

export default function MarketsPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Markets", path: "/markets" }])} />
      <Navbar />
      <main className="relative min-h-screen pt-28">
        <PageBackground />
        <div className="relative mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          {/* ⚠️ No `eyebrow` here on purpose.
              It read "Live Data" as a static pill, 20px above the status line
              MarketsClient renders - two claims about the same thing, in two
              different styles, one under the other. And the static one is the
              one that can be wrong: it says "Live Data" even when every feed is
              a cached snapshot, which is the exact class of lie #316 was about.
              The one that stays knows the difference and says "Cached snapshot"
              or "Live · 2 feeds stale". */}
          <PageHeader
            title={<>Web3 <span className="text-shine">Markets</span></>}
            subtitle="The whole market at a glance - prices, dominance, sentiment and DeFi, aggregated live from CoinGecko, DefiLlama and more."
          />

          <div className="mt-12">
            <MarketsClient />
          </div>
        </div>
      </main>
    </>
  );
}
