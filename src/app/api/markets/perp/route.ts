import { NextResponse } from "next/server";
import { topBy, protocolSlug, type PerpDex, type PerpMarket } from "@/lib/markets";
import { llamaOverview } from "@modules/markets/lib/llama";

// Perp DEX / derivatives snapshot: top perp DEXs by 24h volume (DefiLlama,
// keyless) + top live perp markets by open interest with funding rates
// (Hyperliquid public API). Graceful always-200 `live` flag.
// Was 60s - lengthened along with the other markets routes to stay well under
// Vercel's free-tier ISR Writes quota.
// COUPLED to the poll interval in MarketsClient.tsx: this window must be >=
// how often the client refetches, or every poll lands on an expired window
// and regenerates the route (ISR Writes + Fluid CPU). Pinned by
// src/lib/__tests__/markets-poll-alignment.test.ts - change both together.
export const revalidate = 200;

async function perpDexs(): Promise<{ dexs: PerpDex[]; totalVolume24h: number }> {
  // Exclude the (huge) chart arrays so the payload is small + fast; some hosts
  // also 403 requests without a User-Agent, so send one.
  // Shared with sitemap.ts through llama.ts - the >2 MB body was never cacheable,
  // so both used to download it separately. The aggregate fallback (sum of the
  // full list, not the trimmed one) is computed there too.
  const { protocols, total24h } = await llamaOverview("derivatives");
  const dexs = topBy(protocols, (p) => p.total24h, 30).map((p) => ({
    slug: protocolSlug(p.slug ?? undefined, p.name),
    name: p.name,
    volume24h: p.total24h,
    change1d: p.change1d,
    logo: p.logo,
  }));
  return { dexs, totalVolume24h: total24h };
}

// Hyperliquid live perp markets - funding + open interest + 24h volume per coin.
// Returns the top markets plus venue totals (used as a reliable fallback for the
// aggregate volume/OI numbers when the DefiLlama overview is unavailable).
async function hyperliquid(): Promise<{ markets: PerpMarket[]; totalVolume24h: number; totalOi: number }> {
  try {
    const res = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "metaAndAssetCtxs" }),
      next: { revalidate },
    });
    if (!res.ok) return { markets: [], totalVolume24h: 0, totalOi: 0 };
    const data = await res.json();
    const universe: any[] = data?.[0]?.universe ?? [];
    const ctxs: any[] = data?.[1] ?? [];
    const rows: PerpMarket[] = universe.map((u, i) => ({
      coin: String(u?.name ?? "-"),
      price: Number(ctxs[i]?.markPx) || 0,
      funding: Number(ctxs[i]?.funding) || 0, // hourly funding fraction
      openInterest: (Number(ctxs[i]?.openInterest) || 0) * (Number(ctxs[i]?.markPx) || 0),
    }));
    const totalVolume24h = ctxs.reduce((s, c) => s + (Number(c?.dayNtlVlm) || 0), 0);
    const totalOi = rows.reduce((s, r) => s + r.openInterest, 0);
    return { markets: topBy(rows, (r) => r.openInterest, 20), totalVolume24h, totalOi };
  } catch {
    return { markets: [], totalVolume24h: 0, totalOi: 0 };
  }
}

export async function GET() {
  // Both sources are independent so one flaky upstream can't blank the tab.
  const [dexRes, hl] = await Promise.all([
    perpDexs().catch(() => ({ dexs: [] as PerpDex[], totalVolume24h: 0 })),
    hyperliquid().catch(() => ({ markets: [] as PerpMarket[], totalVolume24h: 0, totalOi: 0 })),
  ]);

  // Prefer DefiLlama's cross-venue rankings; if it's down, still surface
  // Hyperliquid as a single entry so the "top perp DEXs" list is never empty.
  let dexs = dexRes.dexs;
  if (!dexs.length && hl.totalVolume24h > 0) {
    dexs = [{ slug: "hyperliquid", name: "Hyperliquid", volume24h: hl.totalVolume24h, change1d: 0, logo: null }];
  }
  const totalVolume24h = dexRes.totalVolume24h || hl.totalVolume24h;
  const totalOi = hl.totalOi;
  const live = dexs.length > 0 || hl.markets.length > 0;

  return NextResponse.json(
    { dexs, markets: hl.markets, totalVolume24h, totalOi, live, ts: Date.now() },
    { headers: { "Cache-Control": live ? "public, s-maxage=200, stale-while-revalidate=300" : "public, s-maxage=30" } }
  );
}
