import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "../Reveal";

export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[75rem] px-5 sm:px-6 lg:px-8 xl:max-w-[82.5rem] 2xl:max-w-[92.5rem] 2xl:px-10",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Section({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("sect-cv relative py-14 sm:py-20 lg:py-24", className)}>
      {children}
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="eyebrow text-gold-200">
      <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
      <span className="mono text-[0.6875rem] uppercase tracking-[0.18em]">{children}</span>
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div
      className={cn(
        align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl text-left",
        className
      )}
    >
      {eyebrow && (
        <Reveal delay={0} className={cn("mb-5", align === "center" && "flex justify-center")}>
          <Eyebrow>{eyebrow}</Eyebrow>
        </Reveal>
      )}
      <Reveal delay={1}>
        <h2 className="font-display text-display-md font-semibold tracking-tight text-zinc-50">
          {title}
        </h2>
      </Reveal>
      {subtitle && (
        <Reveal delay={2}>
          <p className="mt-4 text-base leading-relaxed text-zinc-400">{subtitle}</p>
        </Reveal>
      )}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "gold" | "mint" | "sky" | "violet" | "zinc";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-white/5 text-zinc-300 ring-white/10",
    gold: "bg-gold-500/12 text-gold-200 ring-gold-500/30",
    mint: "bg-mint-500/12 text-mint-300 ring-mint-500/30",
    sky: "bg-sky-500/12 text-sky-300 ring-sky-500/30",
    violet: "bg-violet-500/12 text-violet-300 ring-violet-500/30",
    zinc: "bg-zinc-500/12 text-zinc-300 ring-zinc-500/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-medium ring-1",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/* ---------------- Shared loading / empty / error states ---------------- */

/** A single shimmering placeholder bar. Use several to sketch a loading layout. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-white/[0.06]", className)} aria-hidden="true" />;
}

/** N stacked skeleton rows - a quick list/table placeholder. */
export function SkeletonList({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}

/** Neutral empty state - no data yet (not an error). */
export function EmptyState({ icon, title, hint, action, className }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-4 py-12 text-center", className)}>
      {icon && <div className="text-zinc-600">{icon}</div>}
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      {hint && <p className="max-w-xs text-xs text-zinc-500">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Something went wrong, with an optional retry. */
export function ErrorState({ title = "Something went wrong", hint, onRetry, className }: { title?: string; hint?: string; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-4 py-12 text-center", className)}>
      <p className="text-sm font-medium text-amber-300">{title}</p>
      {hint && <p className="max-w-xs text-xs text-zinc-500">{hint}</p>}
      {onRetry && (
        <button onClick={onRetry} className="mt-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-white/5">
          Try again
        </button>
      )}
    </div>
  );
}
