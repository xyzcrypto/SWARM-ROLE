"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

type RevealVariant = "up" | "pop" | "fade";

const presets: Record<RevealVariant, Variants> = {
  // rise from below (under -> up) with a premium spring
  up: {
    hidden: { opacity: 0, y: 56 },
    show: (i: number = 0) => ({
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 90, damping: 16, mass: 0.9, delay: i * 0.09 },
    }),
  },
  // popup + bounce overshoot (cards)
  pop: {
    hidden: { opacity: 0, y: 40, scale: 0.9 },
    show: (i: number = 0) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: "spring", stiffness: 120, damping: 12, mass: 0.8, delay: i * 0.1 },
    }),
  },
  fade: {
    hidden: { opacity: 0, y: 16 },
    show: (i: number = 0) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: "easeOut", delay: i * 0.08 },
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
