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
  sm: { box: "h-8 w-8", text: "text-[0.6875rem]", px: 32, badge: "h-3 w-3", icon: "h-[0.4375rem] w-[0.4375rem]" },
  md: { box: "h-10 w-10", text: "text-sm", px: 40, badge: "h-4 w-4", icon: "h-2.5 w-2.5" },
  lg: { box: "h-16 w-16", text: "text-lg", px: 64, badge: "h-[1.375rem] w-[1.375rem]", icon: "h-3 w-3" },
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
          // ⚠️ A plain <img>, deliberately, NOT next/image.
          //
          // Every avatar on the site was rendering as a broken image - profile
          // hero, DM header, chat header, bottom nav - while every image that
          // did NOT go through the optimizer rendered fine on the same screen:
          // the profile banner (a CSS background-image) and chat photos (a plain
          // <img>), both from the same Supabase host. So the failure tracked the
          // *mechanism*, not any one URL. Taking the optimizer out of the path
          // removes the whole class.
          //
          // It also costs nothing to give up here, and saves something. These are
          // 32-96px images that are already small and already served with a long
          // CDN cache by /api/media (or by Supabase); running them through the
          // optimizer buys no meaningful bytes and spends a billable Image
          // Optimization transformation per size per source. `sizes`/`fill` were
          // doing real work only for large hero images, which this is not.
          //
          // `decoding="async"` keeps a slow decode off the main thread, and the
          // explicit width/height (not just CSS) reserve the box so a list of
          // avatars cannot shift layout while they load.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={name || "Avatar"}
            width={s.px}
            height={s.px}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
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
