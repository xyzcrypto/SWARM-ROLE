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

/**
 * Pure, for tests: what a reachability probe's answer means. A 404/410 means
 * the chunk's deployment is gone (reload now picks up the new one); any 2xx
 * means the network is back and the file is there (reload now succeeds).
 * Anything else, or no answer, means a reload would fail too: keep waiting.
 */
export function probeSaysReload(status: number | null): boolean {
  return status != null && ((status >= 200 && status < 300) || status === 404 || status === 410);
}

let waiting = false;

/**
 * Reload for a failed chunk, but only once a reload can actually work.
 *
 * ⚠️ `reloadForNewDeploy()` used to run the instant a chunk failed. A chunk
 * also fails when the CONNECTION drops (a lift, a tunnel, a weak 4G cell), and
 * reloading while offline does not recover anything: it throws away the page
 * the visitor was on and lands them on the browser's error page, which stays
 * there after the network returns. Reproduced: fail a /_next/static script
 * while offline and the tab ends on "This site can't be reached" until a
 * manual refresh. So wait until the network answers, then reload.
 *
 * The probe is a HEAD request, which the service worker never intercepts
 * (it only handles GET), so it is a real network answer, never a cached one.
 * It targets the failed chunk when known, which also tells deploy skew (404)
 * apart from a blip (200). Without one it probes /offline.html, a static file.
 */
export function reloadWhenReachable(src?: string): void {
  if (typeof window === "undefined" || waiting) return;
  waiting = true;
  let tries = 0;
  const attempt = async (): Promise<void> => {
    if (!navigator.onLine) {
      window.addEventListener("online", () => void attempt(), { once: true });
      return;
    }
    let status: number | null = null;
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 8_000);
      status = (await fetch(src || "/offline.html", { method: "HEAD", cache: "no-store", signal: ctl.signal })).status;
      clearTimeout(t);
    } catch {
      status = null;
    }
    if (probeSaysReload(status)) {
      waiting = false;
      reloadForNewDeploy();
      return;
    }
    tries += 1;
    if (tries < 30) setTimeout(() => void attempt(), Math.min(2_000 * tries, 10_000));
    else waiting = false;
  };
  void attempt();
}
