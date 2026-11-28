"use client";

import { useEffect, useRef } from "react";

/**
 * A thin gold-to-mint bar at the very top that fills as the lesson is read.
 * Moved with a transform from a rAF-throttled scroll listener, so scrolling
 * never re-renders React. Decorative only (aria-hidden).
 */
export function ReadingProgress() {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      const h = document.documentElement;
      const max = Math.max(1, h.scrollHeight - h.clientHeight);
      const k = Math.min(1, Math.max(0, h.scrollTop / max));
      if (bar.current) bar.current.style.transform = `scaleX(${k})`;
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60]" aria-hidden>
      <div ref={bar} className="h-[0.1875rem] origin-left bg-gradient-to-r from-gold-400 via-gold-300 to-mint-400 shadow-[0_0_12px_rgba(226,167,47,0.6)]" style={{ transform: "scaleX(0)" }} />
    </div>
  );
}
