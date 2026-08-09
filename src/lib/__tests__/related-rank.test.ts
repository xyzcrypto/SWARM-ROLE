import { describe, expect, it } from "vitest";
import { rankPosts } from "@/lib/ai-ground";
const posts = [
  { title: "Airdrop Meta Q3", slug: "airdrop", excerpt: "farming strategies", content: "" },
  { title: "Perp DEX Landscape 2026", slug: "perp", excerpt: "hyperliquid dydx fees", content: "" },
  { title: "Staking Basics", slug: "stake", excerpt: "validators rewards", content: "" },
];
describe("related research ranking", () => {
  it("puts the on-topic post first for a coin-shaped query", () => {
    expect(rankPosts(posts, "hyperliquid")[0].slug).toBe("perp");
    expect(rankPosts(posts, "airdrop")[0].slug).toBe("airdrop");
  });
  it("preserves order when nothing matches, so a page still gets links", () => {
    expect(rankPosts(posts, "zzzz").map((p) => p.slug)).toEqual(["airdrop", "perp", "stake"]);
  });
});
