import { describe, expect, it } from "vitest";
import { compactUsd, pct, fngLabel, topByTvl } from "@/lib/markets";

describe("compactUsd", () => {
  it("formats trillions/billions/millions/thousands", () => {
    expect(compactUsd(2_350_000_000_000)).toBe("$2.35T");
    expect(compactUsd(92_000_000_000)).toBe("$92.00B");
    expect(compactUsd(12_300_000)).toBe("$12.30M");
    expect(compactUsd(4_500)).toBe("$4.5K");
    expect(compactUsd(999)).toBe("$999");
  });
  it("returns — for bad input", () => {
    expect(compactUsd(null)).toBe("—");
    expect(compactUsd(undefined)).toBe("—");
    expect(compactUsd(NaN)).toBe("—");
  });
});

describe("pct", () => {
  it("adds a sign", () => {
    expect(pct(2.345)).toBe("+2.35%");
    expect(pct(-1.1)).toBe("-1.10%");
    expect(pct(0)).toBe("+0.00%");
  });
  it("honours digits + guards bad input", () => {
    expect(pct(3.14159, 1)).toBe("+3.1%");
    expect(pct(null)).toBe("—");
  });
});

describe("fngLabel", () => {
  it("maps the standard Fear & Greed bands", () => {
    expect(fngLabel(10)).toEqual({ label: "Extreme Fear", tone: "red" });
    expect(fngLabel(30)).toEqual({ label: "Fear", tone: "red" });
    expect(fngLabel(50)).toEqual({ label: "Neutral", tone: "amber" });
    expect(fngLabel(65)).toEqual({ label: "Greed", tone: "mint" });
    expect(fngLabel(90)).toEqual({ label: "Extreme Greed", tone: "mint" });
  });
  it("defaults to Neutral for bad input", () => {
    expect(fngLabel(NaN).label).toBe("Neutral");
  });
});

describe("topByTvl", () => {
  it("sorts desc and slices to N", () => {
    const list = [{ tvl: 5 }, { tvl: 100 }, { tvl: 20 }, { tvl: 1 }];
    expect(topByTvl(list, 2).map((x) => x.tvl)).toEqual([100, 20]);
  });
  it("drops non-finite tvl and tolerates non-arrays", () => {
    const list = [{ tvl: 5 }, { tvl: NaN }, { tvl: 9 }] as { tvl: number }[];
    expect(topByTvl(list, 5).map((x) => x.tvl)).toEqual([9, 5]);
    expect(topByTvl(null, 3)).toEqual([]);
    expect(topByTvl(undefined, 3)).toEqual([]);
  });
});
