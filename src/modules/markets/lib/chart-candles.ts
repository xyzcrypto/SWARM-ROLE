// Turns CoinGecko price history into the Binance kline shape the markets chart
// route already reads, so the chart keeps working when Binance is unreachable.

/** [openTime, open, high, low, close, volume, closeTime, quoteVolume], as Binance returns it. */
export type Kline = [number, string, string, string, string, string, number, string];

/** CoinGecko [ms, value] series to Binance-shaped klines (o = h = l = c = price). */
export function coingeckoToKlines(prices: [number, number][], volumes: [number, number][], window: number, maxPoints: number): Kline[] {
  if (!Array.isArray(prices) || !prices.length) return [];
  const last = prices[prices.length - 1][0];
  const inWindow = prices.filter(([t, p]) => last - t <= window && Number.isFinite(p) && p > 0);
  const step = Math.max(1, Math.ceil(inWindow.length / maxPoints));
  const thinned = inWindow.filter((_, i) => i % step === 0 || i === inWindow.length - 1);
  const volAt = new Map((volumes || []).map(([t, v]) => [t, v]));
  return thinned.map(([t, p]) => {
    const px = String(p);
    return [t, px, px, px, px, "0", t, String(volAt.get(t) ?? 0)];
  });
}

