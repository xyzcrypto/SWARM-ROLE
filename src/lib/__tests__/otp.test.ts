import { describe, it, expect } from "vitest";
import { generateCode } from "@/lib/otp";

describe("generateCode", () => {
  it("is always a 6-digit string", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it("zero-pads small numbers to 6 digits", () => {
    // length is invariant even for values like 7 -> "000007"
    const codes = Array.from({ length: 200 }, () => generateCode());
    expect(codes.every((c) => c.length === 6)).toBe(true);
  });

  it("produces varied codes (not constant)", () => {
    const set = new Set(Array.from({ length: 50 }, () => generateCode()));
    expect(set.size).toBeGreaterThan(1);
  });
});
