// Pure daily-timeseries helpers for the dashboard charts — unit-tested.

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
