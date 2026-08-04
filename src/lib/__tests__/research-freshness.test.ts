import { describe, expect, it } from "vitest";
import { FRESH_DAYS, daysSince, feedBadge, showLiveDot } from "@/lib/research-freshness";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 7, 4, 12, 0, 0);

describe("daysSince", () => {
  it("counts whole days", () => {
    expect(daysSince(new Date(NOW), NOW)).toBe(0);
    expect(daysSince(new Date(NOW - DAY), NOW)).toBe(1);
    expect(daysSince(new Date(NOW - 29 * DAY), NOW)).toBe(29);
  });

  it("floors a partial day rather than rounding it up", () => {
    // 23h old is still "today"; rounding would call it 1d and start ageing a
    // post that was published this morning.
    expect(daysSince(new Date(NOW - 23 * 3_600_000), NOW)).toBe(0);
  });

  it("never goes negative on a clock skew", () => {
    expect(daysSince(new Date(NOW + 5 * DAY), NOW)).toBe(0);
  });
});

describe("feedBadge", () => {
  /**
   * The bug this module exists for: the hero badged a 29-day-old report as NEW
   * with a blinking live dot, because it only ever asked "which post is
   * newest", never "is it actually new".
   */
  it("does NOT call a month-old post new", () => {
    expect(feedBadge(29)).toBe("latest");
    expect(showLiveDot(29)).toBe(false);
  });

  it("calls a genuinely recent post new", () => {
    expect(feedBadge(0)).toBe("new");
    expect(feedBadge(3)).toBe("new");
    expect(showLiveDot(1)).toBe(true);
  });

  it("switches exactly at the boundary, inclusive", () => {
    expect(feedBadge(FRESH_DAYS)).toBe("new");
    expect(feedBadge(FRESH_DAYS + 1)).toBe("latest");
  });

  it("falls back to latest when there is no date at all", () => {
    expect(feedBadge(null)).toBe("latest");
    expect(showLiveDot(null)).toBe(false);
  });
});
