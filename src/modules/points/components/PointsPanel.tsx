"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One header grammar for every panel on /points.
 *
 * ## Why this exists
 *
 * Each section had grown its own header: different eyebrow treatments, some with
 * a description and some without, actions sometimes beside the title and
 * sometimes wrapped under it, and padding that drifted between panels. Every one
 * looked reasonable alone. Stacked, they read as six unrelated cards rather than
 * one product, and no two titles started on the same x position.
 *
 * Alignment is not decoration here. A page of numbers is judged on whether its
 * columns line up, because that is the only visual signal that the numbers were
 * produced by one system.
 *
 * So: one component owns the eyebrow, the title, the description, the action
 * slot and the meta row. A panel supplies content; it does not get to invent
 * spacing.
 */
export function PointsPanel({
  id,
  eyebrow,
  icon: Icon,
  title,
  accent,
  description,
  actions,
  meta,
  children,
  className,
  tone = "default",
}: {
  id?: string;
  eyebrow: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  /** Plain leading words. Kept separate from `accent` on purpose - see below. */
  title: ReactNode;
  /**
   * The one phrase that gets the gold sweep.
   *
   * ⚠️ Separate prop rather than letting callers pass `<span className="text-shine">`
   * inside `title`. `background-clip: text` does not paint through to nested
   * inline children, so a caller who wrapped the whole title would render its
   * other words INVISIBLE - no error, no warning. Taking the accent as its own
   * leaf makes that mistake unrepresentable.
   */
  accent?: string;
  description?: ReactNode;
  /** Top-right controls. Always right-aligned to the panel edge. */
  actions?: ReactNode;
  /** Status chips under the header: live state, freshness, counts. */
  meta?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** `flush` drops the card chrome for a panel nested inside another surface. */
  tone?: "default" | "flush";
}) {
  return (
    <section
      id={id}
      className={cn(
        tone === "default" && "surface rounded-3xl p-5 sm:p-7 lg:p-8",
        id && "scroll-mt-28",
        className
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1">
          <p className="eyebrow-glass inline-flex items-center gap-1.5 text-[11px]">
            {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={1.7} />}
            {eyebrow}
          </p>
          <h2 className="mt-3 font-display text-xl font-semibold tracking-tight text-content sm:text-2xl">
            {title}
            {accent ? (
              <>
                {" "}
                <span className="text-shine">{accent}</span>
              </>
            ) : null}
          </h2>
          {description && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-content-muted">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>

      {meta && <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px]">{meta}</div>}

      {children}
    </section>
  );
}

/**
 * The live/stale/down chip, identical everywhere it appears.
 *
 * Three panels each drew their own version of this, with three different dot
 * sizes and two different greens. A reader reads a status light as one thing or
 * as noise, and three spellings of it is noise.
 */
export function LiveChip({
  state,
  children,
}: {
  state: "live" | "loading" | "down";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium",
        state === "live"
          ? "border-mint-500/30 bg-mint-500/10 text-mint-200"
          : state === "loading"
            ? "border-hairline text-content-subtle"
            : "border-rose-500/30 bg-rose-500/10 text-rose-300"
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        {/* The pulse is the only thing on the page that says "this is still
            moving" when nothing has changed for a while. Deliberately NOT gated
            on prefers-reduced-motion: per the design system only heavy
            full-screen ambient loops are, and a 1.5px status dot is not one. */}
        {state === "live" && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-400 opacity-75" />
        )}
        <span
          className={cn(
            "relative inline-flex h-1.5 w-1.5 rounded-full",
            state === "live" ? "bg-mint-400" : state === "loading" ? "bg-content-subtle" : "bg-rose-400"
          )}
        />
      </span>
      {children}
    </span>
  );
}

/**
 * A labelled number. The page's basic unit of information.
 *
 * `mono` + `tabular-nums` so a column of these lines up digit for digit, which
 * is the difference between a data product and a web page with numbers on it.
 */
export function Stat({
  label,
  value,
  hint,
  align = "left",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <div className={cn("min-w-0", align === "right" && "text-right")}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-content-subtle">{label}</p>
      <p className="mono mt-1 truncate text-lg font-semibold tabular-nums text-content">{value}</p>
      {hint && <p className="mt-0.5 truncate text-[11px] text-content-subtle">{hint}</p>}
    </div>
  );
}
