import { NextResponse } from "next/server";
import { lastGood } from "@modules/markets/lib/last-good";

export const revalidate = 180; // 3-minute cache

interface SectorItemData {
  id: string;
  name: string;
  symbol: string;
  marketCap: number;
  change24h: number;
  volume24h: number;
  sparkline: number[];
  topCoins: string[];
}


const TARGET_CATEGORY_MAP: Record<
  string,
  { name: string; symbol: string; topCoins: string[] }
> = {
  "layer-1": { name: "Layer 1", symbol: "L1", topCoins: ["BTC", "ETH", "SOL"] },
  "decentralized-finance-defi": { name: "DeFi", symbol: "DEFI", topCoins: ["UNI", "AAVE", "MKR"] },
  "artificial-intelligence": { name: "AI & Data", symbol: "AI", topCoins: ["TAO", "NEAR", "FET"] },
  "layer-2": { name: "Layer 2", symbol: "L2", topCoins: ["ARB", "OP", "STRK"] },
  "meme-token": { name: "Meme", symbol: "MEME", topCoins: ["DOGE", "SHIB", "PEPE"] },
  depin: { name: "DePIN", symbol: "DEPIN", topCoins: ["FIL", "RENDER", "HNT"] },
  "real-world-assets-rwa": { name: "RWA", symbol: "RWA", topCoins: ["ONDO", "MKR", "PENDLE"] },
  gaming: { name: "Gaming", symbol: "GAME", topCoins: ["IMX", "GALA", "BEAM"] },
  "decentralized-exchange": { name: "DEX", symbol: "DEX", topCoins: ["UNI", "CAKE", "RAY"] },
  "liquid-staking-governance-tokens": { name: "Liquid Staking", symbol: "LSD", topCoins: ["LDO", "RPL", "JTO"] },
  perpetuals: { name: "Perp DEX", symbol: "PERP", topCoins: ["HYPE", "DYDX", "GMX"] },
};

export async function GET() {
  try {
    // Remembered while good (last-good.ts): a refused CoinGecko call serves the
    // previous categories for up to an hour instead of an empty heatmap.
    const data = await lastGood(
      "sectors:categories",
      async () => {
        const res = await fetch("https://api.coingecko.com/api/v3/coins/categories", {
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(8000),
          next: { revalidate },
        });
        if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
        const all: any[] = await res.json();
        if (!Array.isArray(all) || !all.length) throw new Error("Empty categories response");
        // Keep only the categories this route reads, so what is remembered stays small.
        return all.filter((c) => c && c.id in TARGET_CATEGORY_MAP);
      },
      { isGood: (v) => v.length > 0, maxAgeMs: 60 * 60_000 }
    );

    const categoriesById = new Map<string, any>();
    for (const c of data) {
      if (c && c.id) {
        categoriesById.set(c.id, c);
      }
    }

    const sectors: SectorItemData[] = [];

    for (const [id, meta] of Object.entries(TARGET_CATEGORY_MAP)) {
      const liveCat = categoriesById.get(id);

      // Live CoinGecko category figures only. No sample sectors and no drawn
      // sparkline: the categories endpoint has no history, so none is shown.
      const mcap = Number(liveCat?.market_cap);
      if (!liveCat || !(mcap > 0)) continue;
      const change = Number(liveCat.market_cap_change_24h);
      sectors.push({
        id,
        name: meta.name,
        symbol: meta.symbol,
        marketCap: mcap,
        change24h: Number.isFinite(change) ? change : 0,
        volume24h: Number(liveCat.volume_24h) || 0,
        sparkline: [],
        topCoins: meta.topCoins,
      });
    }

    return NextResponse.json(
      { sectors, live: true, ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=180, stale-while-revalidate=300" } }
    );
  } catch {
    return NextResponse.json(
      { sectors: [], live: false, ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=60" } }
    );
  }
}
