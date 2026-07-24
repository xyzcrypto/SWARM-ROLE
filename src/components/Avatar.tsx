import Image from "next/image";
import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

/** First letters of a name (or email local part) for the fallback avatar. */
export function initialsFrom(name?: string | null, email?: string | null): string {
  const base = (name?.trim() || email?.split("@")[0] || "?").trim();
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0]![0]! + parts[1]![0]! : base.slice(0, 2);
  return letters.toUpperCase();
}

const SIZES = {
  sm: { box: "h-8 w-8", text: "text-[11px]", px: 32, badge: "h-3 w-3", icon: "h-[7px] w-[7px]" },
  md: { box: "h-10 w-10", text: "text-sm", px: 40, badge: "h-4 w-4", icon: "h-2.5 w-2.5" },
  lg: { box: "h-16 w-16", text: "text-lg", px: 64, badge: "h-[22px] w-[22px]", icon: "h-3 w-3" },
  xl: { box: "h-24 w-24", text: "text-3xl", px: 96, badge: "h-8 w-8", icon: "h-4 w-4" },
} as const;

export function Avatar({
  name,
  image,
  email,
  size = "md",
  className,
  ring = true,
  premium = false,
}: {
  name?: string | null;
  image?: string | null;
  email?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
  ring?: boolean;
  /** Premium members get a gold gradient ring + a round crown badge. Opt-in -
   *  only pass this where the caller already knows the user's membership
   *  (e.g. the profile hero), not a site-wide Avatar default. */
  premium?: boolean;
}) {
  const s = SIZES[size];
  return (
    // Outer wrapper carries NO overflow/clip of its own - the crown badge
    // below is deliberately a sibling of the clipped circle, not a child of
    // it, so it sits cleanly on the ring's edge instead of being cut off by
    // the circle's own overflow-hidden (the bug in the previous version).
    <span className={cn("relative inline-flex shrink-0 rounded-full", s.box, className)}>
      <span
        className={cn(
          "flex h-full w-full items-center justify-center overflow-hidden rounded-full",
          ring && (premium ? "ring-2 ring-gold-400 shadow-gold" : "ring-1 ring-gold-500/40")
        )}
      >
        {image ? (
          <span className="relative block h-full w-full">
            <Image
              src={image}
              alt={name || "Avatar"}
              fill
              sizes={`${s.px}px`}
              className="object-cover"
              unoptimized={image.startsWith("data:")}
            />
          </span>
        ) : (
          <span
            aria-hidden
            className={cn(
              "flex h-full w-full items-center justify-center bg-gold-shine font-display font-semibold text-ink",
              s.text
            )}
          >
            {initialsFrom(name, email)}
          </span>
        )}
      </span>
      {premium && (
        <span
          aria-hidden
          className={cn(
            "absolute bottom-0 right-0 z-10 flex translate-x-[15%] translate-y-[15%] items-center justify-center rounded-full bg-gold-shine text-ink ring-2 ring-ink-900",
            s.badge
          )}
        >
          <Crown className={s.icon} />
        </span>
      )}
    </span>
  );
}
