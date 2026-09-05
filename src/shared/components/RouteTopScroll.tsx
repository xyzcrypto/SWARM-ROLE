"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { scrollPageToTop } from "@shared/hooks/useScrollLock";

/**
 * Land at the top of the page after a cross-route navigation.
 *
 * ## The bug this fixes
 *
 * Clicking "Home" (or the logo) from another page dropped the reader at the
 * **bottom** of the homepage instead of the hero. Reproduced on a production
 * build, 1280x900, clicking the header link:
 *
 *     /research -> /   0px -> 8171px   (page is 9146px tall)
 *     /news     -> /   0px -> 8246px
 *
 * and the scroll trace showed it was not an instant jump but a ~1s animation
 * gliding downward: `0 -> 9 -> 3750 -> 7712 -> 8171`.
 *
 * ## Why it happened
 *
 * Two systems both moving the scroll, in the wrong order.
 *
 * Hooking `scrollIntoView` and `documentElement.scrollTop` before app code ran
 * showed the App Router calling `scrollIntoView()` once per top-level element
 * of the incoming page, from inside its own `dontForceLayout` handler:
 *
 *     documentElement.scrollTop = 0
 *     scrollIntoView <div.fixed inset-x-0 bottom-0>   (the mobile bottom bar)
 *     scrollIntoView <footer>
 *     scrollIntoView <main>
 *     scrollIntoView <header.fixed inset-x-0 top-0>
 *
 * The two `fixed` elements are no-ops - they are always in the viewport - so
 * what the router actually did was scroll to the **footer**. Natively that is
 * then corrected by the `<main>` call a moment later, which is why this never
 * showed up as a router bug on its own. But Lenis is driving the scroll, and it
 * latched the footer position as its target and eased toward it over its 1.15s
 * duration, arriving after the router had finished. The last writer wins, and
 * the last writer was the smooth-scroll engine holding a stale target.
 *
 * That is also why it looked intermittent: whether the router's element walk
 * ends on a `fixed` element depends on where the reader was on the page they
 * left, so the same click behaved differently from different pages.
 *
 * ## Why the fix is here and not in the router or in Lenis
 *
 * Nothing is monkey-patched and no scroll is cancelled - this simply runs
 * **after** both of them and sets the position both must agree on. `scrollPageToTop`
 * moves the native scroll and Lenis's internal target together (see
 * useScrollLock.ts); moving only one is what the bug was made of.
 *
 * Two frames, not one: the router's `scrollIntoView` calls land on the frame
 * after paint, and Lenis's rAF tick after that. One frame lands in the middle of
 * that sequence and gets overwritten.
 *
 * ## Deliberately NOT handled
 *
 * - **Back / forward.** A reader returning to a list expects to come back where
 *   they were, so a `popstate` navigation is left alone entirely. This is also
 *   what keeps this component out of the way of proper scroll restoration.
 * - **Hash links.** `HashScroll` owns those; jumping to the top would fight it.
 * - **Same-route clicks** (clicking "Home" while already on `/`). No pathname
 *   change means no navigation and no effect here - that is `SameRouteTopScroll`'s
 *   job, and the two do not overlap.
 * - **Query-string-only changes** (`/news` -> `/news?category=DeFi`). A filter
 *   change is not a new page and should not throw the reader to the top.
 *
 * Note the deliberate absence of `useSearchParams()`, which would have been the
 * obvious way to cover that last case: called from the root layout it forces
 * every page under it to bail out of static rendering unless wrapped in its own
 * Suspense boundary. `usePathname()` carries no such cost.
 */
export function RouteTopScroll() {
  const pathname = usePathname();
  const popped = useRef(false);
  // Skip the very first run: a fresh load is already at the top (SmoothScroll
  // pins it there on mount), and forcing it again would undo a deep link.
  const first = useRef(true);

  useEffect(() => {
    const onPop = () => {
      popped.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (popped.current) {
      popped.current = false;
      return;
    }
    if (window.location.hash) return;

    let second = 0;
    const firstFrame = requestAnimationFrame(() => {
      scrollPageToTop();
      second = requestAnimationFrame(scrollPageToTop);
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (second) cancelAnimationFrame(second);
    };
  }, [pathname]);

  return null;
}
