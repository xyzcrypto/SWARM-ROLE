"use client";

import { useEffect, useRef } from "react";
import { loadAnime, prefersReducedMotion } from "@/lib/anime";

// Premium "magnetic" hover: the child eases toward the pointer while hovering and
// springs back (anime.js, elastic) on leave. Fully disabled for reduced-motion or
// coarse pointers (touch). anime.js is lazy-loaded on first leave, so it never
// touches the initial bundle.
export function MagneticButton({
  children,
  className = "",
  strength = 0.3,
}: {
  children: React.ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    let raf = 0;
    const onMove = (e: MouseEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = el.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) * strength;
        const y = (e.clientY - (r.top + r.height / 2)) * strength;
        el.style.transform = `translate(${x}px, ${y}px)`;
      });
    };
    const onLeave = async () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      const { animate } = await loadAnime();
      animate(el, { translateX: 0, translateY: 0, duration: 700, ease: "outElastic(1, .6)" });
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [strength]);

  return (
    <span ref={ref} className={`inline-block will-change-transform ${className}`}>
      {children}
    </span>
  );
}
