"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

type RevealVariant = "up" | "pop" | "fade" | "blur" | "left" | "right" | "scale" | "focus";

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
  // soft focus-in - feels premium on headings/imagery
  blur: {
    hidden: { opacity: 0, y: 24, filter: "blur(14px)" },
    show: (i: number = 0) => ({
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: i * 0.09 },
    }),
  },
  // slide in from the left
  left: {
    hidden: { opacity: 0, x: -64 },
    show: (i: number = 0) => ({
      opacity: 1,
      x: 0,
      transition: { type: "spring", stiffness: 80, damping: 17, mass: 0.9, delay: i * 0.09 },
    }),
  },
  // slide in from the right
  right: {
    hidden: { opacity: 0, x: 64 },
    show: (i: number = 0) => ({
      opacity: 1,
      x: 0,
      transition: { type: "spring", stiffness: 80, damping: 17, mass: 0.9, delay: i * 0.09 },
    }),
  },
  // gentle zoom-in
  scale: {
    hidden: { opacity: 0, scale: 0.86 },
    show: (i: number = 0) => ({
      opacity: 1,
      scale: 1,
      transition: { type: "spring", stiffness: 110, damping: 15, mass: 0.8, delay: i * 0.08 },
    }),
  },
  // signature headline reveal: a slightly-scaled, softly-blurred headline
  // sharpens into focus as it settles - reads as "clarity arriving" (fits a
  // research/intelligence brand) rather than a generic slide/fade. Heavier
  // blur + longer duration than the base "blur" preset since it's tuned for
  // large display type, not body copy.
  focus: {
    hidden: { opacity: 0, y: 22, scale: 0.97, filter: "blur(18px)" },
    show: (i: number = 0) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      filter: "blur(0px)",
      transition: { duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: i * 0.1 },
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
