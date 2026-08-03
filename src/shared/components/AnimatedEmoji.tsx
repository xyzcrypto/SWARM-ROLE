"use client";

import { useReducedMotionSafe } from "@/lib/useClientFlag";


type Variant = "launch" | "wobble" | "float" | "twinkle" | "spin";

const loopAnimation: Record<Variant, string> = {
  launch: "emoji-launch 1.5s ease-in-out infinite",
  wobble: "emoji-wobble 3s ease-in-out infinite",
  float: "emoji-float 3s ease-in-out infinite",
  twinkle: "emoji-twinkle 2.2s ease-in-out infinite",
  spin: "emoji-spin 4s linear infinite",
};

// Tailwind arbitrary animation that only runs while a parent `.group` is hovered
// (spaces written as underscores). Used for CTA emojis that animate on hover.
const hoverClass: Record<Variant, string> = {
  launch: "group-hover:[animation:emoji-launch_1.5s_ease-in-out_infinite]",
  wobble: "group-hover:[animation:emoji-wobble_3s_ease-in-out_infinite]",
  float: "group-hover:[animation:emoji-float_3s_ease-in-out_infinite]",
  twinkle: "group-hover:[animation:emoji-twinkle_2.2s_ease-in-out_infinite]",
  spin: "group-hover:[animation:emoji-spin_4s_linear_infinite]",
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
  const reduced = useReducedMotionSafe();
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
