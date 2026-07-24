import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { CoinDetailClient } from "@/components/CoinDetailClient";

// Shell is cached; the client fetches live numbers from the cached proxy route.
// Was 120s - lengthened since this is a dynamic route (one ISR cache entry
// per coin id visited), so the write cost multiplies with how many distinct
// coins get traffic.
export const revalidate = 300;

const CG = "https://api.coingecko.com/api/v3";
function cleanId(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80);
}

async function coinMeta(id: string): Promise<{ name: string; symbol: string } | null> {
  try {
    const r = await fetch(`${CG}/coins/${id}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`, {
      next: { revalidate: 300 },
    });
    if (!r.ok) return null;
    const j = await r.json();
    return { name: String(j?.name ?? id), symbol: String(j?.symbol ?? "").toUpperCase() };
  } catch {
    return null;
  }
}

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const params = await props.params;
  const id = cleanId(params.id);
  const m = await coinMeta(id);
  const title = m ? `${m.name} (${m.symbol}) Price, Chart & Market Data` : "Coin";
  return {
    title,
    description: m
      ? `Live ${m.name} (${m.symbol}) price, 7-day chart, market cap, supply, all-time high and an AI market take - on XYZ Crypto.`
      : "Live crypto price, chart and market data on XYZ Crypto.",
    alternates: { canonical: `/markets/${id}` },
  };
}

export default async function CoinPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const id = cleanId(params.id);
  return (
    <>
      <Navbar />
      <main className="relative min-h-screen pt-28">
        <div className="mesh" />
        <div className="relative mx-auto max-w-5xl px-4 pb-24 sm:px-6 lg:px-8">
          <CoinDetailClient id={id} />
        </div>
      </main>
    </>
  );
}
