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

type Options = {
  /** Runs the request. Throw (or reject) to signal failure - that drives retry. */
  load: () => Promise<void>;
  /** Poll interval while the tab is visible. Omit for wake-only refreshing. */
  intervalMs?: number;
  enabled?: boolean;
};

export function useLiveData({ load, intervalMs, enabled = true }: Options) {
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
  const lastWake = useRef(0);
  const alive = useRef(true);

  const run = useCallback(async (reason: "mount" | "interval" | "wake" | "retry") => {
    if (!alive.current || inFlight.current) return;
    if (reason !== "mount" && typeof document !== "undefined" && document.hidden) return;
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
      const now = Date.now();
      if (now - lastWake.current < WAKE_THROTTLE_MS) return;
      lastWake.current = now;
      // A wake is also the moment to abandon a long backoff: the user is here
      // now, and the network may well have changed underneath it.
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
  }, [run, intervalMs, enabled]);

  /** Force a refresh now (e.g. after the user takes an action). */
  const refresh = useCallback(() => void run("wake"), [run]);

  return { failures, stale: failures > 0, refresh };
}
