"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { scrollPageTo, scrollPageToTop } from "@shared/hooks/useScrollLock";

/**
 * Where the page sits after a navigation. Two halves, opposite answers:
 *
 *   forward (a link click) -> the top
 *   back / forward button  -> exactly where that entry was left
 *
 * ## Half one: forward navigations landed at the BOTTOM
 *
 * Clicking "Home" from another page dropped the reader in the footer. Measured
 * on a production build at 1280x900:
 *
 *     /research -> /   0px -> 8171px   (the page is 9146px tall)
 *     /news     -> /   0px -> 8246px
 *
 * and not as a jump - a ~1s animation gliding *downward*.
 *
 * Hooking `scrollIntoView` before app code ran showed the App Router calling it
 * once per top-level element of the incoming page, from inside its own
 * `dontForceLayout` handler:
 *
 *     documentElement.scrollTop = 0
 *     scrollIntoView <div.fixed inset-x-0 bottom-0>   the mobile bottom bar
 *     scrollIntoView <footer>
 *     scrollIntoView <main>
 *     scrollIntoView <header.fixed inset-x-0 top-0>
 *
 * The two `fixed` elements are no-ops - always in the viewport - so what the
 * router effectively did was scroll to the footer. Natively the `<main>` call a
 * moment later corrects that, which is why this is not a router bug on its own.
 * But Lenis drives the scroll here: it latched the footer position as its
 * target and eased toward it over its 1.15s duration, arriving last. Last
 * writer wins, and the last writer held a stale target.
 *
 * ## Half two: back never restored anything, anywhere
 *
 *     history.scrollRestoration = "manual"     (set in SmoothScroll)
 *     / @4000px -> /about -> BACK -> @0px
 *
 * That flag was set to fix a different problem - a fresh load reopening
 * part-way down the page - and nothing was put in place of what it switched
 * off. So going back from an article to a list always dumped the reader at the
 * top of the list, on every page of the site.
 *
 * "manual" is still right for a fresh load; what was missing is a restore on
 * `popstate`, which is what the rest of this file is.
 *
 * ## Why the restore keeps re-applying instead of stopping when it lands
 *
 * Two reasons, and the second one cost a debugging round.
 *
 * First, the saved offset is often not reachable at the instant a back
 * navigation commits: the list is still streaming in, images have no height
 * yet, and the document is shorter than the position being aimed at. A single
 * `scrollTo(4000)` clamps to whatever the height happens to be.
 *
 * Second - and this is the one that looked fixed but was not - the router's own
 * `scrollIntoView` walk runs AFTER the restore. An early return on success
 * handed the page straight back to it:
 *
 *     / @4000px -> /about -> BACK -> @8246px      (the footer, again)
 *
 * So the loop runs for its whole budget rather than stopping at the first
 * correct frame. It is the last writer, which on this page is the only way to
 * be the winning one.
 *
 * ## Why it is bounded, and why the reader can interrupt it
 *
 * Half a second of re-applying is invisible if the reader is waiting for the
 * page, and intolerable if they have already started scrolling - it would drag
 * them back every frame. So any deliberate scroll input cancels the restore
 * immediately. Together: it insists just long enough to beat the router, and
 * yields the moment a human disagrees with it.
 */

/** How many frames a restore keeps re-applying. ~0.5s at 60fps. */
const RESTORE_MAX_FRAMES = 30;
/** Close enough to count as restored - sub-pixel and rounding noise. */
const RESTORE_EPSILON = 2;
/** Deliberate scroll input. A `scroll` event will not do: the restore fires those itself. */
const INTERRUPT_EVENTS = ["wheel", "touchstart", "keydown"] as const;

/**
 * Saved offsets, keyed by URL rather than by history entry.
 *
 * Next's App Router does not expose a stable per-entry key without reading its
 * internals, and keying on `pathname + search` costs one thing only: two
 * history entries for the SAME url share a position. That is both rare and
 * roughly what the reader expects anyway.
 *
 * In memory, not sessionStorage: this is a within-session convenience, and a
 * position restored after a reload would be restoring into a page that may
 * have completely different content.
 */
const positions = new Map<string, number>();

const urlKey = () => window.location.pathname + window.location.search;

/**
 * Is a navigation in flight? While it is, the recorder below must not write.
 *
 * ⚠️ This is not defensive coding, it is a bug fix. Without it the recorder
 * captured the ROUTER'S OWN scroll churn as if it were the reader's position:
 *
 *     reader is at 4000 on /  ->  clicks a link
 *     router's scrollIntoView walk drags / to the footer, 8246
 *     recorder is still keyed on "/" and writes 8246
 *     ...back later restores 8246, i.e. the footer
 *
 * which produced exactly the symptom the restore was written to fix, from the
 * other direction. The freeze starts at the click - before any of that churn -
 * and lifts once the incoming page has settled.
 */
let navigating = false;
let thawTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Stop recording, and promise to start again whatever happens.
 *
 * The freeze is normally lifted by the settle at the end of the navigation -
 * but a click on a link that does not navigate (`href="#"`, a handler that
 * calls `preventDefault` after us, a route that resolves to the page we are
 * already on) never produces one. Without the timer the recorder would be
 * silently dead for the rest of the session, and the next Back would restore a
 * position from minutes ago. Longer than any settle window, so it never fires
 * during a real navigation.
 */
function freeze() {
  navigating = true;
  clearTimeout(thawTimer);
  thawTimer = setTimeout(() => {
    navigating = false;
  }, 2000);
}

function thaw() {
  navigating = false;
  clearTimeout(thawTimer);
}

export function RouteScroll() {
  const pathname = usePathname();
  const popped = useRef(false);
  // Skip the very first run: a fresh load is already at the top (SmoothScroll
  // pins it there on mount), and forcing it again would undo a deep link.
  const first = useRef(true);

  // Track the current offset for whatever entry we are on. Passive and
  // rAF-coalesced: this fires on every scroll event on every page, so it must
  // cost nothing - one number written per frame at most, no layout read beyond
  // `scrollY`, which is already cached by the browser between frames.
  useEffect(() => {
    let queued = false;
    const onScroll = () => {
      if (navigating || queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        if (!navigating) positions.set(urlKey(), window.scrollY);
      });
    };

    // Capture phase, on the document, for the same reason SameRouteTopScroll
    // does it there: it has to see the click before any component's own handler
    // can stop it, and before the router starts moving the page. This is the
    // earliest honest moment to say "the reader has left this position".
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || !a.getAttribute("href")) return;
      // Freeze on any same-origin link. A cross-origin one leaves the SPA
      // entirely, so the in-memory map is about to be irrelevant anyway.
      if (a.origin && a.origin !== window.location.origin) return;
      freeze();
    };

    const onPop = () => {
      popped.current = true;
      freeze();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    // A hash target is HashScroll's job in both directions; jumping to the top
    // or to a saved offset would fight it.
    if (window.location.hash) {
      popped.current = false;
      return;
    }

    const wasPop = popped.current;
    popped.current = false;
    const target = wasPop ? positions.get(urlKey()) : undefined;

    let frame = 0;
    let frames = 0;
    let cancelled = false;

    // Any deliberate scroll input ends the restore. Deliberately NOT the
    // `scroll` event - the restore fires those itself and would cancel on its
    // own first frame.
    const interrupt = () => {
      // A deliberate scroll is the reader taking the position back, so the
      // freeze lifts with the restore rather than waiting out the budget.
      cancelled = true;
      thaw();
    };
    for (const e of INTERRUPT_EVENTS) window.addEventListener(e, interrupt, { passive: true });

    const step = () => {
      if (cancelled) return;
      if (target === undefined) scrollPageToTop();
      else scrollPageTo(target);
      // No early return on success: the router's `scrollIntoView` walk lands
      // after this, so stopping at the first correct frame hands the page back
      // to it. Running the full budget is what makes this the last writer.
      if (++frames >= RESTORE_MAX_FRAMES) {
        // Settled: the reader owns the scroll position again, so start
        // recording it. Anything before this point was the router or us.
        thaw();
        return;
      }
      frame = requestAnimationFrame(step);
    };

    // Two nested frames before the first attempt, because the router's walk
    // lands on the frame after paint and Lenis's tick after that. A single
    // frame lands in the middle of that sequence and is overwritten.
    const firstFrame = requestAnimationFrame(() => {
      // A forward navigation is settled once the router and Lenis have both
      // had their frame; only a restore needs to hold the position while the
      // page fills in underneath it.
      frames = target === undefined ? RESTORE_MAX_FRAMES - 2 : 0;
      frame = requestAnimationFrame(step);
    });

    return () => {
      cancelled = true;
      thaw();
      cancelAnimationFrame(firstFrame);
      if (frame) cancelAnimationFrame(frame);
      for (const e of INTERRUPT_EVENTS) window.removeEventListener(e, interrupt);
    };
  }, [pathname]);

  return null;
}
