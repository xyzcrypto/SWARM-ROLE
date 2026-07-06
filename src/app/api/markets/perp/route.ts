import { NextResponse } from "next/server";
import { topBy, type PerpDex, type PerpMarket } from "@/lib/markets";

// Perp DEX / derivatives snapshot: top perp DEXs by 24h volume (DefiLlama,
// keyless) + top live perp markets by open interest with funding rates
// (Hyperliquid public API). Graceful always-200 `live` flag.
export const revalidate = 60;

async function perpDexs(): Promise<{ dexs: PerpDex[]; totalVolume24h: number }> {
  // Exclude the (huge) chart arrays so the payload is small + fast; some hosts
  // also 403 requests without a User-Agent, so send one.
  const res = await fetch(
    "https://api.llama.fi/overview/derivatives?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true",
    { headers: { accept: "application/json", "user-agent": "xyzcrypto-markets/1.0" }, next: { revalidate } }
  );
  if (!res.ok) throw new Error(`derivatives ${res.status}`);
  const j = await res.json();
  const list: any[] = j?.protocols ?? [];
  const dexs = topBy(list, (p) => Number(p.total24h) || 0, 30).map((p: any) => ({
    name: String(p.name ?? "—"),
    volume24h: Number(p.total24h) || 0,
    change1d: Number(p.change_1d) || 0,
    logo: typeof p.logo === "string" ? p.logo : null,
  }));
  // Prefer the API's aggregate; fall back to summing the protocol list.
  const totalVolume24h = Number(j?.total24h) || list.reduce((s, p) => s + (Number(p.total24h) || 0), 0);
  return { dexs, totalVolume24h };
}

// Hyperliquid live perp markets — funding + open interest + 24h volume per coin.
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
      coin: String(u?.name ?? "—"),
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
    dexs = [{ name: "Hyperliquid", volume24h: hl.totalVolume24h, change1d: 0, logo: null }];
  }
  const totalVolume24h = dexRes.totalVolume24h || hl.totalVolume24h;
  const totalOi = hl.totalOi;
  const live = dexs.length > 0 || hl.markets.length > 0;

  return NextResponse.json(
    { dexs, markets: hl.markets, totalVolume24h, totalOi, live, ts: Date.now() },
    { headers: { "Cache-Control": live ? "public, s-maxage=60, stale-while-revalidate=180" : "public, s-maxage=20" } }
  );
}
