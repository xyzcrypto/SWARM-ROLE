// Markets hub — shared types + pure formatters/normalizers. Client-safe (no
// server imports) so they're used by both the API routes and the client, and are
// trivially unit-testable.

export type FearGreed = { value: number; label: string };

export type GlobalMarket = {
  marketCap: number;
  volume24h: number;
  btcDominance: number;
  ethDominance: number;
  mcapChange24h: number;
  fearGreed: FearGreed | null;
  defiMcap: number | null; // CoinMarketCap enrichment (null when no CMC key)
  stableMcap: number | null;
  gasGwei: number | null; // Ethereum base gas price (keyless RPC)
};

export type DefiProtocol = { name: string; tvl: number; chain: string; change1d: number; logo: string | null };
export type DefiChain = { name: string; tvl: number };
export type DefiMarket = {
  totalTvl: number;
  tvlTrend: number[]; // recent daily TVL values (sparkline)
  topProtocols: DefiProtocol[];
  topChains: DefiChain[];
  stableMcap: number;
};

/** Compact USD: $1.23T / $45.6B / $12.3M / $999. Returns "—" for bad input. */
export function compactUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/** Signed percent, e.g. "+2.34%" / "-1.10%". "—" for bad input. */
export function pct(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

/** Fear & Greed value (0–100) → label + tone. */
export function fngLabel(v: number): { label: string; tone: "red" | "amber" | "mint" } {
  const n = Number.isFinite(v) ? v : 50;
  if (n <= 24) return { label: "Extreme Fear", tone: "red" };
  if (n <= 44) return { label: "Fear", tone: "red" };
  if (n <= 55) return { label: "Neutral", tone: "amber" };
  if (n <= 74) return { label: "Greed", tone: "mint" };
  return { label: "Extreme Greed", tone: "mint" };
}

/** Top-N by tvl, descending; defensive against non-arrays / missing tvl. */
export function topByTvl<T extends { tvl: number }>(list: T[] | null | undefined, n: number): T[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((x) => x && Number.isFinite(x.tvl))
    .sort((a, b) => b.tvl - a.tvl)
    .slice(0, Math.max(0, n));
}

/** Generic top-N by a numeric key, descending. Skips non-finite values. */
export function topBy<T>(list: T[] | null | undefined, key: (x: T) => number, n: number): T[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((x) => x != null && Number.isFinite(key(x)))
    .sort((a, b) => key(b) - key(a))
    .slice(0, Math.max(0, n));
}

/** Format a percent that is already a fraction/number as APY, e.g. 12.3 → "12.30%". */
export function apyFmt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

/** Wei (hex or number) → gwei string, e.g. "23.4 gwei". */
export function toGwei(weiHexOrNum: string | number | null | undefined): string {
  if (weiHexOrNum == null) return "—";
  const wei = typeof weiHexOrNum === "string" ? Number.parseInt(weiHexOrNum, 16) : weiHexOrNum;
  if (!Number.isFinite(wei)) return "—";
  return `${(wei / 1e9).toFixed(1)} gwei`;
}

// --- Extra section types (Perp DEX, DEX volume, fees, yields, coins) ---
export type PerpDex = { name: string; volume24h: number; change1d: number; logo: string | null };
export type PerpMarket = { coin: string; price: number; funding: number; openInterest: number };
export type DexProtocol = { name: string; volume24h: number; change1d: number; logo: string | null };
export type FeeProtocol = { name: string; fees24h: number; logo: string | null };
export type YieldPool = { project: string; symbol: string; chain: string; apy: number; tvl: number };
export type TrendingCoin = { name: string; symbol: string; thumb: string | null; change24h: number };
export type MoverCoin = { name: string; symbol: string; image: string | null; price: number; change24h: number };
export type CoinRow = {
  rank: number;
  name: string;
  symbol: string;
  image: string | null;
  price: number;
  change1h: number;
  change24h: number;
  change7d: number;
  marketCap: number;
  volume24h: number;
  sparkline: number[];
};

/** Price with sensible precision for a coin table (more decimals for sub-$1). */
export function coinPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toPrecision(2)}`;
}

/* ---------------- Coins table sorting (pure, for the Markets Coins panel) ---------------- */

export type SortKey = "rank" | "name" | "price" | "change1h" | "change24h" | "change7d" | "marketCap" | "volume24h";
export type SortDir = "asc" | "desc";

/** Sort a coin list by a column. "name" is alphabetical; the rest are numeric.
 *  Non-mutating. Default table order is rank asc (i.e. market-cap order). */
export function sortCoins(rows: CoinRow[], key: SortKey, dir: SortDir): CoinRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (key === "name") return a.name.localeCompare(b.name);
    return (Number(a[key]) || 0) - (Number(b[key]) || 0);
  });
  return dir === "desc" ? sorted.reverse() : sorted;
}

/** The sensible default sort direction when a user first clicks a column. */
export function defaultDirFor(key: SortKey): SortDir {
  return key === "rank" || key === "name" ? "asc" : "desc";
}
