import { describe, it, expect } from "vitest";
import { slugify, readingTime, cn, csvCell } from "@/lib/utils";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("The State of L2s in 2026")).toBe("the-state-of-l2s-in-2026");
  });
  it("strips punctuation and collapses spaces", () => {
    expect(slugify("Hello,   World!!!")).toBe("hello-world");
  });
  it("caps length", () => {
    expect(slugify("a".repeat(200)).length).toBeLessThanOrEqual(80);
  });
});

describe("readingTime", () => {
  it("is at least 1 minute", () => {
    expect(readingTime("short")).toBeGreaterThanOrEqual(1);
  });
  it("scales with word count", () => {
    expect(readingTime("word ".repeat(600))).toBeGreaterThan(1);
  });
});

describe("cn", () => {
  it("merges and dedupes tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});

describe("csvCell", () => {
  it("wraps plain values in quotes", () => {
    expect(csvCell("hello")).toBe('"hello"');
  });
  it("doubles embedded quotes (no CSV corruption)", () => {
    expect(csvCell('John "JD" Doe')).toBe('"John ""JD"" Doe"');
  });
  it("neutralises formula injection (leading = + - @)", () => {
    expect(csvCell("=SUM(A1)")).toBe(`"'=SUM(A1)"`);
    expect(csvCell("+1")).toBe(`"'+1"`);
    expect(csvCell("@cmd")).toBe(`"'@cmd"`);
  });
  it("handles null/undefined as empty", () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });
});
