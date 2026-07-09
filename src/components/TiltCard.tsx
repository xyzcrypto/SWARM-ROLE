"use client";

import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

// A subtle pointer-driven 3D tilt wrapper for cards. Mirrors the Hero medallion
// math (rAF-throttled pointer read → spring rotateX/rotateY) so it feels premium
// without jank. No-op on touch (pointerType !== "mouse") and when the visitor
// prefers reduced motion; springs back flat on leave. Wraps an existing card as
// a separate transform layer, so the card keeps its own .surface/.lift/group.
export function TiltCard({ children, className, max = 6 }: { children: ReactNode; className?: string; max?: number }) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [max, -max]), { stiffness: 150, damping: 15 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-max, max]), { stiffness: 150, damping: 15 });
  const raf = useRef(0);

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return; // no tilt on touch/pen
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (raf.current) return;
    const el = e.currentTarget;
    const { clientX, clientY } = e;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const r = el.getBoundingClientRect();
      mx.set((clientX - r.left) / r.width - 0.5);
      my.set((clientY - r.top) / r.height - 0.5);
    });
  }

  function onLeave() {
    if (raf.current) { cancelAnimationFrame(raf.current); raf.current = 0; }
    mx.set(0);
    my.set(0);
  }

  return (
    <motion.div
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900, transformStyle: "preserve-3d" }}
      className={cn("h-full", className)}
    >
      {children}
    </motion.div>
  );
}
