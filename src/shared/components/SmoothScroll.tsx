"use client";

import { useEffect } from "react";

/**
 * Scroll setup for the whole site. It used to start Lenis (JS "momentum"
 * smooth scrolling) on desktop, and that was the lag.
 *
 * Why Lenis is gone (2026-11-20): Lenis turns every wheel tick into a
 * `window.scrollTo` on each animation frame, so scrolling runs on the main
 * thread. Profiled on /news while wheel-scrolling, `scrollTo` alone took ~1 s
 * of CPU in 6 s, and any other work on the page (a re-render, a chart, a
 * poller) delayed those frames, so the page stuttered and trailed the hand
 * ("lag hota hai"). Lowering its duration (1.15 s → 0.75 s on 2026-11-18)
 * only shortened the trail. Native scrolling runs on the compositor thread:
 * it stays smooth even while JavaScript is busy, it is what phones already
 * used here, and it removes a dependency from every page.
 *
 * `useScrollLock` still exposes the same helpers; with no engine registered
 * they use native `window.scrollTo`, which is now the only scroller.
 */
export function SmoothScroll() {
  useEffect(() => {
    // Always start at the top on a fresh load - never restore a previous scroll
    // position or jump to an in-page section - unless the URL targets an anchor.
    // (Fixes the homepage opening part-way down at the About section.)
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
    if (!window.location.hash) window.scrollTo(0, 0);
  }, []);

  return null;
}
