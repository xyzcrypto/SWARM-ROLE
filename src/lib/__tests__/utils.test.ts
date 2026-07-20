import { describe, it, expect } from "vitest";
import { slugify, readingTime, cn, csvCell, maskEmail, pickPrimaryVerifiedEmail } from "@/lib/utils";

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

describe("maskEmail", () => {
  it("keeps first 2 chars + domain", () => {
    expect(maskEmail("rahul@gmail.com")).toBe("ra***@gmail.com");
    expect(maskEmail("md.something@xyzcrypto.io")).toBe("md***@xyzcrypto.io");
  });
  it("keeps 1 char for very short locals", () => {
    expect(maskEmail("a@x.com")).toBe("a***@x.com");
  });
  it("never exposes the full local part", () => {
    const out = maskEmail("longusername@gmail.com");
    expect(out).not.toContain("longusername");
    expect(out.endsWith("@gmail.com")).toBe(true);
  });
  it("handles empty/invalid", () => {
    expect(maskEmail("")).toBe("");
    expect(maskEmail(null)).toBe("");
    expect(maskEmail("notanemail")).toBe("notanemail");
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

describe("pickPrimaryVerifiedEmail", () => {
  it("returns the address that is both primary AND verified", () => {
    const emails = [
      { email: "secondary@verified.com", primary: false, verified: true },
      { email: "primary@verified.com", primary: true, verified: true },
    ];
    expect(pickPrimaryVerifiedEmail(emails)).toBe("primary@verified.com");
  });
  it("rejects a primary-but-unverified address (the takeover vector)", () => {
    const emails = [{ email: "primary@unverified.com", primary: true, verified: false }];
    expect(pickPrimaryVerifiedEmail(emails)).toBeNull();
  });
  it("rejects a verified-but-not-primary address (must be both)", () => {
    const emails = [{ email: "verified@notprimary.com", primary: false, verified: true }];
    expect(pickPrimaryVerifiedEmail(emails)).toBeNull();
  });
  it("returns null for empty, non-array, or malformed input", () => {
    expect(pickPrimaryVerifiedEmail([])).toBeNull();
    expect(pickPrimaryVerifiedEmail(null)).toBeNull();
    expect(pickPrimaryVerifiedEmail(undefined)).toBeNull();
    expect(pickPrimaryVerifiedEmail("nope")).toBeNull();
    expect(pickPrimaryVerifiedEmail([{ primary: true, verified: true }])).toBeNull();
  });
});
