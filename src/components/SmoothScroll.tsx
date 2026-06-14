"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Buttery momentum smooth-scrolling (Lenis). Disabled automatically when the
 * user prefers reduced motion, and on touch devices — native momentum scroll
 * is smoother there and skipping the rAF loop saves main-thread time/battery.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Always start at the top on a fresh load — never restore a previous scroll
    // position or jump to an in-page section — unless the URL targets an anchor.
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
    });

    document.documentElement.classList.add("lenis");

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      document.documentElement.classList.remove("lenis");
    };
  }, []);

  return null;
}
