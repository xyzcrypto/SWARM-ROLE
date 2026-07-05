import { describe, expect, it } from "vitest";
import {
  buildSummaryPrompt,
  cleanSummary,
  buildModerationPrompt,
  parseModerationVerdict,
  MAX_SUMMARY_INPUT,
  MAX_SUMMARY_OUTPUT,
} from "@/lib/ai-summary";

describe("buildSummaryPrompt", () => {
  it("includes the title and (collapsed) body", () => {
    const p = buildSummaryPrompt("Perp DEX 101", "Line one.\n\n  Line   two.");
    expect(p).toContain("Perp DEX 101");
    expect(p).toContain("Line one. Line two."); // whitespace collapsed
    expect(p.toLowerCase()).toContain("tl;dr");
  });

  it("caps the article body length", () => {
    const p = buildSummaryPrompt("T", "x".repeat(MAX_SUMMARY_INPUT + 5000));
    // prompt = preamble + title + body(≤cap); body slice bounded
    expect(p.length).toBeLessThan(MAX_SUMMARY_INPUT + 500);
  });
});

describe("cleanSummary", () => {
  it("strips wrapping quotes", () => {
    expect(cleanSummary('"A tidy summary."')).toBe("A tidy summary.");
    expect(cleanSummary("`code-ish`")).toBe("code-ish");
  });
  it("removes a leading TL;DR / Summary label", () => {
    expect(cleanSummary("TL;DR: it works")).toBe("it works");
    expect(cleanSummary("Summary - the point")).toBe("the point");
  });
  it("caps the output length", () => {
    expect(cleanSummary("y".repeat(MAX_SUMMARY_OUTPUT + 100)).length).toBe(MAX_SUMMARY_OUTPUT);
  });
  it("trims surrounding whitespace", () => {
    expect(cleanSummary("   hello   ")).toBe("hello");
  });
});

describe("buildModerationPrompt", () => {
  it("embeds the message and asks for a one-word verdict", () => {
    const p = buildModerationPrompt("gm frens");
    expect(p).toContain("gm frens");
    expect(p).toContain("TOXIC");
    expect(p).toContain("SAFE");
  });
});

describe("parseModerationVerdict", () => {
  it("returns true only for a clear TOXIC", () => {
    expect(parseModerationVerdict("TOXIC")).toBe(true);
    expect(parseModerationVerdict("toxic")).toBe(true);
    expect(parseModerationVerdict("This is TOXIC.")).toBe(true);
  });
  it("returns false for SAFE or anything ambiguous/empty", () => {
    expect(parseModerationVerdict("SAFE")).toBe(false);
    expect(parseModerationVerdict("safe")).toBe(false);
    expect(parseModerationVerdict("")).toBe(false);
    expect(parseModerationVerdict("I am not sure")).toBe(false);
    // if the model hedges with both words, stay conservative (not toxic)
    expect(parseModerationVerdict("could be toxic but likely safe")).toBe(false);
  });
});
