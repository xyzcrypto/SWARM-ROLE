import type { TokenUsage } from "./providers/types";

// Published per-1M-token prices (USD). Groq + Gemini free tiers actually bill $0,
// but we track notional cost from these so spend is measurable the moment usage
// moves to a paid tier. Unknown models cost 0 (still counted by token volume).
type Price = { inUsdPerM: number; outUsdPerM: number };

const PRICES: Record<string, Price> = {
  // Groq
  "llama-3.1-8b-instant": { inUsdPerM: 0.05, outUsdPerM: 0.08 },
  "llama-3.3-70b-versatile": { inUsdPerM: 0.59, outUsdPerM: 0.79 },
  // Gemini
  "gemini-1.5-flash": { inUsdPerM: 0.075, outUsdPerM: 0.3 },
  "gemini-1.5-pro": { inUsdPerM: 1.25, outUsdPerM: 5.0 },
};

/** Rough token estimate when a provider omits usage (~4 chars/token). */
export function estimateTokens(text: string): number {
  return Math.max(0, Math.ceil((text?.length ?? 0) / 4));
}

/** Estimated cost in integer micro-dollars (1e-6 USD) - avoids float drift in the DB. */
export function estimateCostUsdMicros(model: string, usage: TokenUsage): number {
  const p = PRICES[model];
  if (!p) return 0;
  const usd = (usage.inputTokens / 1e6) * p.inUsdPerM + (usage.outputTokens / 1e6) * p.outUsdPerM;
  return Math.max(0, Math.round(usd * 1e6));
}

/** True if we have a price entry for the model (else cost is reported as 0). */
export function hasPrice(model: string): boolean {
  return Object.prototype.hasOwnProperty.call(PRICES, model);
}
