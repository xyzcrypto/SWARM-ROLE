import { describe, expect, it } from "vitest";
import { fillDailySeries, seriesTotal, utcDay } from "@/lib/timeseries";

const TODAY = "2026-07-02T15:30:00.000Z";

describe("utcDay", () => {
  it("returns the UTC calendar day", () => {
    expect(utcDay(TODAY)).toBe("2026-07-02");
    expect(utcDay("2026-07-02T23:59:59.999Z")).toBe("2026-07-02");
  });
});

describe("fillDailySeries", () => {
  it("produces a complete window, oldest first, zero-filled", () => {
    const series = fillDailySeries([], 7, TODAY);
    expect(series).toHaveLength(7);
    expect(series[0]!.day).toBe("2026-06-26");
    expect(series[6]!.day).toBe("2026-07-02");
    expect(series.every((p) => p.count === 0)).toBe(true);
  });

  it("places counts on their days and zeroes the rest", () => {
    const series = fillDailySeries(
      [
        { day: "2026-07-01", count: 3 },
        { day: "2026-06-28", count: 5 },
      ],
      7,
      TODAY
    );
    expect(series.find((p) => p.day === "2026-07-01")!.count).toBe(3);
    expect(series.find((p) => p.day === "2026-06-28")!.count).toBe(5);
    expect(seriesTotal(series)).toBe(8);
  });

  it("coerces bigint counts (raw SQL count() returns bigint)", () => {
    const series = fillDailySeries([{ day: "2026-07-02", count: BigInt(4) }], 2, TODAY);
    expect(series[1]!.count).toBe(4);
    expect(typeof series[1]!.count).toBe("number");
  });

  it("ignores rows outside the window", () => {
    const series = fillDailySeries([{ day: "2020-01-01", count: 99 }], 3, TODAY);
    expect(seriesTotal(series)).toBe(0);
  });

  it("accepts Date objects for row days", () => {
    const series = fillDailySeries([{ day: new Date("2026-07-02T05:00:00Z"), count: 2 }], 2, TODAY);
    expect(series[1]!.count).toBe(2);
  });
});
