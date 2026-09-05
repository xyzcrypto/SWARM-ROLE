"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { registerSmoothScroll } from "@shared/hooks/useScrollLock";

/**
 * Buttery momentum smooth-scrolling (Lenis). Disabled automatically when the
 * user prefers reduced motion, and on touch devices - native momentum scroll
 * is smoother there and skipping the rAF loop saves main-thread time/battery.
 */
export function SmoothScroll() {
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

    document.documentElement.classList.add("lenis");
    // Hand the stop/start controls to the scroll-lock helper. Lenis drives the
    // scroll position itself, so `body { overflow: hidden }` alone does not
    // hold the page still behind a modal - see useScrollLock.ts.
    // `toTop` is what lets a route change actually land at the top. Lenis holds
    // its own target position and rewrites the scroll on every rAF tick, so a
    // native `window.scrollTo(0, 0)` it did not initiate is undone on the next
    // frame. `immediate` skips the easing - a route change should arrive at the
    // top, not glide there for a second after the new page has painted.
    registerSmoothScroll({
      stop: () => lenis.stop(),
      start: () => lenis.start(),
      toTop: () => lenis.scrollTo(0, { immediate: true, force: true }),
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
      document.documentElement.classList.remove("lenis");
    };
  }, []);

  return null;
}
