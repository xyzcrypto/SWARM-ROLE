import type { ReactNode } from "react";
import { AnimatedEyebrow } from "@/components/AnimatedEyebrow";
import { Reveal } from "@/components/Reveal";
import { cn } from "@/lib/utils";

// Shared product-page header so /markets, /research and /news read as one
// system: animated eyebrow → display-scale title → subtitle, with the same
// staggered entrance and type tokens the homepage uses. `title` accepts markup
// so a page can highlight part of it with <span className="text-shine">.
export function PageHeader({ eyebrow, title, subtitle, className }: {
  /**
   * Optional. A page whose own content already carries a live status line
   * (markets) would otherwise show two claims about the same thing, stacked -
   * and the static one is the one that can be wrong.
   */
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-3xl text-center", className)}>
      {eyebrow && (
        <Reveal variant="fade">
          <AnimatedEyebrow>{eyebrow}</AnimatedEyebrow>
        </Reveal>
      )}
      <Reveal variant="blur" delay={1}>
        <h1 className="mt-4 font-display text-display-lg font-semibold tracking-tight text-zinc-50">
          {title}
        </h1>
      </Reveal>
      {subtitle && (
        <Reveal variant="fade" delay={2}>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-zinc-400">{subtitle}</p>
        </Reveal>
      )}
    </div>
  );
}
