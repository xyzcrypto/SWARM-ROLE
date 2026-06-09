"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

type RevealVariant = "up" | "pop" | "fade";

const presets: Record<RevealVariant, Variants> = {
  // soft fade + rise (default, premium)
  up: {
    hidden: { opacity: 0, y: 28 },
    show: (i: number = 0) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: i * 0.08 },
    }),
  },
  // popup with a subtle bounce overshoot
  pop: {
    hidden: { opacity: 0, y: 22, scale: 0.94 },
    show: (i: number = 0) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.6, ease: [0.34, 1.56, 0.64, 1], delay: i * 0.09 },
    }),
  },
  fade: {
    hidden: { opacity: 0 },
    show: (i: number = 0) => ({
      opacity: 1,
      transition: { duration: 0.7, ease: "easeOut", delay: i * 0.08 },
    }),
  },
};

export function Reveal({
  children,
  delay = 0,
  variant = "up",
  className,
}: {
  children: ReactNode;
  delay?: number;
  variant?: RevealVariant;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={presets[variant]}
      custom={delay}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-70px" }}
    >
      {children}
    </motion.div>
  );
}
