"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * One resilient fetch loop, so every live surface stops hand-rolling its own.
 *
 * ## Why this exists
 *
 * Audited across the live surfaces (DM inbox, DM thread, navbar badges, ticker,
 * journal feed, markets, news): **not one of them retried a failed request, and
 * not one listened for the network coming back.** Every loop was
 * `setInterval(fetch)` with the error swallowed. So a single failed request -
 * a dropped connection, a 503 from a busy database, a phone switching from
 * wifi to mobile data - left that surface showing stale data until the next
 * tick, and if the tick also failed, until the user reloaded the page.
 *
 * That is the shape of "kabhi kabhi data sync nahi hota" and "refresh ke baad
 * kaam karta hai": nothing is broken permanently, and nothing recovers on its
 * own either.
 *
 * Fixing that per component is what made it recur - each fix covered one loop.
 * This is the primitive they can share:
 *
 *  - **Retry with backoff** after a failure (1s, 2s, 4s … capped), independent
 *    of the poll interval, so a transient error costs a second rather than a
 *    whole interval.
 *  - **Revalidate on wake** - `visibilitychange`, `focus` and `online`. Coming
 *    back to a tab, or back onto the network, is exactly when data is stalest;
 *    waiting out an interval there is what feels like "stuck".
 *  - **Never overlap.** An in-flight request is not duplicated, so a slow
 *    response cannot pile up behind a fast interval.
 *  - **Pause while hidden**, so a backgrounded tab costs nothing.
 *  - **Report failure** via `failures`, so a surface can say it is stale
 *    instead of quietly showing old data.
 */

const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 30_000;
/** Wake events can fire together; collapse them into one request. */
const WAKE_THROTTLE_MS = 3000;

/** Exponential backoff, exported for its unit test. */
export function backoffDelay(failures: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, failures - 1), BACKOFF_MAX_MS);
}

/**
 * Is a wake worth a request, given how long ago the last one started?
 *
 * The 3s floor collapses the three wake events - `visibilitychange`, `focus`
 * and `online` all fire together when a tab comes forward - into one request.
 * That is all it was ever doing, so any surface whose data is cached for
 * minutes still refetched on every glance at the tab.
 *
 * `/markets` is where that becomes visible: nine of these loops run on it (six
 * hub feeds, two perp charts, the shared ticker), and every one of those routes
 * caches for 150-300 seconds server-side. A three-second app switch on a phone
 * - the most ordinary thing a phone does - fired nine requests whose responses
 * could not differ from what the page already had.
 *
 * Callers whose freshness is bounded by a server cache pass `wakeMinAgeMs`
 * (their own poll interval). Surfaces where returning to the tab should feel
 * instant - a DM thread, notification badges - leave it alone and keep the 3s
 * floor. There is no single right answer here, which is why it is a parameter.
 *
 * Exported for its unit test; the timing is the whole behaviour.
 */
export function wakeIsDue(now: number, lastRunAt: number, wakeMinAgeMs?: number): boolean {
  return now - lastRunAt >= Math.max(WAKE_THROTTLE_MS, wakeMinAgeMs ?? 0);
}

type Options = {
  /** Runs the request. Throw (or reject) to signal failure - that drives retry. */
  load: () => Promise<void>;
  /** Poll interval while the tab is visible. Omit for wake-only refreshing. */
  intervalMs?: number;
  /**
   * Minimum age before a wake (visibility/focus/online) is worth a request.
   * Defaults to the 3s event-collapsing floor. Pass the poll interval when the
   * response is cached server-side for that long anyway - see `wakeIsDue`.
   */
  wakeMinAgeMs?: number;
  enabled?: boolean;
};

export function useLiveData({ load, intervalMs, wakeMinAgeMs, enabled = true }: Options) {
  const [failures, setFailures] = useState(0);

  const loadRef = useRef(load);
  // Written after commit, never during render, and only read from async
  // timers/handlers that run long after the effect has flushed.
  useEffect(() => {
    loadRef.current = load;
  });

  const inFlight = useRef(false);
  const failRef = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // When the last request STARTED. Marking on completion would let a burst of
  // rapid tab switches stack overlapping requests that each read a `lastRunAt`
  // from before any of them began.
  const lastRunAt = useRef(0);
  const alive = useRef(true);

  const run = useCallback(async (reason: "mount" | "interval" | "wake" | "retry") => {
    if (!alive.current || inFlight.current) return;
    if (reason !== "mount" && typeof document !== "undefined" && document.hidden) return;
    lastRunAt.current = Date.now();
    inFlight.current = true;
    try {
      await loadRef.current();
      if (!alive.current) return;
      if (failRef.current !== 0) {
        failRef.current = 0;
        setFailures(0);
      }
      clearTimeout(retryTimer.current);
    } catch {
      if (!alive.current) return;
      failRef.current += 1;
      setFailures(failRef.current);
      // Retry on its own schedule rather than waiting for the next interval -
      // the whole point is that a blip costs a second, not a cycle.
      clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => void run("retry"), backoffDelay(failRef.current));
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    alive.current = true;
    void run("mount");

    const timer = intervalMs && intervalMs > 0 ? setInterval(() => void run("interval"), intervalMs) : undefined;

    const wake = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      // A failing surface drops back to the bare 3s floor rather than skipping
      // the gate: the user arriving is a good moment to try again - the network
      // may well have changed underneath it - but "keep retrying on every tab
      // switch" would rebuild the burst precisely while upstream is down, which
      // is when it costs the most. The backoff timer is already running anyway.
      const minAge = failRef.current > 0 ? undefined : wakeMinAgeMs;
      if (!wakeIsDue(Date.now(), lastRunAt.current, minAge)) return;
      clearTimeout(retryTimer.current);
      void run("wake");
    };

    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);

    return () => {
      alive.current = false;
      if (timer) clearInterval(timer);
      clearTimeout(retryTimer.current);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
    };
  }, [run, intervalMs, wakeMinAgeMs, enabled]);

  /** Force a refresh now (e.g. after the user takes an action). */
  const refresh = useCallback(() => void run("wake"), [run]);

  return { failures, stale: failures > 0, refresh };
}
