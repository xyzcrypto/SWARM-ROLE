"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { motion } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/useClientFlag";

const MotionLink = motion(Link);

/**
 * A drop-in replacement for next/link styled as a button. Adds a tactile press
 * (scale on tap) plus the CSS `.btn-press` sheen, giving every primary CTA a
 * satisfying click/redirect animation. Honors prefers-reduced-motion.
 */
// framer-motion redefines the drag/animation DOM handlers, which clash with the
// anchor's native ones - omit them from the passthrough props.
type ActionLinkProps = Omit<
  ComponentProps<typeof Link>,
  "onAnimationStart" | "onAnimationEnd" | "onDrag" | "onDragStart" | "onDragEnd"
> & { className?: string };

export function ActionLink({ className = "", children, ...props }: ActionLinkProps) {
  const reduced = useReducedMotionSafe();
  return (
    <MotionLink
      className={`btn-press ${className}`}
      whileTap={reduced ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      {...props}
    >
      {children}
    </MotionLink>
  );
}
