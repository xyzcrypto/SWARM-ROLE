import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Premium membership pill - gold gradient fill (the same `bg-gold-shine` +
 * `animate-shine` sweep already used site-wide, not a new effect) with a
 * crown mark, so it reads as part of the established brand language rather
 * than a bolted-on badge.
 */
export function PremiumBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-gold-shine bg-[length:200%_auto] px-3 py-1 text-[0.6875rem] font-semibold tracking-wide text-ink shadow-gold-sm ring-1 ring-gold-300/50 animate-shine",
        className
      )}
    >
      <Crown className="h-3 w-3" />
      Premium
    </span>
  );
}
