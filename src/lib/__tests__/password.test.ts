import { describe, it, expect } from "vitest";
import { passwordSchema } from "@/lib/profile";

// Shared strong-password policy enforced server-side at signup, reset and change.
describe("passwordSchema", () => {
  it("accepts a strong password (8+, upper, lower, digit)", () => {
    expect(passwordSchema.safeParse("Abcdef12").success).toBe(true);
    expect(passwordSchema.safeParse("Sup3rSecret!").success).toBe(true);
  });

  it("rejects passwords shorter than 8", () => {
    const r = passwordSchema.safeParse("Ab1cdef");
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toMatch(/at least 8/i);
  });

  it("requires a lowercase letter", () => {
    expect(passwordSchema.safeParse("ABCDEF12").success).toBe(false);
  });

  it("requires an uppercase letter", () => {
    expect(passwordSchema.safeParse("abcdef12").success).toBe(false);
  });

  it("requires a digit", () => {
    expect(passwordSchema.safeParse("Abcdefgh").success).toBe(false);
  });

  it("rejects an over-long password (> 100)", () => {
    expect(passwordSchema.safeParse("A1" + "a".repeat(100)).success).toBe(false);
  });
});
