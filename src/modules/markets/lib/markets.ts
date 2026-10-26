// Markets hub - shared types + pure formatters/normalizers. Client-safe (no
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

/** Compact Currency (USD / INR): $1.23T or ₹116.8T. Returns "-" for bad input. */
export function compactUsd(n: number | null | undefined, customCurrency?: string, customRate?: number): string {
  if (n == null || !Number.isFinite(n)) return "-";

  let currency = customCurrency;
  let rate = customRate ?? 1;
  if (!currency && typeof window !== "undefined") {
    try {
      currency = (window as any).__XYZ_CURRENCY__ || localStorage.getItem("xyz_currency") || "USD";
      rate = (window as any).__XYZ_INR_RATE__ || 95.0;
    } catch {
      currency = "USD";
    }
  }

  const val = currency === "INR" ? n * rate : n;
  const abs = Math.abs(val);
  const sym = currency === "INR" ? "₹" : "$";
  const locale = currency === "INR" ? "en-IN" : "en-US";

  if (abs >= 1e12) return `${sym}${(val / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sym}${(val / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sym}${(val / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sym}${(val / 1e3).toFixed(1)}K`;
  return `${sym}${Math.round(val).toLocaleString(locale)}`;
}

/** Signed percent, e.g. "+2.34%" / "-1.10%". "-" for bad input. */
export function pct(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "-";
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
  if (n == null || !Number.isFinite(n)) return "-";
  return `${n.toFixed(2)}%`;
}

/** Wei (hex or number) → gwei string, e.g. "23.4 gwei". */
export function toGwei(weiHexOrNum: string | number | null | undefined): string {
  if (weiHexOrNum == null) return "-";
  const wei = typeof weiHexOrNum === "string" ? Number.parseInt(weiHexOrNum, 16) : weiHexOrNum;
  if (!Number.isFinite(wei)) return "-";
  return `${(wei / 1e9).toFixed(1)} gwei`;
}

// --- Extra section types (Perp DEX, DEX volume, fees, yields, coins) ---
export type PerpDex = { slug: string; name: string; volume24h: number; change1d: number; logo: string | null };
export type PerpMarket = { coin: string; price: number; funding: number; openInterest: number };
export type DexProtocol = { slug: string; name: string; volume24h: number; change1d: number; logo: string | null };
export type FeeProtocol = { slug: string; name: string; fees24h: number; logo: string | null };
export type YieldPool = { project: string; symbol: string; chain: string; apy: number; tvl: number; logo?: string | null; sparkline?: number[] };
export type TrendingCoin = { id: string; name: string; symbol: string; thumb: string | null; change24h: number; price?: number; volume?: number; sparkline?: number[]; sparklineUrl?: string | null };
export type MoverCoin = { id: string; name: string; symbol: string; image: string | null; price: number; change24h: number; volume?: number; sparkline?: number[] };
export type CoinRow = {
  id: string; // CoinGecko id - links each row to its coin detail page
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
  /** All-time high in USD, and how far below it the price is (always <= 0). */
  ath: number;
  athChange: number;
  sparkline: number[];
};

/** Price with sensible precision for a coin table (USD or INR). */
export function coinPrice(n: number | null | undefined, customCurrency?: string, customRate?: number): string {
  if (n == null || !Number.isFinite(n)) return "-";

  let currency = customCurrency;
  let rate = customRate ?? 1;
  if (!currency && typeof window !== "undefined") {
    try {
      currency = (window as any).__XYZ_CURRENCY__ || localStorage.getItem("xyz_currency") || "USD";
      rate = (window as any).__XYZ_INR_RATE__ || 95.0;
    } catch {
      currency = "USD";
    }
  }

  const val = currency === "INR" ? n * rate : n;
  const sym = currency === "INR" ? "₹" : "$";
  const locale = currency === "INR" ? "en-IN" : "en-US";

  if (currency === "INR") {
    if (val >= 100_000) return `${sym}${val.toLocaleString(locale, { maximumFractionDigits: 0 })}`;
    if (val >= 1) return `${sym}${val.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (val >= 0.01) return `${sym}${val.toFixed(4)}`;
    return `${sym}${val.toPrecision(2)}`;
  } else {
    if (val >= 1000) return `${sym}${val.toLocaleString(locale, { maximumFractionDigits: 0 })}`;
    if (val >= 1) return `${sym}${val.toLocaleString(locale, { maximumFractionDigits: 2 })}`;
    if (val >= 0.01) return `${sym}${val.toFixed(4)}`;
    return `${sym}${val.toPrecision(2)}`;
  }
}

/* ---------------- Coins table sorting (pure, for the Markets Coins panel) ---------------- */

export type SortKey = "rank" | "name" | "price" | "change1h" | "change24h" | "change7d" | "marketCap" | "volume24h" | "athChange";
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

/** DeFiLlama protocol slug: prefer the API's own slug, else derive one from the
 *  name (lowercase, spaces/punctuation → single dashes). Used to link protocol
 *  rows to their detail page. */
export function protocolSlug(apiSlug: unknown, name: string): string {
  const s = typeof apiSlug === "string" ? apiSlug.trim().toLowerCase() : "";
  if (s) return s;
  return String(name || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * The category chips the markets table offers, as CoinGecko's own category ids.
 *
 * Lives here rather than in the route because both sides need it and the client
 * must not import a route module - that would drag `NextResponse` and anything
 * else server-side into the browser bundle, which is the class of mistake
 * `env.ts` gained `import "server-only"` to make impossible.
 *
 * A fixed list rather than `/coins/categories`: that returns ~300, and a filter
 * with 300 options is not a filter. These ids are stable.
 */
export const MARKET_CATEGORIES = [
  { id: "layer-1", label: "Layer 1" },
  { id: "layer-2", label: "Layer 2" },
  { id: "decentralized-finance-defi", label: "DeFi" },
  { id: "meme-token", label: "Meme" },
  { id: "artificial-intelligence", label: "AI" },
  { id: "gaming", label: "Gaming" },
  { id: "real-world-assets-rwa", label: "RWA" },
  { id: "stablecoins", label: "Stablecoins" },
] as const;

/**
 * One row per coin, and no two rows that read the same.
 *
 * CoinGecko's trending list can hold Bitcoin and an unrelated token whose
 * ticker is also "BTC"; both rendered as "BTC" and looked like a duplicate (an
 * owner report, 2026-10-27). A coin whose ticker belongs to a DIFFERENT coin -
 * in the top-250 list, or earlier in the trending list - is labelled by its
 * full name instead. Repeated ids are dropped.
 */
export function dedupeTrending(rows: TrendingCoin[], list: Pick<CoinRow, "id" | "symbol">[]): TrendingCoin[] {
  const seenIds = new Set<string>();
  const owner = new Map<string, string>(list.map((m) => [m.symbol.toUpperCase(), m.id]));
  const out: TrendingCoin[] = [];
  for (const r of rows) {
    if (!r.id || seenIds.has(r.id)) continue;
    seenIds.add(r.id);
    const sym = r.symbol.toUpperCase();
    const holder = owner.get(sym);
    if (holder && holder !== r.id) {
      out.push({ ...r, symbol: r.name });
    } else {
      if (!holder) owner.set(sym, r.id);
      out.push(r);
    }
  }
  return out;
}
