"use client";

import { BadgeCheck, CircleHelp, ExternalLink, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { platformLogo } from "@/lib/dex-registry";
import { usdCompact } from "@modules/points/lib/points";
import { PHASE_LABEL, hasLiveComps, type ProgramView } from "@modules/points/lib/programs";

const PHASE_TONE: Record<ProgramView["phase"], string> = {
  live: "border-mint-500/30 bg-mint-500/10 text-mint-200",
  upcoming: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  distributed: "border-gold-500/30 bg-gold-500/10 text-gold-200",
  ended: "border-white/10 bg-white/[0.03] text-zinc-500",
};

export function ProgramPanel({
  programs,
  selectedId,
  onSelect,
}: {
  programs: ProgramView[];
  selectedId: string;
  onSelect: (p: ProgramView) => void;
}) {
  const selected = programs.find((p) => p.id === selectedId) ?? null;

  return (
    <section className="surface rounded-3xl p-5 sm:p-8">
      <header>
        <p className="eyebrow-glass inline-flex items-center gap-1.5 text-[11px]">
          <Activity className="h-3.5 w-3.5" strokeWidth={1.7} />
          Tracked programmes
        </p>
        <h2 className="mt-3 font-display text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
          What you are <span className="text-shine">farming</span>
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
          Pick a programme to load its supply, pool and allocation. Most programmes worth farming are too small for
          any market-data feed to list, so these are tracked by hand and each one says whether its numbers are
          official or a community guess.
        </p>
      </header>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {programs.map((p) => {
          const active = p.id === selectedId;
          const logo = platformLogo({ links: p.links, logo: p.logo ?? undefined });
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p)}
              aria-pressed={active}
              className={cn(
                "group rounded-2xl border p-4 text-left transition-colors",
                active
                  ? "border-gold-500/40 bg-gold-500/[0.07]"
                  : "border-white/10 bg-ink-950/40 hover:border-gold-500/25 active:border-gold-500/25"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logo}
                      alt=""
                      width={22}
                      height={22}
                      className="h-[22px] w-[22px] shrink-0 rounded-md transition-transform group-hover:scale-105 group-active:scale-105"
                      onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")}
                    />
                  ) : (
                    <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md bg-white/5 text-[10px] font-semibold text-zinc-400">
                      {p.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <span className="truncate font-display text-sm font-semibold text-zinc-100">{p.name}</span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                    PHASE_TONE[p.phase]
                  )}
                >
                  {PHASE_LABEL[p.phase]}
                </span>
              </div>

              {/* The honesty signal. Almost no airdrop site distinguishes a
                  protocol's published numbers from a community guess, and the
                  difference is the difference between a plan and a daydream. */}
              <span
                className={cn(
                  "mt-3 inline-flex items-center gap-1 text-[11px] font-medium",
                  p.confirmed ? "text-mint-300" : "text-zinc-500"
                )}
              >
                {p.confirmed ? (
                  <BadgeCheck className="h-3.5 w-3.5" strokeWidth={1.7} />
                ) : (
                  <CircleHelp className="h-3.5 w-3.5" strokeWidth={1.7} />
                )}
                {p.confirmed ? "Numbers confirmed by the protocol" : "Numbers are community assumptions"}
              </span>

              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                <dt className="text-zinc-600">Points pool</dt>
                <dd className="mono text-right text-zinc-300">
                  {p.scenario.totalPoints.toLocaleString("en-US", { notation: "compact" })}
                </dd>
                <dt className="text-zinc-600">Allocation</dt>
                <dd className="mono text-right text-zinc-300">{p.scenario.allocationPctOfSupply}% of supply</dd>
                <dt className="text-zinc-600">Chain</dt>
                <dd className="truncate text-right text-zinc-400">{p.chain}</dd>
                <dt className="text-zinc-600">Live market data</dt>
                <dd className="text-right">
                  {hasLiveComps(p) ? (
                    <span className="mono text-mint-300">{usdCompact(p.venue!.volume30d)} 30d</span>
                  ) : (
                    // Not a failure. Being too small for DefiLlama to track is
                    // the normal state of a programme worth farming early.
                    <span className="text-zinc-600">not tracked</span>
                  )}
                </dd>
              </dl>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-ink-950/40 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-base font-semibold text-zinc-100">{selected.name}</h3>
            {selected.links.website && (
              <a
                href={selected.links.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-gold-200"
              >
                Official site <ExternalLink className="h-3 w-3" strokeWidth={1.7} />
              </a>
            )}
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            {selected.earnRate && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">How points accrue</dt>
                <dd className="mt-1 leading-relaxed text-zinc-300">{selected.earnRate}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">What they convert to</dt>
              <dd className="mt-1 leading-relaxed text-zinc-300">{selected.rewardLogic}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Worth knowing</dt>
              <dd className="mt-1 leading-relaxed text-zinc-400">{selected.notes}</dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}
