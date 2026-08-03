"use client";

import { motion, useInView } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotionSafe } from "@/lib/useClientFlag";

const TONES = {
  gold: { tile: "from-gold-400/30 via-gold-500/15 to-gold-600/[0.04] text-gold-200 ring-gold-400/40", glow: "bg-gold-500/50" },
  mint: { tile: "from-mint-400/30 via-mint-500/15 to-mint-600/[0.04] text-mint-200 ring-mint-400/40", glow: "bg-mint-500/50" },
  sky: { tile: "from-sky-400/30 via-sky-500/15 to-sky-600/[0.04] text-sky-200 ring-sky-400/40", glow: "bg-sky-500/50" },
  violet: { tile: "from-violet-400/30 via-violet-500/15 to-violet-600/[0.04] text-violet-200 ring-violet-400/40", glow: "bg-violet-500/50" },
} as const;

// A glossy, genuinely-3D icon tile (same energy as the RobotIcon): the tile
// continuously wobbles in 3D while the glyph sits on a raised Z plane so it
// parallaxes forward as the tile turns; a coloured glow breathes behind it and a
// top gloss gives it a lit, rounded read. Every icon is seeded off `index` so a
// wall of them never ticks in sync. All motion is disabled under
// prefers-reduced-motion (falls back to a clean static glossy tile).
export function AnimatedIcon({
  children,
  className,
  tone = "gold",
  index = 0,
}: {
  children: ReactNode;
  className?: string;
  tone?: keyof typeof TONES;
  index?: number;
}) {
  const reduce = useReducedMotionSafe();
  const t = TONES[tone];
  const dir = index % 2 === 0 ? 1 : -1;
  const dur = 4 + (index % 4) * 0.6; // 4.0–5.8s
  const delay = (index % 5) * 0.4;

  // Pause the continuous wobble/glow loops while the tile is off-screen - a
  // wall of icons (About/Products) shouldn't keep animating below the fold.
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { margin: "200px" });
  const animating = !reduce && inView;

  return (
    <motion.span
      ref={ref}
      initial={{ opacity: 0, scale: 0.5, rotateY: dir * -40 }}
      whileInView={{ opacity: 1, scale: 1, rotateY: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      whileHover={reduce ? undefined : { scale: 1.16 }}
      transition={{ type: "spring", stiffness: 190, damping: 13 }}
      style={{ perspective: 500 }}
      className={cn("relative inline-flex items-center justify-center rounded-xl", className)}
    >
      {/* breathing coloured glow behind the tile */}
      <motion.span
        aria-hidden
        className={cn("pointer-events-none absolute -inset-1 rounded-[inherit] blur-md", t.glow)}
        animate={animating ? { opacity: [0.25, 0.6, 0.25], scale: [0.88, 1.08, 0.88] } : undefined}
        transition={{ duration: dur, delay, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* the glossy tile — wobbles in 3D */}
      <motion.span
        className={cn("relative flex h-full w-full items-center justify-center rounded-[inherit] bg-gradient-to-br ring-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_22px_-10px_rgba(0,0,0,0.7)]", t.tile)}
        style={{ transformStyle: "preserve-3d" }}
        animate={animating ? { rotateY: [dir * -13, dir * 13, dir * -13], rotateX: [5, -5, 5] } : undefined}
        transition={{ duration: dur, delay, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* top gloss highlight */}
        <span aria-hidden className="pointer-events-none absolute inset-x-1 top-0.5 h-1/2 rounded-[inherit] bg-gradient-to-b from-white/30 to-transparent" />
        {/* glyph raised on its own Z plane → parallaxes forward as the tile turns */}
        <span className="relative" style={{ transform: "translateZ(10px)" }}>
          {children}
        </span>
      </motion.span>
    </motion.span>
  );
}
