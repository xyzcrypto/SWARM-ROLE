"use client";

import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useMediaQuery } from "@/lib/useClientFlag";
import { cn } from "@/lib/utils";

// Tilt only makes sense where there is a hovering, precise pointer. A finger
// cannot hover, so the effect was already a no-op on touch - but the 3D
// transform context it set up was NOT, and that is what broke tapping.
//
// `transformStyle: preserve-3d` establishes a 3D rendering context, and on
// mobile browsers that changes how hit-testing resolves for descendants: taps
// on a link inside a preserve-3d subtree land unreliably or not at all. The
// product cards wrap their <Link> in this, so on a phone the card simply did
// not navigate.
//
// The fix is therefore not to disable the tilt - it was already disabled - but
// to stop creating the 3D context at all unless the tilt can actually run.
const FINE_POINTER = "(hover: hover) and (pointer: fine)";

/**
 * A subtle pointer-driven 3D tilt wrapper for cards. Mirrors the Hero medallion
 * math (rAF-throttled pointer read → spring rotateX/rotateY) so it feels premium
 * without jank. Springs back flat on leave. Wraps an existing card as a separate
 * transform layer, so the card keeps its own .surface/.lift/group.
 *
 * On touch devices, and under prefers-reduced-motion, it renders a plain wrapper
 * with no transform and no motion component - which also keeps framer-motion off
 * the interaction path on phones entirely.
 */
export function TiltCard({ children, className, max = 6 }: { children: ReactNode; className?: string; max?: number }) {
  const finePointer = useMediaQuery(FINE_POINTER);
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const active = finePointer && !reduced;

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [max, -max]), { stiffness: 150, damping: 15 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-max, max]), { stiffness: 150, damping: 15 });
  const raf = useRef(0);

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return; // belt-and-braces alongside the media query
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
    if (raf.current) {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    }
    mx.set(0);
    my.set(0);
  }

  // No 3D context, no motion wrapper - nothing between the finger and the link.
  // `useMediaQuery` server-renders false, so SSR and first paint take this
  // branch on every device; the tilt layer is added after hydration only where
  // it can actually be used.
  if (!active) return <div className={cn("h-full", className)}>{children}</div>;

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
