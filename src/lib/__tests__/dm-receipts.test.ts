import { describe, expect, it } from "vitest";
import { isReadBy, newestRead, clockTime, dayLabel } from "@/lib/chat-time";
import { lastSeenLabel, JUST_NOW_MS, A_WHILE_MS } from "@/lib/last-seen";

const NOW = Date.UTC(2026, 7, 3, 12, 0, 0); // 2026-08-03T12:00:00Z
const iso = (t: number) => new Date(t).toISOString();

describe("isReadBy", () => {
  it("is read once the other side opened the thread after it was sent", () => {
    expect(isReadBy(iso(NOW - 5000), iso(NOW))).toBe(true);
    expect(isReadBy(iso(NOW), iso(NOW))).toBe(true); // same instant counts
  });

  it("is unread when they last opened it before the message existed", () => {
    expect(isReadBy(iso(NOW), iso(NOW - 5000))).toBe(false);
  });

  it("is unread when they have never opened the thread", () => {
    expect(isReadBy(iso(NOW), null)).toBe(false);
    expect(isReadBy(iso(NOW), undefined)).toBe(false);
  });

  it("refuses to guess on an unparseable date", () => {
    expect(isReadBy("not a date", iso(NOW))).toBe(false);
    expect(isReadBy(iso(NOW), "not a date")).toBe(false);
  });
});

describe("newestRead", () => {
  it("keeps the later of the two", () => {
    expect(newestRead(iso(NOW - 1000), iso(NOW))).toBe(iso(NOW));
    expect(newestRead(iso(NOW), iso(NOW - 1000))).toBe(iso(NOW));
  });

  it("never moves a receipt backwards when a slow response lands late", () => {
    // The realtime ping arrives first; the thread refetch (older data) second.
    const afterPing = newestRead(null, iso(NOW));
    const afterSlowRefetch = newestRead(afterPing, iso(NOW - 30_000));
    expect(afterSlowRefetch).toBe(iso(NOW));
  });

  it("handles either side being absent", () => {
    expect(newestRead(null, iso(NOW))).toBe(iso(NOW));
    expect(newestRead(iso(NOW), null)).toBe(iso(NOW));
    expect(newestRead(null, null)).toBe(null);
  });
});

describe("lastSeenLabel", () => {
  it("says nothing when there is nothing to say", () => {
    expect(lastSeenLabel(null, NOW)).toBe(null);
    expect(lastSeenLabel(undefined, NOW)).toBe(null);
    expect(lastSeenLabel("not a date", NOW)).toBe(null);
  });

  it("does not report a future timestamp from a skewed clock", () => {
    expect(lastSeenLabel(iso(NOW + 4 * 60_000), NOW)).toBe(null);
  });

  it("buckets by age", () => {
    expect(lastSeenLabel(iso(NOW - 5_000), NOW)).toBe("last seen just now");
    expect(lastSeenLabel(iso(NOW - JUST_NOW_MS), NOW)).toBe("last seen 1 min ago");
    expect(lastSeenLabel(iso(NOW - 5 * 60_000), NOW)).toBe("last seen 5 min ago");
    expect(lastSeenLabel(iso(NOW - 3 * 3_600_000), NOW)).toBe("last seen 3 h ago");
    expect(lastSeenLabel(iso(NOW - 2 * 86_400_000), NOW)).toBe("last seen 2 d ago");
  });

  it("stops reporting an exact age past a week", () => {
    expect(lastSeenLabel(iso(NOW - A_WHILE_MS), NOW)).toBe("last seen a while ago");
    expect(lastSeenLabel(iso(NOW - 400 * 86_400_000), NOW)).toBe("last seen a while ago");
  });
});

/**
 * These two are the reason DM timestamps cannot simply be formatted: the server
 * and the reader are in different timezones, and a text difference across
 * hydration is a hard React failure (#418), not a cosmetic one.
 */
describe("chat-time is stable across the hydration boundary", () => {
  const LATE = Date.UTC(2026, 7, 2, 23, 30, 0); // just before UTC midnight

  const withTZ = <T,>(tz: string, fn: () => T): T => {
    const prev = process.env.TZ;
    process.env.TZ = tz;
    try {
      return fn();
    } finally {
      process.env.TZ = prev;
    }
  };
  const ZONES = ["UTC", "Asia/Kolkata", "America/Los_Angeles"];

  it("clockTime reads identically everywhere while local is false", () => {
    const seen = new Set(ZONES.map((tz) => withTZ(tz, () => clockTime(iso(LATE), false))));
    expect(seen.size).toBe(1);
  });

  it("dayLabel reads identically everywhere while local is false", () => {
    const seen = new Set(ZONES.map((tz) => withTZ(tz, () => dayLabel(iso(LATE), false, NOW))));
    expect(seen.size).toBe(1);
  });

  it("but DOES follow the reader once local is true - which is the point", () => {
    const seen = new Set(ZONES.map((tz) => withTZ(tz, () => clockTime(iso(LATE), true))));
    expect(seen.size).toBeGreaterThan(1);
  });

  it("names Today and Yesterday relative to the given now", () => {
    expect(dayLabel(iso(NOW), false, NOW)).toBe("Today");
    expect(dayLabel(iso(NOW - 86_400_000), false, NOW)).toBe("Yesterday");
    expect(dayLabel(iso(NOW - 5 * 86_400_000), false, NOW)).toBe("Jul 29, 2026");
  });
});
