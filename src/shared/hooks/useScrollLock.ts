"use client";

import { useEffect } from "react";

/**
 * Freeze the page behind a modal / sheet / dialog.
 *
 * `document.body.style.overflow = "hidden"` on its own is NOT enough on this
 * site, and that is worth spelling out because it looks like it should be.
 * Lenis (`SmoothScroll.tsx`) runs its own rAF loop and drives the scroll
 * position with `window.scrollTo`, which does not care what `overflow` says -
 * measured with the follow list open: the profile behind it still moved 171px
 * on a phone-width viewport and 20px on desktop for one wheel gesture. So the
 * lock has to tell Lenis to stand down as well.
 *
 * Rather than thread the Lenis instance through the tree, SmoothScroll parks it
 * here via `registerSmoothScroll` and this hook stops/starts it. If smooth
 * scrolling is off (reduced motion, touch device) there is simply nothing
 * registered and the overflow half does the whole job.
 *
 * Locks nest: two dialogs open at once each hold a claim, and the page is only
 * released when the last one lets go - otherwise closing the inner one would
 * unfreeze the page under the outer one.
 */

type Controls = { stop: () => void; start: () => void };

let smooth: Controls | null = null;
let depth = 0;
let previousOverflow = "";

/** Called by SmoothScroll once Lenis is up, and with null when it tears down. */
export function registerSmoothScroll(controls: Controls | null) {
  smooth = controls;
  // A lock that was taken before Lenis existed still applies to it.
  if (controls && depth > 0) controls.stop();
}

export function lockScroll() {
  depth += 1;
  if (depth > 1) return;
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  smooth?.stop();
}

export function unlockScroll() {
  depth = Math.max(0, depth - 1);
  if (depth > 0) return;
  document.body.style.overflow = previousOverflow;
  smooth?.start();
}

/** Hold the lock for as long as the component is mounted (or `active` is true). */
export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;
    lockScroll();
    return unlockScroll;
  }, [active]);
}
