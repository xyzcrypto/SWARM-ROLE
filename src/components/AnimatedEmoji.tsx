"use client";

import { useReducedMotion } from "framer-motion";

type Variant = "launch" | "wobble" | "float";

const loopAnimation: Record<Variant, string> = {
  launch: "emoji-launch 1.6s ease-in-out infinite",
  wobble: "emoji-wobble 2.4s ease-in-out infinite",
  float: "emoji-float 3s ease-in-out infinite",
};

// Tailwind arbitrary animation that only runs while a parent `.group` is hovered
// (spaces written as underscores). Used for CTA emojis that animate on hover.
const hoverClass: Record<Variant, string> = {
  launch: "group-hover:[animation:emoji-launch_1.6s_ease-in-out_infinite]",
  wobble: "group-hover:[animation:emoji-wobble_2.4s_ease-in-out_infinite]",
  float: "group-hover:[animation:emoji-float_3s_ease-in-out_infinite]",
};

/**
 * A real emoji glyph with a subtle looping motion (rocket lift-off, hourglass
 * wobble, gentle float). Renders a static glyph when the user prefers reduced
 * motion. `hoverOnly` plays only while an ancestor `.group` is hovered.
 */
export function AnimatedEmoji({
  emoji,
  variant = "float",
  className = "",
  hoverOnly = false,
}: {
  emoji: string;
  variant?: Variant;
  className?: string;
  hoverOnly?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <span
      role="img"
      aria-hidden="true"
      className={`inline-block origin-bottom ${!reduced && hoverOnly ? hoverClass[variant] : ""} ${className}`}
      style={!reduced && !hoverOnly ? { animation: loopAnimation[variant] } : undefined}
    >
      {emoji}
    </span>
  );
}
