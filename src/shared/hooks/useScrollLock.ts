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

type Controls = { stop: () => void; start: () => void; toTop: () => void };

let smooth: Controls | null = null;
let depth = 0;
let previousOverflow = "";
let previousPaddingRight = "";

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
  previousPaddingRight = document.body.style.paddingRight;
  // Hiding overflow takes the scrollbar away, and the page widens by its width
  // the instant a dialog opens. Measured with the news reader: the page behind
  // it shifted by 4px on open - small, but it reads as a jolt exactly when
  // attention moves to the dialog. Hold the width by replacing the scrollbar
  // with padding.
  const gap = window.innerWidth - document.documentElement.clientWidth;
  if (gap > 0) {
    const current = parseFloat(getComputedStyle(document.body).paddingRight) || 0;
    document.body.style.paddingRight = `${current + gap}px`;
  }
  document.body.style.overflow = "hidden";
  smooth?.stop();
}

export function unlockScroll() {
  depth = Math.max(0, depth - 1);
  if (depth > 0) return;
  document.body.style.overflow = previousOverflow;
  document.body.style.paddingRight = previousPaddingRight;
  smooth?.start();
}

/**
 * Jump the page to the top immediately, taking the smooth-scroll engine with it.
 *
 * `window.scrollTo(0, 0)` alone is not enough while Lenis is running. Lenis owns
 * an internal target position and writes it back on its own rAF tick, so a
 * native scroll it did not initiate is simply undone on the next frame. Both
 * halves have to move, which is why this lives next to the lock controls rather
 * than being called inline at the two places that need it.
 *
 * No-op beyond the native scroll when Lenis is not running (touch devices,
 * reduced motion) - there is nothing registered, and native is already correct.
 */
export function scrollPageToTop() {
  if (typeof window === "undefined") return;
  window.scrollTo(0, 0);
  smooth?.toTop();
}

/** Hold the lock for as long as the component is mounted (or `active` is true). */
export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;
    lockScroll();
    return unlockScroll;
  }, [active]);
}
