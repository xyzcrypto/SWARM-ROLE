"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

type RevealVariant = "up" | "pop" | "fade" | "blur" | "left" | "right" | "scale";

/**
 * The site's entrance animation, used ~40 times across 19 files. Because it is
 * the same component everywhere, the seven presets below ARE the site's motion
 * language - if they disagree with each other, the site does.
 *
 * They used to disagree on all three axes at once:
 *
 *   travel     56px (up) · 40px (pop) · 24px (blur) · 16px (fade) · 64px (left/right)
 *   settle     five different springs plus a 0.8s and a 0.9s tween
 *   stagger    0.08 · 0.09 · 0.10
 *
 * Six travel distances is not a ladder, it is noise: two sections revealing
 * side by side moved different distances at different speeds for no reason a
 * reader could infer. What follows is one spring, one tween, and a three-step
 * distance ladder.
 *
 * ## The spring
 *
 * `stiffness 170, damping 24, mass 1` puts the damping ratio at
 * `24 / (2 * sqrt(170)) = 0.92` - just under critical, so it arrives with a
 * single hairline settle and no bounce. The old `pop` sat at 0.61, which is a
 * visible overshoot-and-return; the brief for this pass called that out
 * directly, and it is also why `pop` read as a different component's animation
 * than `up` sitting right above it. Every preset now shares this spring, so
 * they differ only in WHAT moves, never in HOW it moves.
 *
 * ## The distance ladder
 *
 * 12px (fade, an accent) · 20px (up / pop / blur, the workhorses) · 28px
 * (left / right, which need more travel to read as directional). Shorter than
 * before on purpose: 56px of travel on a 390px-wide phone is a sixth of the
 * screen, which is what made sections feel like they were sliding into place
 * rather than settling. Apple, Linear and Stripe all sit in this range.
 *
 * ## Reduced motion
 *
 * Deliberately not gated, matching the project policy in CLAUDE.md: one-shot
 * entrances were never gated on the preference and should not become gated.
 * Note also that framer-motion's own `useReducedMotion()` must never decide
 * anything that reaches the DOM here - it returns `null` on the server and the
 * real query on the client's first render, which is exactly the hydration
 * mismatch that once threw React #418 on every page of this site.
 */

/** One spring for every preset - see the damping-ratio note above. */
const SPRING = { type: "spring", stiffness: 170, damping: 24, mass: 1 } as const;

/** One tween, for the two presets that fade rather than travel. */
const TWEEN = { duration: 0.45, ease: [0.22, 1, 0.36, 1] } as const;

/** One stagger step. `delay` is passed through `custom` as an index. */
const STEP = 0.07;

const presets: Record<RevealVariant, Variants> = {
  // The default: rise and settle.
  up: {
    hidden: { opacity: 0, y: 20 },
    show: (i: number = 0) => ({
      opacity: 1,
      y: 0,
      transition: { ...SPRING, delay: i * STEP },
    }),
  },
  // Cards - rise plus a slight scale, so a grid reads as coming forward rather
  // than only upward. 0.97 rather than the old 0.9: at 0.9 the card visibly
  // changes size, which fights the text inside it re-laying out.
  pop: {
    hidden: { opacity: 0, y: 20, scale: 0.97 },
    show: (i: number = 0) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { ...SPRING, delay: i * STEP },
    }),
  },
  // The quiet one - for accents and anything appearing in a dense group.
  fade: {
    hidden: { opacity: 0, y: 12 },
    show: (i: number = 0) => ({
      opacity: 1,
      y: 0,
      transition: { ...TWEEN, delay: i * STEP },
    }),
  },
  // Soft focus-in for headings and imagery. The blur is 8px rather than 14px:
  // `filter` is one of the few properties here the compositor cannot animate
  // for free, so the radius is real work on every frame, and past ~8px the
  // extra is not legible as anything but a longer blur.
  blur: {
    hidden: { opacity: 0, y: 20, filter: "blur(8px)" },
    show: (i: number = 0) => ({
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { ...TWEEN, delay: i * STEP },
    }),
  },
  left: {
    hidden: { opacity: 0, x: -28 },
    show: (i: number = 0) => ({
      opacity: 1,
      x: 0,
      transition: { ...SPRING, delay: i * STEP },
    }),
  },
  right: {
    hidden: { opacity: 0, x: 28 },
    show: (i: number = 0) => ({
      opacity: 1,
      x: 0,
      transition: { ...SPRING, delay: i * STEP },
    }),
  },
  // Zoom-in, for a single focal element. 0.94, not 0.86 - see `pop`.
  scale: {
    hidden: { opacity: 0, scale: 0.94 },
    show: (i: number = 0) => ({
      opacity: 1,
      scale: 1,
      transition: { ...SPRING, delay: i * STEP },
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
