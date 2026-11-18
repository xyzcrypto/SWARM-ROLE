import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/kv", () => ({ kv: () => null }));

import { __resetLastGood, lastGood } from "@modules/markets/lib/last-good";
import { thinSparkline, SPARK_POINTS } from "@modules/markets/lib/timeseries";
import { buildPerpVenues, cgCoversFeatured, type CgDerivRow } from "@modules/markets/lib/perp-venues";

const nonEmpty = { isGood: (v: number[]) => v.length > 0, maxAgeMs: 60_000 };

describe("lastGood", () => {
  beforeEach(() => {
    __resetLastGood();
    vi.useRealTimers();
  });

  it("returns and remembers a good value", async () => {
    expect(await lastGood("k", async () => [1, 2], nonEmpty)).toEqual([1, 2]);
    expect(await lastGood("k", async () => [], nonEmpty)).toEqual([1, 2]);
  });

  it("serves the remembered value when the upstream throws", async () => {
    await lastGood("k", async () => [3], nonEmpty);
    await expect(lastGood("k", async () => Promise.reject(new Error("429")), nonEmpty)).resolves.toEqual([3]);
  });

  it("re-throws when nothing usable is remembered", async () => {
    await expect(lastGood("none", async () => Promise.reject(new Error("429")), nonEmpty)).rejects.toThrow("429");
  });

  it("returns the bad value as-is when nothing is remembered", async () => {
    expect(await lastGood("none", async () => [], nonEmpty)).toEqual([]);
  });

  it("never serves a value older than maxAgeMs", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    await lastGood("k", async () => [9], nonEmpty);
    vi.setSystemTime(61_000);
    expect(await lastGood("k", async () => [], nonEmpty)).toEqual([]);
  });

  it("keys are independent", async () => {
    await lastGood("a", async () => [1], nonEmpty);
    expect(await lastGood("b", async () => [], nonEmpty)).toEqual([]);
  });
});

describe("thinSparkline", () => {
  const hourly = Array.from({ length: 168 }, (_, i) => 100 + i + 0.123456789);

  it("thins 168 points to SPARK_POINTS keeping both ends", () => {
    const out = thinSparkline(hourly);
    expect(out).toHaveLength(SPARK_POINTS);
    expect(out[0]).toBeCloseTo(hourly[0], 3);
    expect(out[out.length - 1]).toBeCloseTo(hourly[hourly.length - 1], 3);
  });

  it("rounds to six significant digits and drops non-finite points", () => {
    expect(thinSparkline([1.23456789, Number.NaN, 2])).toEqual([1.23457, 2]);
  });

  it("is a large payload cut", () => {
    expect(JSON.stringify(thinSparkline(hourly)).length).toBeLessThan(JSON.stringify(hourly).length / 3);
  });
});

describe("cgCoversFeatured", () => {
  const row = (key: string, id = key): CgDerivRow => ({ id, name: key, key, logo: null, volume24h: 1, openInterest: 1 });

  it("is true only when every CoinGecko-listed featured venue is present", () => {
    const all = [row("lighter"), row("variational"), row("risex"), row("arcus"), row("sodex")];
    expect(cgCoversFeatured(all)).toBe(true);
    expect(cgCoversFeatured(all.filter((r) => r.key !== "arcus"))).toBe(false);
    expect(cgCoversFeatured([])).toBe(false);
  });
});

describe("buildPerpVenues open-interest fallback", () => {
  it("fills TXFlow OI from DefiLlama's open-interest overview when its own API has none", () => {
    const v = buildPerpVenues([], [], { txflow: { volume24h: 250e6, openInterest: 0 } }, [
      { name: "TxFlow Perps", slug: "txflow-perps", openInterest: 28_400_000 },
    ]);
    const tx = v.find((x) => x.key === "txflow");
    expect(tx?.volume24h).toBe(250e6);
    expect(tx?.openInterest).toBe(28_400_000);
  });

  it("keeps CoinGecko's OI ahead of the overview", () => {
    const cg: CgDerivRow[] = [{ id: "lighter", name: "Lighter", key: "lighter", logo: null, volume24h: 2e9, openInterest: 400e6 }];
    const v = buildPerpVenues([], cg, {}, [{ name: "Lighter Perps", slug: "lighter-perps", openInterest: 1 }]);
    expect(v.find((x) => x.key === "lighter")?.openInterest).toBe(400e6);
  });

  it("does not let 'Lighter Robinhood Perps' stand in for Lighter", () => {
    const v = buildPerpVenues([], [], {}, [{ name: "Lighter Robinhood Perps", slug: "lighter-robinhood-perps", openInterest: 5 }]);
    expect(v.find((x) => x.key === "lighter")?.openInterest).toBeNull();
  });
});
