/**
 * A manual refresh that actually refreshes.
 *
 * ## The bug this exists for
 *
 * Every "Refresh" button on this site fetched with `cache: "no-store"` and
 * looked correct. It is not: `no-store` instructs the BROWSER not to use its own
 * HTTP cache. It says nothing to the Vercel edge, which happily serves the same
 * cached body it has been serving for the rest of its `s-maxage` window.
 *
 * So pressing Refresh re-rendered the identical numbers with a spinner in front
 * of them. The control looked alive and did nothing, which is worse than not
 * having it: a reader who presses it concludes the data really has not changed.
 *
 * A distinct URL is a distinct edge cache key, so a cache-busting parameter is
 * what forces a genuine origin read.
 *
 * ## Why it is throttled
 *
 * Every busted request MISSES the edge and hits the origin function. That is the
 * point, and it is also the cost: this project runs on a plan where Fluid Active
 * CPU and ISR writes are rationed and have each caused a real incident. An
 * unthrottled button is a free origin-hit generator for anyone holding it down.
 *
 * So a bust is allowed at most once per `minGapMs` per key. Inside that window
 * the fetch still happens - the reader gets a response and the UI stays honest -
 * it simply reuses the cached URL rather than minting a new one.
 */

const lastBustAt = new Map<string, number>();

/** Default gap between forced origin reads for one key. */
export const REFRESH_MIN_GAP_MS = 10_000;

/**
 * Whether a forced origin read is due for this key, recording it if so.
 *
 * Pure apart from the timestamp it records, and `now` is injected so the rule is
 * testable without waiting ten seconds.
 */
export function bustIsDue(key: string, now: number, minGapMs = REFRESH_MIN_GAP_MS): boolean {
  const last = lastBustAt.get(key) ?? 0;
  if (now - last < minGapMs) return false;
  lastBustAt.set(key, now);
  return true;
}

/** Forget a key's throttle. Only for tests - nothing in the app needs this. */
export function resetBustThrottle(key?: string): void {
  if (key) lastBustAt.delete(key);
  else lastBustAt.clear();
}

/**
 * The URL to fetch for a refresh.
 *
 * `force` is what a button press passes; a poll or a wake refetch passes false
 * and keeps the shared, edge-cached URL - those are exactly the paths that must
 * stay cheap, because they happen without anyone asking.
 */
export function refreshUrl(path: string, force: boolean, now = Date.now()): string {
  if (!force || !bustIsDue(path, now)) return path;
  const sep = path.includes("?") ? "&" : "?";
  // A coarse stamp, not `Math.random()`: two tabs refreshing in the same second
  // then share one edge entry instead of minting two.
  return `${path}${sep}fresh=${Math.floor(now / 1000)}`;
}
