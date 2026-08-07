import { describe, expect, it } from "vitest";
import { quotaLevel, QUOTA_QUIET_AT, QUOTA_WARN_AT } from "@shared/utils/ai-quota";

describe("quota disclosure level", () => {
  it("stays hidden while there is plenty of budget left", () => {
    expect(quotaLevel(25)).toBe("hidden");
    expect(quotaLevel(300)).toBe("hidden");
    expect(quotaLevel(QUOTA_QUIET_AT + 1)).toBe("hidden");
  });

  it("surfaces quietly at the quiet threshold", () => {
    expect(quotaLevel(QUOTA_QUIET_AT)).toBe("quiet");
    expect(quotaLevel(QUOTA_WARN_AT + 1)).toBe("quiet");
  });

  it("warns on the last few", () => {
    expect(quotaLevel(QUOTA_WARN_AT)).toBe("warn");
    expect(quotaLevel(1)).toBe("warn");
  });

  it("blocks at zero and never reports a negative remainder as usable", () => {
    expect(quotaLevel(0)).toBe("blocked");
    expect(quotaLevel(-5)).toBe("blocked");
  });

  // The thresholds are absolute so Free (25/day) and Premium (300/day) behave
  // identically near the end. A percentage rule would have shown Premium members
  // a counter at 120 remaining.
  it("treats a Premium-sized budget the same as a Free one near the end", () => {
    expect(quotaLevel(120)).toBe("hidden");
    expect(quotaLevel(2)).toBe("warn");
  });

  it("hides rather than throwing when the header was missing or unparseable", () => {
    expect(quotaLevel(Number.NaN)).toBe("hidden");
  });
});
