import { describe, it, expect } from "vitest";
import { backoffDelay } from "@/lib/useLiveData";

describe("backoffDelay", () => {
  it("makes the first retry fast - a blip should cost a second, not a poll cycle", () => {
    // The bug this exists for: every live surface waited out its whole interval
    // after a failed request (30-90s), and if the next one failed too it stayed
    // stale until the user reloaded.
    expect(backoffDelay(1)).toBe(1000);
  });

  it("doubles, so a genuinely down backend is not hammered", () => {
    expect(backoffDelay(2)).toBe(2000);
    expect(backoffDelay(3)).toBe(4000);
    expect(backoffDelay(4)).toBe(8000);
  });

  it("caps at 30s, so a long outage never leaves a surface unattended for minutes", () => {
    expect(backoffDelay(10)).toBe(30_000);
    expect(backoffDelay(50)).toBe(30_000);
  });

  it("is defensive about a zero or negative count", () => {
    expect(backoffDelay(0)).toBe(1000);
    expect(backoffDelay(-3)).toBe(1000);
  });
});
