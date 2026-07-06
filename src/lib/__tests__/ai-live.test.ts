import { describe, expect, it } from "vitest";
import { formatLiveContext } from "@/lib/ai-live";

describe("formatLiveContext", () => {
  it("returns empty string when nothing is available", () => {
    expect(formatLiveContext({})).toBe("");
    expect(formatLiveContext({ global: null, coins: [], headlines: [] })).toBe("");
  });

  it("formats the market line with the available fields", () => {
    const out = formatLiveContext({
      global: { marketCap: 2.34e12, volume24h: 8.9e10, btcDominance: 54.12, mcapChange24h: 1.2, fearGreed: { value: 62, label: "Greed" }, gas: 12.4 },
    });
    expect(out).toContain("LIVE MARKET DATA");
    expect(out).toContain("$2.34T");
    expect(out).toContain("BTC dominance 54.1%");
    expect(out).toContain("Fear & Greed 62 (Greed)");
    expect(out).toContain("ETH gas 12 gwei");
  });

  it("includes coin prices and headlines", () => {
    const out = formatLiveContext({
      coins: [{ symbol: "BTC", price: 67000, change24h: 2.1 }, { symbol: "ETH", price: 3400, change24h: -0.4 }],
      headlines: [{ title: "ETF approved", source: "CoinDesk", category: "Bitcoin" }],
    });
    expect(out).toContain("BTC $67,000 (+2.10%)");
    expect(out).toContain("ETH $3,400 (-0.40%)");
    expect(out).toContain("LATEST CRYPTO HEADLINES");
    expect(out).toContain("ETF approved — CoinDesk [Bitcoin]");
  });

  it("drops zero-price coins", () => {
    const out = formatLiveContext({ coins: [{ symbol: "X", price: 0, change24h: 0 }] });
    expect(out).toBe("");
  });
});
