"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Premium icon container: gradient (duotone) fill + inner light, a spring
// entrance when scrolled into view, and a subtle rotate/scale on hover. Gives
// lucide glyphs depth so they read less flat / "generic AI". Motion is gated by
// prefers-reduced-motion globally (framer respects the OS setting).
export function AnimatedIcon({
  children,
  className,
  tone = "gold",
}: {
  children: ReactNode;
  className?: string;
  tone?: "gold" | "mint";
}) {
  const styles =
    tone === "mint"
      ? "from-mint-500/20 to-mint-500/[0.03] text-mint-300 ring-mint-500/25"
      : "from-gold-500/20 to-gold-500/[0.03] text-gold-300 ring-gold-500/25";
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.6, rotate: -8 }}
      whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      whileHover={{ scale: 1.12, rotate: 4 }}
      transition={{ type: "spring", stiffness: 200, damping: 14 }}
      className={cn(
        "inline-flex items-center justify-center rounded-xl bg-gradient-to-br ring-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
        styles,
        className
      )}
    >
      {children}
    </motion.span>
  );
}
