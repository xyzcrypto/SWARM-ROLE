import { describe, expect, it } from "vitest";
import { rankNews } from "@/lib/news";

const NOW = 1_720_000_000_000;
const hoursAgo = (h: number) => NOW - h * 3_600_000;

describe("rankNews", () => {
  it("floats recent high-impact above older low-impact", () => {
    const items = [
      { id: "a", impact: "Low" as const, publishedAt: hoursAgo(1) },
      { id: "b", impact: "High" as const, publishedAt: hoursAgo(2) },
    ];
    // High gets an ~8h head start, so b (2h old High) outranks a (1h old Low).
    expect(rankNews(items, NOW).map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("does NOT let a stale high-impact story dominate a much fresher one", () => {
    const items = [
      { id: "old", impact: "High" as const, publishedAt: hoursAgo(20) }, // score 8-20 = -12
      { id: "new", impact: "Low" as const, publishedAt: hoursAgo(1) },  // score 0-1  = -1
    ];
    expect(rankNews(items, NOW).map((i) => i.id)).toEqual(["new", "old"]);
  });

  it("orders by recency within the same impact and does not mutate input", () => {
    const items = [
      { id: "x", impact: "Medium" as const, publishedAt: hoursAgo(3) },
      { id: "y", impact: "Medium" as const, publishedAt: hoursAgo(1) },
    ];
    expect(rankNews(items, NOW).map((i) => i.id)).toEqual(["y", "x"]);
    expect(items[0].id).toBe("x"); // original untouched
  });
});
