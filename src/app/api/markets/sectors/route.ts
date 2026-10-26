import { NextResponse } from "next/server";

export const revalidate = 180; // 3-minute cache

export interface SectorItemData {
  id: string;
  name: string;
  symbol: string;
  marketCap: number;
  change24h: number;
  volume24h: number;
  sparkline: number[];
  topCoins: string[];
}

// Fallback curated sector seeds with realistic metrics
const FALLBACK_SECTORS: SectorItemData[] = [
  {
    id: "layer-1",
    name: "Layer 1",
    symbol: "L1",
    marketCap: 2_492_769_382_475,
    change24h: 0.60,
    volume24h: 27_896_460_896,
    sparkline: [35, 42, 38, 52, 48, 64, 72, 85, 96],
    topCoins: ["BTC", "ETH", "SOL"],
  },
  {
    id: "decentralized-finance-defi",
    name: "DeFi",
    symbol: "DEFI",
    marketCap: 88_528_567_669,
    change24h: 1.00,
    volume24h: 6_820_000_000,
    sparkline: [30, 42, 48, 54, 62, 70, 80, 89, 97],
    topCoins: ["UNI", "AAVE", "MKR"],
  },
  {
    id: "artificial-intelligence",
    name: "AI & Data",
    symbol: "AI",
    marketCap: 26_075_944_075,
    change24h: 3.23,
    volume24h: 3_120_000_000,
    sparkline: [25, 38, 50, 60, 58, 74, 82, 92, 99],
    topCoins: ["TAO", "NEAR", "FET"],
  },
  {
    id: "layer-2",
    name: "Layer 2",
    symbol: "L2",
    marketCap: 11_102_445_364,
    change24h: 1.42,
    volume24h: 1_850_000_000,
    sparkline: [40, 44, 42, 50, 48, 56, 62, 71, 80],
    topCoins: ["ARB", "OP", "STRK"],
  },
  {
    id: "meme-token",
    name: "Meme",
    symbol: "MEME",
    marketCap: 35_523_194_638,
    change24h: 1.75,
    volume24h: 4_200_000_000,
    sparkline: [50, 48, 55, 62, 58, 70, 75, 82, 90],
    topCoins: ["DOGE", "SHIB", "PEPE"],
  },
  {
    id: "depin",
    name: "DePIN",
    symbol: "DEPIN",
    marketCap: 11_291_301_940,
    change24h: 1.70,
    volume24h: 1_240_000_000,
    sparkline: [32, 38, 45, 42, 54, 60, 68, 75, 84],
    topCoins: ["FIL", "RENDER", "HNT"],
  },
  {
    id: "real-world-assets-rwa",
    name: "RWA",
    symbol: "RWA",
    marketCap: 54_329_104_942,
    change24h: 1.80,
    volume24h: 980_000_000,
    sparkline: [28, 35, 42, 48, 52, 60, 68, 74, 85],
    topCoins: ["ONDO", "MKR", "PENDLE"],
  },
  {
    id: "gaming",
    name: "Gaming",
    symbol: "GAME",
    marketCap: 4_254_665_683,
    change24h: 2.19,
    volume24h: 650_000_000,
    sparkline: [30, 36, 34, 45, 42, 50, 58, 65, 78],
    topCoins: ["IMX", "GALA", "BEAM"],
  },
  {
    id: "decentralized-exchange",
    name: "DEX",
    symbol: "DEX",
    marketCap: 39_354_944_609,
    change24h: 1.33,
    volume24h: 3_400_000_000,
    sparkline: [38, 42, 46, 52, 58, 65, 72, 80, 88],
    topCoins: ["UNI", "CAKE", "RAY"],
  },
  {
    id: "liquid-staking-governance-tokens",
    name: "Liquid Staking",
    symbol: "LSD",
    marketCap: 1_168_778_064,
    change24h: -0.85,
    volume24h: 320_000_000,
    sparkline: [55, 52, 50, 48, 46, 47, 45, 44, 42],
    topCoins: ["LDO", "RPL", "JTO"],
  },
  {
    id: "perpetuals",
    name: "Perp DEX",
    symbol: "PERP",
    marketCap: 11_200_000_000,
    change24h: 2.40,
    volume24h: 1_450_000_000,
    sparkline: [35, 40, 44, 48, 52, 60, 68, 76, 85],
    topCoins: ["HYPE", "DYDX", "GMX"],
  },
];

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
    const res = await fetch("https://api.coingecko.com/api/v3/coins/categories", {
      headers: { accept: "application/json" },
      next: { revalidate },
    });

    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data: any[] = await res.json();

    if (!Array.isArray(data) || !data.length) {
      throw new Error("Empty categories response");
    }

    const categoriesById = new Map<string, any>();
    for (const c of data) {
      if (c && c.id) {
        categoriesById.set(c.id, c);
      }
    }

    const sectors: SectorItemData[] = [];

    for (const [id, meta] of Object.entries(TARGET_CATEGORY_MAP)) {
      const liveCat = categoriesById.get(id);
      const fallback = FALLBACK_SECTORS.find((f) => f.id === id);

      if (liveCat) {
        const mcap = Number(liveCat.market_cap) || fallback?.marketCap || 1e10;
        const change = Number(liveCat.market_cap_change_24h) ?? fallback?.change24h ?? 0;
        const vol = Number(liveCat.volume_24h) || fallback?.volume24h || 1e9;

        // Generate smooth 9-point micro sparkline matching change
        const isUp = change >= 0;
        const baseSpark = isUp
          ? [30, 36, 42, 48, 54, 62, 72, 85, 96]
          : [90, 85, 78, 70, 62, 55, 48, 40, 32];

        sectors.push({
          id,
          name: meta.name,
          symbol: meta.symbol,
          marketCap: mcap,
          change24h: change,
          volume24h: vol,
          sparkline: fallback?.sparkline || baseSpark,
          topCoins: meta.topCoins,
        });
      } else if (fallback) {
        sectors.push(fallback);
      }
    }

    return NextResponse.json(
      { sectors, live: true, ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=180, stale-while-revalidate=300" } }
    );
  } catch {
    return NextResponse.json(
      { sectors: FALLBACK_SECTORS, live: false, ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=60" } }
    );
  }
}
