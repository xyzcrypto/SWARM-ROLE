"use client";

import { useEffect, useRef } from "react";

/**
 * Thin gold reading-progress bar fixed to the top of the viewport on article
 * pages. Transform-only (no layout work) and driven by a passive scroll
 * listener via rAF, so it costs nothing.
 */
export function ReadingProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 bg-transparent">
      <div
        ref={barRef}
        className="h-full origin-left bg-gradient-to-r from-gold-500 via-gold-300 to-gold-500"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}
