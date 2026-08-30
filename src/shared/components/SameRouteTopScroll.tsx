"use client";

import { useEffect } from "react";

/**
 * Restores scroll-to-top when a link points at the page you are already on.
 *
 * Why this exists (measured, not guessed). A plain `<a href="/">` on `/` is a
 * full document load in a normal browser, so it lands you at the top. The App
 * Router turns that into a same-route client navigation and does nothing at all
 * - no navigation, no scroll - so the reader is left exactly where they were.
 * Parked at the footer and clicking "Home", nothing happens, and it reads as a
 * dead link.
 *
 * Reproduced on the homepage before this component existed (dev server,
 * Chromium, clicked while parked at the bottom):
 *
 *     desktop  footer Home      8335px -> 8335px   dead
 *     desktop  nav rail Home    8335px -> 8335px   dead
 *     mobile   drawer Home     13237px ->     0    worked
 *     mobile   footer Home     13237px -> 13237px  dead
 *
 * The drawer worked because `Navbar` had its own `onNavClick` doing this by
 * hand. That is the actual lesson here: the behaviour was wired to one of the
 * four link lists and forgotten in the other three, and nothing could catch
 * that - so this is handled once, at the document, rather than asking every
 * present and future link list to remember. Same reasoning as `HashScroll`
 * next door, and as dropping navigation caching in `public/sw.js`: remove the
 * class of bug instead of re-fixing instances of it.
 *
 * Deliberately NOT handled here:
 *  - Links carrying a `#hash`. Those are `HashScroll`'s job, and it runs on the
 *    same capture phase; jumping to the top would fight it.
 *  - Cross-route navigation. The router already scrolls to top for those.
 */
export function SameRouteTopScroll() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // Leave anything that is not a plain left-click alone: modifier clicks
      // open new tabs, and that must keep working.
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as Element | null)?.closest?.("a");
      if (!anchor) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;
      // A hash link is HashScroll's, even when it points at this same route.
      if (url.hash) return;
      // Only when it is genuinely the page we are on. A different query string
      // is a real navigation and the router handles its own scroll.
      if (url.pathname !== window.location.pathname) return;
      if (url.search !== window.location.search) return;

      // Already at the top: nothing to do, and staying out of the way means a
      // click here behaves exactly as it did before.
      if (window.scrollY <= 0) return;

      // The router would do nothing with this click anyway, so taking it is
      // safe - and it stops the URL's hash (if the reader arrived via an anchor
      // earlier) from being re-applied underneath us.
      e.preventDefault();

      // Matches the behaviour Navbar's own handler had: the site's
      // reduced-motion policy exempts brand animation, not a navigation jump
      // someone may be sensitive to.
      const reduced =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    };

    // Capture phase, for the same reason HashScroll uses it: framer-motion wraps
    // some of these links (`motion(Link)` in ActionLink) and the App Router
    // attaches its own handler, so this has to win before either acts.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
