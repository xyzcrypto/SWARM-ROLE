import { describe, it, expect } from "vitest";
import { scoreSignals, type Signals } from "@/lib/security-score";

// A calm baseline (everything healthy) that individual tests override.
const base: Signals = {
  windowMinutes: 60,
  isProd: true,
  lockedAccounts: 0,
  highFailAccounts: 0,
  otpAttemptsMax: 0,
  otpActiveCodes: 0,
  aiCalls: 0,
  aiErrors: 0,
  aiErrorRatePct: 0,
  aiCostUsdToday: 0,
  adminActions: 0,
  config: { rateLimitLive: true, sentryConfigured: true, aiEnabled: true, pushLive: true },
};

describe("scoreSignals", () => {
  it("returns ok with no flags when everything is healthy", () => {
    const r = scoreSignals(base);
    expect(r.severity).toBe("ok");
    expect(r.flags).toHaveLength(0);
  });

  it("flags rate-limiting OFF in production as warn", () => {
    const r = scoreSignals({ ...base, config: { ...base.config, rateLimitLive: false } });
    expect(r.severity).toBe("warn");
    expect(r.flags.join(" ")).toMatch(/rate-limit/i);
  });

  it("does NOT flag rate-limiting off when not in production", () => {
    const r = scoreSignals({ ...base, isProd: false, config: { ...base.config, rateLimitLive: false } });
    expect(r.severity).toBe("ok");
  });

  it("escalates to critical when many accounts are locked", () => {
    expect(scoreSignals({ ...base, lockedAccounts: 6 }).severity).toBe("critical");
    expect(scoreSignals({ ...base, lockedAccounts: 2 }).severity).toBe("warn");
  });

  it("flags OTP attempt spikes and floods", () => {
    expect(scoreSignals({ ...base, otpAttemptsMax: 5 }).severity).toBe("warn");
    expect(scoreSignals({ ...base, otpActiveCodes: 60 }).severity).toBe("warn");
  });

  it("flags AI error-rate + cost spikes", () => {
    expect(scoreSignals({ ...base, aiCalls: 30, aiErrors: 20, aiErrorRatePct: 66 }).severity).toBe("warn");
    expect(scoreSignals({ ...base, aiCostUsdToday: 25 }).severity).toBe("warn");
  });

  it("treats admin actions as informational only", () => {
    const r = scoreSignals({ ...base, adminActions: 2 });
    expect(r.severity).toBe("info");
    expect(r.flags).toHaveLength(1);
  });
});
