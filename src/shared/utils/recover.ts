/**
 * Recovering from a deploy that happened while the tab was open.
 *
 * Vercel Hobby has no skew protection: once a new deployment is live, the old
 * one's hashed JS chunks are gone. A tab opened before the deploy that then
 * navigates to a route it has not loaded yet asks for a chunk that 404s, the
 * route never renders, and the site looks frozen until the visitor refreshes
 * by hand. This site deploys several times a day, so that is "kabhi kabhi
 * stuck ho jata hai, refresh karna padta hai".
 *
 * The fix is to do the refresh for them. It used to be guarded by a
 * once-per-SESSION flag, so the second deploy a long-lived tab lived through
 * was never recovered at all. The guard is now time-based: at most one
 * automatic reload per RELOAD_GAP_MS, which still stops a genuinely broken
 * chunk from reload-looping, but recovers every later deploy.
 */

const KEY = "xyz-chunk-reload-at";
export const RELOAD_GAP_MS = 30_000;

/** Pure, for tests. */
export function isChunkError(message: string | null | undefined): boolean {
  return /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk|failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message ?? "");
}

/** Pure, for tests: may we reload now, given when we last did? */
export function mayReload(lastAt: number | null, now: number): boolean {
  return lastAt == null || !Number.isFinite(lastAt) || now - lastAt > RELOAD_GAP_MS || now < lastAt;
}

/**
 * Hard-reload to pick up the current deployment, at most once per
 * RELOAD_GAP_MS. Returns false (and does nothing) when a reload just happened,
 * so the caller can show its own error UI instead of looping.
 */
export function reloadForNewDeploy(href?: string): boolean {
  if (typeof window === "undefined") return false;
  let last: number | null = null;
  try {
    const raw = sessionStorage.getItem(KEY);
    last = raw ? Number(raw) : null;
  } catch {
    /* storage blocked: still allow one reload */
  }
  const now = Date.now();
  if (!mayReload(last, now)) return false;
  try {
    sessionStorage.setItem(KEY, String(now));
  } catch {
    /* ignore */
  }
  if (href) window.location.assign(href);
  else window.location.reload();
  return true;
}
