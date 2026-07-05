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
