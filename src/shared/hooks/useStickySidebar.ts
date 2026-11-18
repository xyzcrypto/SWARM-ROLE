"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * A sticky sidebar that works whatever its height.
 *
 * A plain `position: sticky; top: N` column only works while it is shorter than
 * the viewport. Taller than that, its bottom can never scroll into view - which
 * is why the news sidebar was made non-sticky, and why a long feed then showed
 * an empty column beside it ("scroll karne pe gap").
 *
 * So the `top` is computed:
 * - fits in the viewport below the navbar: pin it at `offset` (normal sticky);
 * - taller: pin it by its BOTTOM (`top = viewport - height - gap`, a negative
 *   number). It scrolls with the page until its last card is on screen, then
 *   stays there - every card reachable, and no gap.
 *
 * The style is null on the server and during hydration (nothing to measure yet),
 * so the markup matches what the server sent; it is applied after mount, and
 * re-measured on resize and whenever the column's own content changes height.
 * The caller decides the breakpoint with its own `xl:sticky` class; `top` is
 * inert where the element is not sticky.
 */
export function useStickySidebar<T extends HTMLElement = HTMLElement>(offset: number, gap = 16) {
  const ref = useRef<T | null>(null);
  const [top, setTop] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const h = el.offsetHeight;
        const vh = window.innerHeight;
        setTop(h + offset + gap <= vh ? offset : Math.round(vh - h - gap));
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [offset, gap]);

  const style: CSSProperties | undefined = top == null ? undefined : { top };
  return { ref, style };
}
