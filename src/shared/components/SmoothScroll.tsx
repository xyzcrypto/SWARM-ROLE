"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import { registerSmoothScroll } from "@shared/hooks/useScrollLock";

/**
 * Buttery momentum smooth-scrolling (Lenis). Disabled automatically when the
 * user prefers reduced motion, and on touch devices - native momentum scroll
 * is smoother there and skipping the rAF loop saves main-thread time/battery.
 */
export function SmoothScroll() {
  const pathname = usePathname();
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Always start at the top on a fresh load - never restore a previous scroll
    // position or jump to an in-page section - unless the URL targets an anchor.
    // (Fixes the homepage opening part-way down at the About section.)
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
    if (!window.location.hash) window.scrollTo(0, 0);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.6,
      // Hand the wheel back to any element that scrolls on its own.
      //
      // Without this, Lenis swallows every wheel event and scrolls the PAGE -
      // so on desktop no inner scroll container on the site could be scrolled
      // with a mouse wheel. Measured before this fix, with the Publish editor
      // full of text: wheel over the editor left its scrollTop at 0 and moved
      // the page behind it instead, at 1280x800 and 1920x1080. Mobile was fine
      // only because Lenis already opts out on coarse pointers (line above),
      // which is why this never showed up on a phone. It affected the rich text
      // editor, the news briefing, every textarea, the chat list, the mobile
      // nav sheet - anything with its own scrollbar.
      //
      // `data-lenis-prevent` was already the intended escape hatch (globals.css
      // styles it) but it had been applied to exactly zero elements. Detecting
      // scrollability directly is used instead of annotating each container by
      // hand, so a scroll container added later cannot silently reintroduce
      // this - the attribute is still honoured for anything that needs to opt
      // out explicitly.
      prevent: (node) => {
        if (!node || node.nodeType !== 1) return false;
        if (node.hasAttribute?.("data-lenis-prevent")) return true;
        // Only claim the wheel when the element can actually consume it.
        if (node.scrollHeight <= node.clientHeight) return false;
        const overflowY = getComputedStyle(node).overflowY;
        return overflowY === "auto" || overflowY === "scroll";
      },
    });
    lenisRef.current = lenis;

    document.documentElement.classList.add("lenis");
    // Hand the stop/start controls to the scroll-lock helper. Lenis drives the
    // scroll position itself, so `body { overflow: hidden }` alone does not
    // hold the page still behind a modal - see useScrollLock.ts.
    // `toOffset` is what lets a route change actually land where it should.
    // Lenis holds its own target position and rewrites the scroll on every rAF
    // tick, so a native `window.scrollTo` it did not initiate is undone on the
    // next frame. `immediate` skips the easing - arriving at a route should be
    // instant, not a second-long glide after the new page has already painted.
    registerSmoothScroll({
      stop: () => lenis.stop(),
      start: () => lenis.start(),
      toOffset: (y) => lenis.scrollTo(y, { immediate: true, force: true }),
      // `smoothTo` is the eased counterpart, for an in-page move the reader
      // asked for - tapping "N new stories", tapping a token chip. Those had
      // been written as `window.scrollTo({ behavior: "smooth" })`, which Lenis
      // undoes on its next tick exactly like the immediate case.
      smoothTo: (y) => lenis.scrollTo(y, { force: true }),
    });

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      registerSmoothScroll(null);
      lenis.destroy();
      lenisRef.current = null;
      document.documentElement.classList.remove("lenis");
    };
  }, []);

  // Reset scroll to top on page navigation (unless URL targets an in-page anchor).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash) return;

    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { immediate: true });
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
