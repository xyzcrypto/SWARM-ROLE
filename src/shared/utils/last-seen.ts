/**
 * "Last seen" wording for DM headers. Pure and client-safe, so it is unit
 * tested rather than eyeballed.
 *
 * ## Two deliberate choices
 *
 * **Relative durations only, never a clock time or a date.** A rendered
 * timestamp has to be formatted in *some* timezone, and this project has
 * already been bitten hard by that: the server runs UTC, readers do not, and a
 * date near midnight formatted to a different calendar day on each side of
 * hydration - a text mismatch, which React treats as a hard hydration failure.
 * A duration has no timezone, so this whole class of bug cannot reach it.
 *
 * **Coarse buckets, not exact times.** "last seen 3 h ago" is the useful part;
 * "last seen at 4:07 AM" is surveillance. The buckets widen as they age, and
 * anything past a week collapses to "a while ago".
 */

/** Below this, someone counts as effectively present rather than "seen at". */
export const JUST_NOW_MS = 60_000;

/** Past this, the exact age stops being interesting and stops being reported. */
export const A_WHILE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * `null` when there is nothing worth showing - no timestamp recorded, or a
 * timestamp in the future (clock skew). Callers render nothing for null rather
 * than guessing.
 */
export function lastSeenLabel(iso: string | null | undefined, now: number = Date.now()): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;

  const diff = now - then;
  // A future timestamp means a skewed clock somewhere, not a time traveller.
  // "last seen in 4 minutes" is worse than saying nothing.
  if (diff < 0) return null;

  if (diff < JUST_NOW_MS) return "last seen just now";
  if (diff >= A_WHILE_MS) return "last seen a while ago";

  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `last seen ${mins} min ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `last seen ${hours} h ago`;

  const days = Math.floor(hours / 24);
  return `last seen ${days} d ago`;
}
