import { describe, expect, it } from "vitest";
import { estimateTokens, estimateCostUsdMicros, hasPrice } from "@/lib/ai/pricing";

describe("estimateTokens", () => {
  it("approximates ~4 chars/token and is never negative", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("a".repeat(400))).toBe(100);
  });
});

describe("estimateCostUsdMicros", () => {
  it("prices a known model in integer micro-dollars", () => {
    // 1M in + 1M out on llama-3.1-8b-instant = $0.05 + $0.08 = $0.13 = 130000 micro-USD
    expect(estimateCostUsdMicros("llama-3.1-8b-instant", { inputTokens: 1_000_000, outputTokens: 1_000_000 })).toBe(130_000);
  });
  it("returns 0 for an unknown model", () => {
    expect(hasPrice("llama-3.1-8b-instant")).toBe(true);
    expect(hasPrice("mystery-model")).toBe(false);
    expect(estimateCostUsdMicros("mystery-model", { inputTokens: 1_000_000, outputTokens: 1_000_000 })).toBe(0);
  });
});
