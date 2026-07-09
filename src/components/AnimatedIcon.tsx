"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  gold: "from-gold-500/25 to-gold-500/[0.03] text-gold-300 ring-gold-500/30",
  mint: "from-mint-500/25 to-mint-500/[0.03] text-mint-300 ring-mint-500/30",
  sky: "from-sky-500/25 to-sky-500/[0.03] text-sky-300 ring-sky-500/30",
  violet: "from-violet-500/25 to-violet-500/[0.03] text-violet-300 ring-violet-500/30",
} as const;

// Premium 3D icon tile: duotone gradient + inner highlight + drop shadow for
// depth, a spring entrance when scrolled into view, a *continuous* "alive" float
// (unique per `index` so no two tick in sync), and a pointer-agnostic 3D tilt +
// pop on hover. Gives lucide glyphs real presence instead of flat "generic AI"
// squares. All motion is disabled under prefers-reduced-motion.
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
  const reduce = useReducedMotion();
  // Vary the idle float per icon so a wall of them shimmers organically.
  const dir = index % 2 === 0 ? 1 : -1;
  const dur = 3.4 + (index % 4) * 0.5;
  const delay = (index % 5) * 0.35;

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.6, rotate: -8 }}
      whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      whileHover={reduce ? undefined : { scale: 1.14, rotateX: 10, rotateY: dir * 12 }}
      transition={{ type: "spring", stiffness: 200, damping: 14 }}
      style={{ transformPerspective: 600, transformStyle: "preserve-3d" }}
      className={cn(
        "relative inline-flex items-center justify-center rounded-xl bg-gradient-to-br ring-1",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_8px_20px_-10px_rgba(0,0,0,0.6)]",
        TONES[tone],
        className
      )}
    >
      {/* soft top-light sheen for a rounded, 3D read */}
      <span className="pointer-events-none absolute inset-x-1 top-0.5 h-1/2 rounded-[inherit] bg-gradient-to-b from-white/12 to-transparent" />
      <motion.span
        className="relative inline-flex"
        animate={reduce ? undefined : { y: [0, dir * -3, 0], rotate: [0, dir * 4, 0] }}
        transition={{ duration: dur, delay, repeat: Infinity, ease: "easeInOut" }}
      >
        {children}
      </motion.span>
    </motion.span>
  );
}
