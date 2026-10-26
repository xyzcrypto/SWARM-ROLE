import { NextResponse } from "next/server";
import { topBy, protocolSlug, type PerpDex, type PerpMarket } from "@/lib/markets";
import { llamaOverview, type OverviewRow } from "@modules/markets/lib/llama";
import { isKnownPerpDex } from "@modules/points/lib/perp-sources";
import {
  FEATURED_PERP_VENUES,
  buildPerpVenues,
  coingeckoDerivativeRows,
  llamaSummary,
  type LlamaRow,
} from "@modules/markets/lib/perp-venues";

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

const EXCLUDED = /^(dydx|jupiter)/i;

async function perpDexs(): Promise<{ dexs: PerpDex[]; totalVolume24h: number; rows: OverviewRow[] }> {
  // Exclude the (huge) chart arrays so the payload is small + fast; some hosts
  // also 403 requests without a User-Agent, so send one.
  // Shared with sitemap.ts through llama.ts - the >2 MB body was never cacheable,
  // so both used to download it separately. The aggregate fallback (sum of the
  // full list, not the trimmed one) is computed there too.
  const { protocols, total24h } = await llamaOverview("derivatives");
  // dYdX and Jupiter are left off the board at the owner's request (2026-10-26).
  const dexs = topBy(protocols.filter((p) => !EXCLUDED.test(p.slug ?? p.name)), (p) => p.total24h, 30).map((p) => ({
    slug: protocolSlug(p.slug ?? undefined, p.name),
    name: p.name,
    volume24h: p.total24h,
    change1d: p.change1d,
    logo: p.logo,
  }));
  return { dexs, totalVolume24h: total24h, rows: protocols };
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

    // ⚠️ These two arrays are joined BY POSITION, and that is Hyperliquid's
    // documented contract for `metaAndAssetCtxs` - `assetCtxs[i]` describes
    // `meta.universe[i]`. It cannot be done any other way here: an assetCtx
    // carries `markPx`, `funding`, `openInterest` and friends, and no name to
    // match on.
    //
    // What was missing is what happens when the contract does NOT hold. The map
    // ran over `universe` and indexed blindly into `ctxs`, so a short or
    // reordered `ctxs` produced a full table of rows whose price, funding and
    // open interest belonged to a different coin - or were silently zero - with
    // no throw and no `live: false`. Wrong financial data presented as right.
    //
    // A length mismatch means the assumption has broken, so the honest answer
    // is no perp data rather than confidently mismatched perp data.
    if (universe.length !== ctxs.length) {
      return { markets: [], totalVolume24h: 0, totalOi: 0 };
    }

    const rows: PerpMarket[] = universe
      .map((u, i) => {
        const c = ctxs[i];
        const price = Number(c?.markPx) || 0;
        return {
          coin: String(u?.name ?? "-"),
          price,
          funding: Number(c?.funding) || 0, // hourly funding fraction
          openInterest: (Number(c?.openInterest) || 0) * price,
        };
      })
      // A row with no price is not a market anyone can read - it renders as
      // "$0" beside a real funding rate, which is worse than being absent.
      .filter((r) => r.price > 0 && r.coin !== "-");
    const totalVolume24h = ctxs.reduce((s, c) => s + (Number(c?.dayNtlVlm) || 0), 0);
    const totalOi = rows.reduce((s, r) => s + r.openInterest, 0);
    return { markets: topBy(rows, (r) => r.openInterest, 20), totalVolume24h, totalOi };
  } catch {
    return { markets: [], totalVolume24h: 0, totalOi: 0 };
  }
}

export async function GET() {
  // Independent sources so one flaky upstream can't blank the board.
  const [dexRes, hl, cg] = await Promise.all([
    perpDexs().catch(() => ({ dexs: [] as PerpDex[], totalVolume24h: 0, rows: [] as OverviewRow[] })),
    hyperliquid().catch(() => ({ markets: [] as PerpMarket[], totalVolume24h: 0, totalOi: 0 })),
    coingeckoDerivativeRows(revalidate).catch(() => []),
  ]);

  // The Perp DEX tab's list: DefiLlama's cross-venue ranking when it answers.
  // When it refuses (it has in production), CoinGecko's derivatives list filtered
  // to venues that are known perp DEXs - never CEXs - so the tab is not reduced
  // to a single Hyperliquid row. CoinGecko publishes no 24h change: null, so the
  // client shows "-" rather than 0%.
  let dexs: PerpDex[] = dexRes.dexs;
  if (!dexs.length) {
    const seen = new Set<string>();
    dexs = cg
      .filter((r) => isKnownPerpDex(r.name) && !EXCLUDED.test(r.key) && !seen.has(r.key) && seen.add(r.key))
      .slice(0, 30)
      .map((r) => ({ slug: r.key, name: r.name.replace(/\s*\([^)]*\)\s*/g, " ").trim(), volume24h: r.volume24h, change1d: Number.NaN, logo: r.logo }));
  }

  // The leaderboard's seven venues. Any venue still without volume gets one
  // small DefiLlama summary call (TXFlow is listed on DefiLlama only).
  let llamaRows: LlamaRow[] = dexRes.rows;
  const hlTotals = { volume24h: hl.totalVolume24h, openInterest: hl.totalOi };
  let venues = buildPerpVenues(llamaRows, cg, hlTotals);
  const missing = FEATURED_PERP_VENUES.filter((v) => v.llamaSlug && venues.find((x) => x.key === v.key)?.volume24h == null);
  if (missing.length) {
    const extra = (await Promise.all(missing.map((v) => llamaSummary(v.llamaSlug as string, revalidate)))).filter(
      (r): r is LlamaRow => r != null
    );
    if (extra.length) {
      llamaRows = [...llamaRows, ...extra];
      venues = buildPerpVenues(llamaRows, cg, hlTotals);
    }
  }

  const totalVolume24h = dexRes.totalVolume24h || hl.totalVolume24h;
  const totalOi = hl.totalOi;
  const live = dexs.length > 0 || hl.markets.length > 0 || venues.some((v) => v.volume24h != null);

  return NextResponse.json(
    { dexs, venues, markets: hl.markets, totalVolume24h, totalOi, live, ts: Date.now() },
    { headers: { "Cache-Control": live ? "public, s-maxage=200, stale-while-revalidate=300" : "public, s-maxage=30" } }
  );
}
