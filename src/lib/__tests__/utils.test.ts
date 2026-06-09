import { describe, it, expect } from "vitest";
import { slugify, readingTime, cn } from "@/lib/utils";

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
