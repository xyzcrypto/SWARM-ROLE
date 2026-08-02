"use client";

import { useEffect } from "react";

/**
 * Makes in-page `#hash` links actually land on their target.
 *
 * Why this exists (measured, not guessed): homepage sections carry `.sect-cv`
 * (`content-visibility: auto; contain-intrinsic-size: auto 720px`), which skips
 * render work for off-screen sections. Until a section has rendered once, the
 * browser sizes it from that 720px guess rather than its real height. Measured
 * on a 390px viewport with a cold load:
 *
 *     section        placeholder    real
 *     #about             832px     3853px
 *     #products          832px     6259px   (reported at y=3487, really ~8242)
 *
 * So clicking "View products" told the browser to scroll to y=3487. On the way
 * there every section it passed rendered for the first time and grew by
 * thousands of pixels, pushing the real target far below where the scroll
 * stopped. You land in the middle of About and it reads as "the button does
 * nothing". Desktop mostly escaped it because there the 720px guess is close to
 * the real height (#about is 687px wide-screen); mobile stacks single-column, so
 * the guess is off by 4-5x. That's exactly why it failed only on phones.
 *
 * The fix is not to drop `content-visibility` - it's a real mobile scroll win -
 * but to scroll, let the layout settle, and correct, until the target stops
 * moving. We intercept the click ourselves rather than listen for `hashchange`
 * because the App Router navigates with `pushState`, which never fires it.
 */

// Match native anchor behaviour: `html { scroll-padding-top: 88px }` clears the
// sticky navbar. Read it rather than hardcoding, so the two can't drift.
function scrollOffset() {
  const v = getComputedStyle(document.documentElement).scrollPaddingTop;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

// How long to keep correcting, and how long the target has to hold still
// before we call it settled. A few frames of stillness is NOT enough: sections
// render in bursts as they near the viewport, so there are real lulls mid-flight
// where nothing moves for two or three frames and then the page grows again. A
// 320px viewport reproducibly stopped ~888px short on a 3-frame rule and lands
// exactly on target at 350ms.
// The budget has to cover the *clamped* case too: while the page is still made
// mostly of 720px placeholders the document isn't yet tall enough to scroll as
// far as the target needs, so several rounds of "scroll to the bottom, let more
// sections render, scroll further" are needed before the target is even
// reachable. A 320px viewport needs measurably more of those rounds than a
// 390px one, and ran out of road at 1500ms.
const SETTLE_BUDGET_MS = 3000;
const SETTLE_STILL_MS = 350;

/**
 * Scroll to `el` and keep correcting while the page reflows underneath us.
 * Gives up once the target has held position for SETTLE_STILL_MS, once the
 * budget runs out, or the moment the reader scrolls for themselves - we are
 * correcting for a layout bug, not taking the scrollbar away from them.
 */
function settleScrollTo(el: HTMLElement) {
  const offset = scrollOffset();
  const start = performance.now();
  let stillSince = 0;
  let cancelled = false;

  const cancel = () => {
    cancelled = true;
  };
  // Any deliberate scroll input hands control straight back.
  const opts = { passive: true, once: true } as const;
  window.addEventListener("wheel", cancel, opts);
  window.addEventListener("touchstart", cancel, opts);
  window.addEventListener("keydown", cancel, opts);

  const done = () => {
    window.removeEventListener("wheel", cancel);
    window.removeEventListener("touchstart", cancel);
    window.removeEventListener("keydown", cancel);
  };

  const step = (now: number) => {
    if (cancelled) return done();

    const target = Math.max(0, el.getBoundingClientRect().top + window.scrollY - offset);

    if (Math.abs(target - window.scrollY) > 2) {
      stillSince = 0;
      // "instant", emphatically not "auto". `auto` means "defer to CSS", and
      // this site sets `html { scroll-behavior: smooth }` - so `auto` animates.
      // An animated correction is worse than none: the tween is still in flight
      // when the next frame measures, so the loop reads a position it hasn't
      // reached yet, and the whole thing settles wherever the first tween
      // happened to end up. These are corrections, and they have to land now.
      window.scrollTo({ top: target, behavior: "instant" });
    } else {
      if (!stillSince) stillSince = now;
      if (now - stillSince >= SETTLE_STILL_MS) return done(); // layout has settled
    }

    if (now - start < SETTLE_BUDGET_MS) requestAnimationFrame(step);
    else done();
  };

  requestAnimationFrame(step);
}

/**
 * Scroll to an in-page target by hash, e.g. `scrollToHash("#products")`.
 *
 * Exported so a component can invoke the exact same landing logic directly from
 * its own onClick, instead of relying on the document-level listener below. The
 * hero's "View products" does that: it was reported broken three separate times,
 * each fix measured correct here and still failed on the owner's phone, so it no
 * longer depends on the chain (Link -> router -> document listener -> scroll) at
 * all. Belt and braces - whichever path runs first wins, and running both is
 * harmless because the second finds the target already in place.
 *
 * Returns false if there is no such element, so the caller can let the browser
 * handle it normally rather than swallowing a click that would have worked.
 */
export function scrollToHash(hash: string): boolean {
  if (typeof document === "undefined") return false;
  const el = targetFor(hash);
  if (!el) return false;
  if (window.location.hash !== hash) {
    window.history.pushState(null, "", hash);
  }
  settleScrollTo(el);
  return true;
}

function targetFor(hash: string): HTMLElement | null {
  if (!hash || hash === "#") return null;
  let id = hash.slice(1);
  try {
    id = decodeURIComponent(id);
  } catch {
    /* malformed escape - fall back to the raw value */
  }
  return document.getElementById(id);
}

export function HashScroll() {
  useEffect(() => {
    // Landing directly on /#products (a real navigation from another route)
    // hits the same growing-layout problem, so settle that too.
    const initial = targetFor(window.location.hash);
    if (initial) settleScrollTo(initial);

    const onClick = (e: MouseEvent) => {
      // Leave anything that isn't a plain left-click to the browser: modifier
      // clicks open new tabs, and that should keep working.
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as Element | null)?.closest?.("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || !href.includes("#")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }

      // Only same-document jumps. A hash link to a *different* page is a real
      // navigation - let the router do it; our mount effect settles it there.
      if (url.origin !== window.location.origin) return;
      if (url.pathname !== window.location.pathname || url.search !== window.location.search) return;

      const el = targetFor(url.hash);
      if (!el) return; // no such section on this page - don't swallow the click

      e.preventDefault();
      if (window.location.hash !== url.hash) {
        window.history.pushState(null, "", url.hash);
      }
      settleScrollTo(el);
    };

    // Capture phase: framer-motion wraps these CTAs (`motion(Link)` in
    // ActionLink) and the App Router attaches its own handler, so we need to
    // win before either of them acts on the click.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
