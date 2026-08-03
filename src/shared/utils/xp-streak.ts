/**
 * Daily check-in streak, derived from data that already exists.
 *
 * `XpEvent` records one row per user, per action, per UTC day, with `day`
 * stored as a plain `YYYY-MM-DD` string. So a streak is just "how many
 * consecutive day keys lead back from today" - no new column, no new table,
 * and no migration.
 *
 * Storing day keys as strings rather than timestamps also means the whole
 * calculation is timezone-free. Everyone's streak rolls over at the same
 * instant (UTC midnight), which is the only rule that does not quietly reward
 * or punish people for where they live - and it keeps this well away from the
 * hydration class of bug that timezone-dependent rendering caused elsewhere.
 */

/** Shift a `YYYY-MM-DD` key by whole days. Pure string in, pure string out. */
export function shiftDayKey(day: string, deltaDays: number): string {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return day;
  // Date.UTC is exact for whole days and immune to DST, unlike local dates.
  return new Date(Date.UTC(y, m - 1, d + deltaDays)).toISOString().slice(0, 10);
}

/**
 * How many days the run currently stands at.
 *
 * Counting starts at today when today is claimed, and at yesterday when it is
 * not. That second case is the one worth being deliberate about: at 9am, before
 * you have checked in, a streak you have kept for thirty days is not zero - it
 * is thirty, and it is at risk today. Showing 0 there would be both wrong and
 * the exact moment a member decides the feature is broken.
 *
 * Anything older than yesterday means the run was already lost, and the answer
 * is 0 rather than a stale number.
 */
export function checkinStreak(days: Iterable<string>, today: string): number {
  const seen = new Set(days);
  if (seen.size === 0) return 0;

  const yesterday = shiftDayKey(today, -1);
  let cursor = seen.has(today) ? today : seen.has(yesterday) ? yesterday : null;
  if (!cursor) return 0;

  let streak = 0;
  // Bounded so a corrupt data set cannot spin here. Ten years of daily
  // check-ins is well past anything worth displaying.
  while (seen.has(cursor) && streak < 3700) {
    streak += 1;
    cursor = shiftDayKey(cursor, -1);
  }
  return streak;
}

/** True when the run is alive but today has not been claimed yet. */
export function streakAtRisk(days: Iterable<string>, today: string): boolean {
  const seen = new Set(days);
  return !seen.has(today) && checkinStreak(seen, today) > 0;
}
