import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { RelatedResearch } from "@/modules/research/components/RelatedResearch";
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

type CoinMeta = { name: string; symbol: string };
/**
 * Three outcomes, not two.
 *
 * ⚠️ This used to collapse everything to `null`, which is fine for a title but
 * useless for deciding whether to 404: "CoinGecko says this coin does not
 * exist" and "CoinGecko did not answer" are opposite facts, and treating the
 * second as the first would 404 every real coin page during an outage - worse
 * than the soft 404 being fixed.
 *
 * `"missing"` is only ever returned for an explicit 404 from upstream.
 */
async function coinMeta(id: string): Promise<CoinMeta | "missing" | "unknown"> {
  try {
    const r = await fetch(`${CG}/coins/${id}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`, {
      next: { revalidate: 300 },
    });
    if (r.status === 404) return "missing";
    if (!r.ok) return "unknown"; // rate limit, 5xx - upstream is unwell, not the id
    const j = await r.json();
    return { name: String(j?.name ?? id), symbol: String(j?.symbol ?? "").toUpperCase() };
  } catch {
    return "unknown"; // network/abort - says nothing about the coin
  }
}

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const params = await props.params;
  const id = cleanId(params.id);
  const res = await coinMeta(id);
  const m = typeof res === "string" ? null : res;
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

  // ⚠️ A coin that does not exist must 404, not render an empty page at 200.
  //
  // This page had no `notFound()` at all, so `/markets/not-a-real-coin` returned
  // HTTP 200 with `alternates: { canonical: "/markets/not-a-real-coin" }` and a
  // client-side "Couldn't load this coin." - a textbook soft 404, indexable and
  // self-canonicalising, on the surface the comment below calls the largest
  // indexable one on the site. It also burned an ISR cache entry per garbage id
  // anyone visited, which is the multiplication risk the `revalidate` above was
  // set to contain.
  //
  // `coinMeta` is the same call `generateMetadata` already makes, and Next
  // dedupes identical fetches within a render, so this costs nothing extra.
  //
  // ONLY on an explicit 404 from upstream. A rate limit or a network failure
  // returns "unknown", and the page renders as before - the client's own error
  // state covers that case. 404-ing a real coin because CoinGecko blinked would
  // be a worse bug than the one being fixed.
  if ((await coinMeta(id)) === "missing") notFound();

  return (
    <>
      <Navbar />
      <main className="relative min-h-screen pt-28">
        <div className="mesh" />
        <div className="relative mx-auto max-w-5xl px-4 pb-24 sm:px-6 lg:px-8">
          <CoinDetailClient id={id} />
          {/* Coin pages are the largest indexable surface on the site and had
              no path into the research library at all. Server-rendered so the
              links are in the HTML a crawler sees. The id doubles as the query
              ("perp-dex" ranks the perp research). */}
          <RelatedResearch query={id.replace(/-/g, " ")} />
        </div>
      </main>
    </>
  );
}
