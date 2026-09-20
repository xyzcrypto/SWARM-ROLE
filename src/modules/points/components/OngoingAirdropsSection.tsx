"use client";

import { ArrowRight, BadgeCheck, CircleHelp, ExternalLink, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { platformLogo } from "@/lib/dex-registry";
import { site } from "@/lib/site";
import { usdCompact } from "@modules/points/lib/points";
import { PHASE_LABEL, hasLiveComps, type ProgramView } from "@modules/points/lib/programs";

const PHASE_TONE: Record<ProgramView["phase"], string> = {
  live: "border-mint-500/30 bg-mint-500/10 text-mint-200",
  upcoming: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  distributed: "border-gold-500/30 bg-gold-500/10 text-gold-200",
  ended: "border-hairline bg-white/[0.03] text-content-subtle",
};

/**
 * Ongoing perp DEX airdrops - the tracked list, restored.
 *
 * ⚠️ This list existed and the redesign dropped it. It lived in `ProgramPanel`,
 * which is no longer rendered anywhere; so was the channel link underneath it,
 * which is the only pointer this site has to the programmes that are NOT hand
 * tracked here. Losing that is losing the page's answer to "what should I farm
 * right now", which is the question the page exists for.
 *
 * ## Why this is not simply `ProgramPanel` re-mounted
 *
 * `ProgramPanel`'s cards are anchors to `#programme-<id>`, and those sections
 * (`ProgramSection`) are also no longer rendered. Re-mounting it would restore
 * a grid of links that scroll nowhere - a control that looks live and does
 * nothing, which is worse than the missing section. So the cards keep that
 * component's visual language and its tokens, and are wired to the interaction
 * this layout actually has: selecting a programme loads it into the calculator.
 *
 * The channel link is carried across verbatim, including its reasoning - the
 * running list changes far too often to hard-code, so linking it is honest and
 * copying it would be stale within a week.
 */
export function OngoingAirdropsSection({
  programs,
  activeId,
  onSelect,
}: {
  programs: ProgramView[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const liveCount = programs.filter((p) => p.phase === "live").length;

  return (
    <section
      id="ongoing-airdrops"
      className="scroll-mt-32 rounded-2xl border border-hairline bg-surface-2 p-5 sm:p-6"
    >
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-hairline pb-4">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-content sm:text-xl">
            Ongoing perp DEX <span className="text-shine">airdrops</span>
          </h2>
          <p className="mt-0.5 text-xs text-content-muted">
            Tracked by hand, because most programmes worth farming early are too small for any
            market feed to list.
          </p>
        </div>

        {liveCount > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-mint-500/30 bg-mint-500/10 px-2.5 py-1 text-[11px] font-semibold text-mint-200">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-400/80" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint-400" />
            </span>
            {liveCount} farming now
          </span>
        )}
      </div>

      {/* ── The programmes ───────────────────────────────────────────── */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {programs.map((p, n) => {
          const logo = platformLogo({ links: p.links, logo: p.logo ?? undefined });
          const selected = activeId === p.id;

          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              style={{ animationDelay: `${Math.min(n, 8) * 55}ms` }}
              className={cn(
                "group animate-rise-in flex h-full flex-col rounded-2xl border bg-base p-4 text-left",
                // ⚠️ `shadow-elevate`, not `shadow-card-hover`. The latter is
                // named in the design-system handbook but is defined NOWHERE -
                // not in `tailwind.config.ts`, not in `globals.css` - so it
                // compiles to no rule at all. This codebase has shipped three
                // silent-CSS failures of exactly that shape already.
                "transition-all duration-300 hover:-translate-y-1 hover:shadow-elevate active:-translate-y-1",
                selected
                  ? "border-gold-500/40 shadow-gold-sm"
                  : "border-hairline hover:border-gold-500/25 active:border-gold-500/25"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  {logo ? (
                    // Plain <img> on a remote logo: fetched browser-to-origin at
                    // zero Vercel transfer (cost-check, trap 3).
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logo}
                      alt=""
                      width={24}
                      height={24}
                      loading="lazy"
                      className="h-6 w-6 shrink-0 rounded-md transition-transform duration-300 group-hover:scale-110 group-active:scale-110"
                      onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")}
                    />
                  ) : (
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/5 text-[10px] font-semibold text-content-muted">
                      {p.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <span className="truncate font-display text-sm font-bold text-content">
                    {p.name}
                  </span>
                </span>

                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                    PHASE_TONE[p.phase]
                  )}
                >
                  {PHASE_LABEL[p.phase]}
                </span>
              </div>

              {/* ⚠️ Whether the numbers are official or a community guess, on
                  the card rather than buried. A farmer sizes a position off
                  this, and "confirmed" versus "unconfirmed" changes how much
                  they should trust the allocation figure beside it. */}
              <span
                className={cn(
                  "mt-2.5 inline-flex items-center gap-1 text-[11px] font-medium",
                  p.confirmed ? "text-mint-300" : "text-content-subtle"
                )}
              >
                {p.confirmed ? (
                  <BadgeCheck className="h-3 w-3" strokeWidth={2} />
                ) : (
                  <CircleHelp className="h-3 w-3" strokeWidth={2} />
                )}
                {p.confirmed ? "Confirmed programme" : "Community estimate"}
              </span>

              <dl className="mt-3 space-y-1.5 border-t border-hairline pt-3 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-content-subtle">Chain</dt>
                  <dd className="truncate text-content-muted">{p.chain}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-content-subtle">Allocation</dt>
                  <dd className="mono text-content-muted">
                    {p.scenario.allocationPctOfSupply}% of supply
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-content-subtle">Volume</dt>
                  <dd className="text-right">
                    {hasLiveComps(p) ? (
                      <span className="mono text-mint-300">
                        {usdCompact(p.venue!.volume30d)} 30d
                      </span>
                    ) : (
                      // Not a failure. Being too small for a data feed to track
                      // is the normal state of a programme worth farming early.
                      <span className="text-content-subtle">not tracked</span>
                    )}
                  </dd>
                </div>
              </dl>

              <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-gold-300">
                {selected ? "Loaded in the calculator" : "Value this programme"}
                <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1 group-active:translate-x-1" />
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Everything else ──────────────────────────────────────────── */}
      <a
        href={site.farming.ongoingAirdrops}
        target="_blank"
        rel="noopener noreferrer"
        className="group mt-4 flex flex-col gap-3 rounded-2xl border border-hairline bg-base p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-mint-500/30 active:-translate-y-0.5 sm:flex-row sm:items-center sm:justify-between sm:p-5"
      >
        <span className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint-500/10 text-mint-300 transition-transform duration-300 group-hover:scale-110 group-active:scale-110">
            <Send className="h-5 w-5" strokeWidth={1.7} />
          </span>
          <span>
            <span className="block font-display text-sm font-bold text-content">
              The full running list
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-content-muted">
              Everything worth farming right now, kept up to date in the XYZ Crypto channel. It
              moves too often to hard-code here.
            </span>
          </span>
        </span>
        <span className="btn-secondary inline-flex shrink-0 items-center gap-1.5 self-start text-xs sm:self-auto">
          Open the list <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.7} />
        </span>
      </a>
    </section>
  );
}
