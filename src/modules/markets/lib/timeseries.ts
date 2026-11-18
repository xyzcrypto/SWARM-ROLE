// Pure daily-timeseries helpers for the dashboard charts - unit-tested.

export type DailyPoint = { day: string; count: number }; // day = YYYY-MM-DD (UTC)

/** UTC calendar day of a date, as YYYY-MM-DD. */
export function utcDay(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 10);
}

/**
 * Fill a sparse day→count map into a complete series of the trailing `days`
 * calendar days (UTC), oldest→newest, zeroing missing days. Bucketing rows
 * server-side keeps the endpoint payload tiny and chart code dumb.
 */
export function fillDailySeries(
  rows: Array<{ day: string | Date; count: number | bigint }>,
  days: number,
  today: Date | string = new Date()
): DailyPoint[] {
  const byDay = new Map<string, number>();
  for (const r of rows) byDay.set(utcDay(r.day as string | Date), Number(r.count));
  const end = new Date(`${utcDay(today)}T00:00:00.000Z`).getTime();
  const out: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = utcDay(new Date(end - i * 86_400_000));
    out.push({ day, count: byDay.get(day) ?? 0 });
  }
  return out;
}

/** Sum of a series (chart headline number). */
export function seriesTotal(points: DailyPoint[]): number {
  return points.reduce((s, p) => s + p.count, 0);
}

/**
 * CoinGecko's 7d sparkline is 168 hourly points per coin; for 250 coins that was
 * ~820 KB of a ~910 KB response, polled every three minutes by every open tab.
 * Every chart that draws it is a ~80px wide line, so 42 points (one per four
 * hours, last point kept) at six significant digits draws the same shape.
 */
export const SPARK_POINTS = 42;
export function thinSparkline(series: number[], points = SPARK_POINTS): number[] {
  const clean = series.filter((x) => Number.isFinite(x));
  if (clean.length <= points) return clean.map((x) => Number(x.toPrecision(6)));
  const step = (clean.length - 1) / (points - 1);
  const out: number[] = [];
  for (let i = 0; i < points; i++) out.push(Number(clean[Math.round(i * step)].toPrecision(6)));
  return out;
}
