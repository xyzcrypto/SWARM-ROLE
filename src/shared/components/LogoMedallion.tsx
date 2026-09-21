"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The XYZ mark as a small 3D medallion: concentric rings turning at different
 * speeds and directions around a floating, glowing logo.
 *
 * ## Why a second one rather than reusing the homepage's
 *
 * `Hero.tsx` has the full article - pointer-driven tilt springs, orbiting
 * badges, a lite-tier swap for its `blur-3xl`, and a `hero-pop` entrance
 * sequence that is tuned to be the page's LCP. That component is roughly a
 * hundred lines and is load-bearing for the homepage's Core Web Vitals; lifting
 * it out to share would mean re-tuning the thing most likely to regress that
 * page, to decorate another one.
 *
 * So this is the *motif*, not the machinery: the same rings, the same float,
 * the same gold glow, built from keyframes that already exist
 * (`animate-spin-slow`, `animate-spin-rev`, `animate-pulse-dot`, `animate-float`)
 * so it adds no CSS and no dependency. No pointer tilt, which is what the
 * heavy part was.
 *
 * ## Reduced motion
 *
 * Deliberately NOT gated, per the project policy: only heavy full-screen ambient
 * loops are. This is a bounded element a few hundred pixels across, and the
 * policy exists because gating things like it is what made the site read as
 * static.
 *
 * ## Cost
 *
 * `next/image` is right here and wrong elsewhere: `/logo.png` is a local asset
 * this site serves itself, not a remote file on Supabase Storage - the trap-3
 * warning is about the latter, where the optimiser spends transfer and quota on
 * someone else's origin. Marked `aria-hidden`: it is decoration beside a
 * heading that already names the brand.
 */
export function LogoMedallion({
  className,
  /** Dial the whole thing back when it sits behind text. */
  subtle = false,
}: {
  className?: string;
  subtle?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none relative aspect-square select-none", className)}
    >
      {/* Rings. Opposite directions at different speeds is what reads as
          depth - two rings turning the same way just looks like one. */}
      <div
        className={cn(
          "absolute inset-0 animate-spin-slow rounded-full border",
          subtle ? "border-gold-500/15" : "border-gold-500/30"
        )}
      />
      <div
        className={cn(
          "absolute inset-[12%] animate-spin-rev rounded-full border border-dashed",
          subtle ? "border-gold-400/15" : "border-gold-400/35"
        )}
      />
      {/* ⚠️ An explicit duration, because `animate-spin-slow` is 28s and the
          outer ring already uses it. Measured: all three rings were running
          `spin-slow` and two of them at an identical 28s `normal`, so the outer
          and inner turned in perfect lockstep and the medallion read as one
          rigid object - exactly what the note above says not to do. Three
          distinct speeds (28s / 40s reverse / 17s) is what makes it read as
          depth. */}
      <div
        style={{ animationDuration: "17s" }}
        className={cn(
          "absolute inset-[26%] animate-spin-slow rounded-full border",
          subtle ? "border-mint-400/10" : "border-mint-400/25"
        )}
      />

      {/* The glow sits under the mark, breathing. One blurred orb, not a
          stack - stacking them is how this palette drifts from restrained to
          cheap, which the design system warns about by name. */}
      <div
        className={cn(
          "absolute inset-[30%] animate-pulse-dot rounded-full blur-2xl",
          subtle ? "bg-gold-500/10" : "bg-gold-500/25"
        )}
      />

      {/* The mark, floating. */}
      <div className="absolute inset-[30%] animate-float">
        <Image
          src="/logo.png"
          alt=""
          fill
          sizes="(max-width: 640px) 120px, 200px"
          className={cn(
            "object-contain",
            subtle ? "opacity-40" : "drop-shadow-[0_0_22px_rgba(212,169,66,0.45)]"
          )}
        />
      </div>
    </div>
  );
}
