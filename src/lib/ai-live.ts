// XYZ AI — live-context grounding (pure, client-safe, unit-tested). The
// assistant route fetches the cached market + news snapshots and passes them
// here to build a compact "what's happening right now" block for the system
// prompt, so answers can reference current prices, sentiment and headlines.
import { compactUsd, pct } from "@/lib/markets";

export type LiveGlobal = {
  marketCap?: number;
  volume24h?: number;
  btcDominance?: number;
  mcapChange24h?: number;
  fearGreed?: { value: number; label: string } | null;
  gas?: number | null;
};
export type LiveCoin = { symbol: string; price: number; change24h: number };
export type LiveHeadline = { title: string; source: string; category?: string };

export type LiveSnapshot = {
  global?: LiveGlobal | null;
  coins?: LiveCoin[];
  headlines?: LiveHeadline[];
};

function coinLine(c: LiveCoin): string {
  const price = c.price >= 1 ? `$${c.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : `$${c.price.toPrecision(3)}`;
  return `${c.symbol} ${price} (${pct(c.change24h)})`;
}

/**
 * Compact, token-cheap live block. Returns "" when nothing is available so the
 * caller can simply omit the section (the assistant then answers from research
 * + general knowledge as before).
 */
export function formatLiveContext(snap: LiveSnapshot): string {
  const lines: string[] = [];
  const g = snap.global;
  if (g && (g.marketCap || g.volume24h)) {
    const parts: string[] = [];
    if (g.marketCap) parts.push(`Total market cap ${compactUsd(g.marketCap)}${typeof g.mcapChange24h === "number" ? ` (24h ${pct(g.mcapChange24h)})` : ""}`);
    if (g.volume24h) parts.push(`24h volume ${compactUsd(g.volume24h)}`);
    if (typeof g.btcDominance === "number" && g.btcDominance > 0) parts.push(`BTC dominance ${g.btcDominance.toFixed(1)}%`);
    if (g.fearGreed && g.fearGreed.value) parts.push(`Fear & Greed ${g.fearGreed.value} (${g.fearGreed.label})`);
    if (typeof g.gas === "number" && g.gas > 0) parts.push(`ETH gas ${Math.round(g.gas)} gwei`);
    if (parts.length) lines.push(parts.join(" · "));
  }
  const coins = (snap.coins ?? []).filter((c) => c.symbol && c.price > 0).slice(0, 8);
  if (coins.length) lines.push(`Prices: ${coins.map(coinLine).join(", ")}`);

  const heads = (snap.headlines ?? []).filter((h) => h.title).slice(0, 6);

  if (!lines.length && !heads.length) return "";

  let out = "";
  if (lines.length) {
    out +=
      "LIVE MARKET DATA (real-time snapshot — prices move constantly; present as current context, not a fixed fact, and never as financial advice):\n- " +
      lines.join("\n- ");
  }
  if (heads.length) {
    if (out) out += "\n\n";
    out += "LATEST CRYPTO HEADLINES (from the XYZ Crypto news hub):\n- " + heads.map((h) => `${h.title} — ${h.source}${h.category ? ` [${h.category}]` : ""}`).join("\n- ");
  }
  return out;
}
