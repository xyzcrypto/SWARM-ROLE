import { describe, expect, it } from "vitest";
import { pageSuggestions } from "@shared/utils/ai-page-context";

describe("page-aware suggestions", () => {
  it("offers coin-specific questions on a coin page", () => {
    const out = pageSuggestions("/markets/bitcoin");
    expect(out).toHaveLength(2);
    expect(out[0].label).toBe("Explain Bitcoin's move");
    expect(out[0].q).toContain("Bitcoin");
  });

  it("humanises a hyphenated id", () => {
    expect(pageSuggestions("/markets/avalanche-2")[0].label).toBe("Explain Avalanche 2's move");
  });

  // /markets/protocol/<type>/<slug> is a different shape and must not be read
  // as a coin id - "protocol" would become the coin name.
  it("does not treat a protocol page as a coin page", () => {
    const out = pageSuggestions("/markets/protocol/dex/uniswap");
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe("Explain Uniswap");
  });

  it("offers article questions on a research post", () => {
    const out = pageSuggestions("/research/perp-dex-landscape-2026");
    expect(out.map((s) => s.label)).toEqual(["Summarise this post", "Practical takeaways"]);
    expect(out[0].q).toContain("Perp Dex Landscape 2026");
  });

  it("falls back to a general overview on the markets index", () => {
    expect(pageSuggestions("/markets")[0].label).toBe("Market overview");
  });

  it("covers journal and news", () => {
    expect(pageSuggestions("/journal")[0].label).toBe("Review my trades");
    expect(pageSuggestions("/news")[0].label).toBe("Today's headlines");
  });

  it("returns nothing for pages with no useful context", () => {
    expect(pageSuggestions("/")).toEqual([]);
    expect(pageSuggestions("/settings")).toEqual([]);
    expect(pageSuggestions(null)).toEqual([]);
    expect(pageSuggestions("")).toEqual([]);
  });

  it("ignores a query string", () => {
    expect(pageSuggestions("/markets/solana?tab=chart")[0].label).toBe("Explain Solana's move");
  });
});

describe("plan labelling", () => {
  // Regression: the panel read session.membership, which says "Premium" for an
  // admin whose real allowance is the much larger Admin one.
  it("reports Admin for a super admin regardless of membership", async () => {
    const { aiPlanFor } = await import("@shared/utils/ai-plan");
    expect(aiPlanFor({ membership: "Premium", isSuperAdmin: true })).toBe("Admin");
    expect(aiPlanFor({ membership: "Free", role: "ADMIN" })).toBe("Admin");
    expect(aiPlanFor({ membership: "Premium" })).toBe("Premium");
    expect(aiPlanFor({ membership: "Free" })).toBe("Free");
    expect(aiPlanFor(null)).toBe("Free");
  });
});
