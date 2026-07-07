import { describe, expect, it } from "vitest";
import { planDailyLimit, effectiveDailyLimit, isUserTask, dailyLimitMessage, DEFAULT_DAILY_LIMITS } from "@/lib/ai/limits";

describe("plan daily limits", () => {
  it("uses the built-in defaults when no env override is set", () => {
    expect(planDailyLimit("Free")).toBe(25);
    expect(planDailyLimit("Premium")).toBe(300);
    expect(planDailyLimit("Admin")).toBe(3000);
    expect(DEFAULT_DAILY_LIMITS.Free).toBe(25);
  });
  it("lets a positive per-user override win over the plan default", () => {
    expect(effectiveDailyLimit("Free", 100)).toBe(100);
    expect(effectiveDailyLimit("Free", null)).toBe(25);
    expect(effectiveDailyLimit("Free", 0)).toBe(25); // non-positive ignored
    expect(effectiveDailyLimit("Premium", undefined)).toBe(300);
  });
});

describe("isUserTask", () => {
  it("counts only user-initiated tasks against the cap", () => {
    expect(isUserTask("assistant")).toBe(true);
    expect(isUserTask("why")).toBe(true);
    expect(isUserTask("digest")).toBe(true);
    expect(isUserTask("moderation")).toBe(false);
    expect(isUserTask("summary")).toBe(false);
  });
});

describe("dailyLimitMessage", () => {
  it("nudges Free users to upgrade", () => {
    const msg = dailyLimitMessage({ allowed: false, used: 25, limit: 25, remaining: 0 }, "Free");
    expect(msg).toMatch(/25 requests/);
    expect(msg).toMatch(/Premium/);
  });
  it("omits the upgrade nudge for paid plans", () => {
    const msg = dailyLimitMessage({ allowed: false, used: 300, limit: 300, remaining: 0 }, "Premium");
    expect(msg).not.toMatch(/Upgrade to Premium/);
  });
});
