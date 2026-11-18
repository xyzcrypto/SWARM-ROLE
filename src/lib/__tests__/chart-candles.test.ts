import { describe, it, expect } from "vitest";
import { coingeckoToKlines } from "@modules/markets/lib/chart-candles";

const HOUR = 3_600_000;
const series = (n: number, stepMs: number, start = 1_700_000_000_000) =>
  Array.from({ length: n }, (_, i) => [start + i * stepMs, 60_000 + i] as [number, number]);

describe("coingeckoToKlines", () => {
  it("returns Binance-shaped klines with the price in every OHLC slot", () => {
    const k = coingeckoToKlines(series(3, HOUR), [], 10 * HOUR, 50);
    expect(k).toHaveLength(3);
    expect(k[0]).toEqual([1_700_000_000_000, "60000", "60000", "60000", "60000", "0", 1_700_000_000_000, "0"]);
  });

  it("keeps only the newest window", () => {
    const k = coingeckoToKlines(series(48, HOUR), [], 4 * HOUR, 50);
    expect(k).toHaveLength(5); // the newest point plus four hours back
    expect(k.at(-1)![4]).toBe("60047");
  });

  it("thins long series to about maxPoints and always keeps the newest point", () => {
    const k = coingeckoToKlines(series(288, 5 * 60_000), [], 24 * HOUR, 48);
    expect(k.length).toBeLessThanOrEqual(49);
    expect(k.at(-1)![4]).toBe("60287");
  });

  it("carries the volume at the same timestamp into the quote-volume slot", () => {
    const prices = series(2, HOUR);
    const k = coingeckoToKlines(prices, [[prices[1][0], 1234]], 10 * HOUR, 50);
    expect(k[1][7]).toBe("1234");
  });

  it("drops bad prices and survives missing input", () => {
    expect(coingeckoToKlines([[1, 0], [2, Number.NaN], [3, 5]], [], 100, 50)).toHaveLength(1);
    expect(coingeckoToKlines(undefined as never, undefined as never, 100, 50)).toEqual([]);
  });
});
