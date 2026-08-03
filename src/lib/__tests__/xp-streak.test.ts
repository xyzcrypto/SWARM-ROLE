import { describe, expect, it } from "vitest";
import { checkinStreak, shiftDayKey, streakAtRisk } from "@/lib/xp-streak";

const TODAY = "2026-08-03";
const back = (n: number) => shiftDayKey(TODAY, -n);

describe("shiftDayKey", () => {
  it("moves whole days and rolls over months and years", () => {
    expect(shiftDayKey("2026-08-03", -1)).toBe("2026-08-02");
    expect(shiftDayKey("2026-08-01", -1)).toBe("2026-07-31");
    expect(shiftDayKey("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDayKey("2026-03-01", -1)).toBe("2026-02-28"); // 2026 is not a leap year
    expect(shiftDayKey("2024-03-01", -1)).toBe("2024-02-29"); // 2024 is
  });

  it("survives a malformed key rather than inventing a date", () => {
    expect(shiftDayKey("nonsense", -1)).toBe("nonsense");
  });
});

describe("checkinStreak", () => {
  it("is zero with no history", () => {
    expect(checkinStreak([], TODAY)).toBe(0);
  });

  it("counts an unbroken run ending today", () => {
    expect(checkinStreak([TODAY], TODAY)).toBe(1);
    expect(checkinStreak([TODAY, back(1), back(2)], TODAY)).toBe(3);
  });

  /**
   * The case worth being deliberate about. At 9am, before checking in, someone
   * on a 30-day run has a 30-day run - not a zero. Showing 0 there is both
   * wrong and the moment they decide the feature is broken.
   */
  it("still counts the run when today has not been claimed yet", () => {
    expect(checkinStreak([back(1), back(2), back(3)], TODAY)).toBe(3);
  });

  it("is zero once a day was actually missed", () => {
    // Last check-in was the day before yesterday: the run is gone.
    expect(checkinStreak([back(2), back(3), back(4)], TODAY)).toBe(0);
  });

  it("stops at the first gap rather than counting everything", () => {
    // today, -1, then a hole at -2, then more history that must not count.
    expect(checkinStreak([TODAY, back(1), back(3), back(4), back(5)], TODAY)).toBe(2);
  });

  it("does not double-count a duplicated day", () => {
    expect(checkinStreak([TODAY, TODAY, back(1)], TODAY)).toBe(2);
  });

  it("is order-independent - the caller must not have to sort", () => {
    expect(checkinStreak([back(2), TODAY, back(1)], TODAY)).toBe(3);
  });

  it("handles a run that crosses a month and a year boundary", () => {
    const days = ["2026-01-01", "2025-12-31", "2025-12-30"];
    expect(checkinStreak(days, "2026-01-01")).toBe(3);
  });

  it("terminates on a long run instead of spinning", () => {
    const days = Array.from({ length: 500 }, (_, i) => back(i));
    expect(checkinStreak(days, TODAY)).toBe(500);
  });
});

describe("streakAtRisk", () => {
  it("is true when a live run has not been claimed today", () => {
    expect(streakAtRisk([back(1), back(2)], TODAY)).toBe(true);
  });

  it("is false once today is claimed", () => {
    expect(streakAtRisk([TODAY, back(1)], TODAY)).toBe(false);
  });

  it("is false when there is no run left to lose", () => {
    expect(streakAtRisk([], TODAY)).toBe(false);
    expect(streakAtRisk([back(5)], TODAY)).toBe(false);
  });
});
