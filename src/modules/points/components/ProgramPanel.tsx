"use client";

import { BadgeCheck, CircleHelp, ExternalLink, Activity, Send, Gauge, Layers, Percent } from "lucide-react";
import { cn } from "@/lib/utils";
import { platformLogo } from "@/lib/dex-registry";
import { site } from "@/lib/site";
import { usdCompact } from "@modules/points/lib/points";
import { PHASE_LABEL, hasLiveComps, type ProgramView } from "@modules/points/lib/programs";

const PHASE_TONE: Record<ProgramView["phase"], string> = {
  live: "border-mint-500/30 bg-mint-500/10 text-mint-200",
  upcoming: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  distributed: "border-gold-500/30 bg-gold-500/10 text-gold-200",
  ended: "border-hairline bg-white/[0.03] text-content0",
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
        <h2 className="mt-3 font-display text-xl font-semibold tracking-tight text-content sm:text-2xl">
          What you are <span className="text-shine">farming</span>
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-content-muted">
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
                  : "border-hairline bg-surface-2 hover:border-gold-500/25 active:border-gold-500/25"
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
                    <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md bg-white/5 text-[10px] font-semibold text-content-muted">
                      {p.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <span className="truncate font-display text-sm font-semibold text-content">{p.name}</span>
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
                  p.confirmed ? "text-mint-300" : "text-content0"
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
                <dt className="text-content-subtle">Points pool</dt>
                <dd className="mono text-right text-content-muted">
                  {p.scenario.totalPoints.toLocaleString("en-US", { notation: "compact" })}
                </dd>
                <dt className="text-content-subtle">Allocation</dt>
                <dd className="mono text-right text-content-muted">{p.scenario.allocationPctOfSupply}% of supply</dd>
                <dt className="text-content-subtle">Chain</dt>
                <dd className="truncate text-right text-content-muted">{p.chain}</dd>
                <dt className="text-content-subtle">Live market data</dt>
                <dd className="text-right">
                  {hasLiveComps(p) ? (
                    <span className="mono text-mint-300">{usdCompact(p.venue!.volume30d)} 30d</span>
                  ) : (
                    // Not a failure. Being too small for DefiLlama to track is
                    // the normal state of a programme worth farming early.
                    <span className="text-content-subtle">not tracked</span>
                  )}
                </dd>
              </dl>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-6 rounded-2xl border border-hairline bg-surface-2 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-base font-semibold text-content">{selected.name}</h3>
            {selected.links.website && (
              <a
                href={selected.links.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-content-muted transition-colors hover:text-gold-200"
              >
                Official site <ExternalLink className="h-3 w-3" strokeWidth={1.7} />
              </a>
            )}
          </div>
          {/* The venue facts. Every one of these was already in the registry
              and simply never rendered - "which markets, what leverage, what
              fees" is the first thing anyone asks before farming somewhere. */}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Fact icon={Layers} label="Markets" value={selected.supportedMarkets} />
            <Fact icon={Gauge} label="Max leverage" value={selected.maxLeverage} />
            <Fact icon={Percent} label="Fees" value={selected.fees} />
          </div>

          <dl className="mt-5 space-y-3 text-sm">
            {selected.earnRate && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-content-subtle">
                  How points accrue
                </dt>
                <dd className="mt-1 leading-relaxed text-content-muted">{selected.earnRate}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-content-subtle">
                What they convert to
              </dt>
              <dd className="mt-1 leading-relaxed text-content-muted">{selected.rewardLogic}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-content-subtle">Worth knowing</dt>
              <dd className="mt-1 leading-relaxed text-content-muted">{selected.notes}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* The curated list above is the three programmes with full scenario
          numbers. The running list of everything else worth farming right now
          lives in the channel and changes far too often to hard-code here -
          linking it is honest; copying it would be stale within a week. */}
      <a
        href={site.farming.ongoingAirdrops}
        target="_blank"
        rel="noopener noreferrer"
        className="surface-hover lift group mt-6 flex flex-col gap-3 rounded-2xl border border-hairline p-5 sm:flex-row sm:items-center sm:justify-between"
      >
        <span className="flex items-start gap-3.5">
          <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint-500/10 text-mint-300 transition-transform group-hover:scale-105 group-active:scale-105">
            <Send className="h-5 w-5" strokeWidth={1.7} />
          </span>
          <span>
            <span className="block font-display text-base font-semibold text-content">
              Ongoing perp DEX airdrops
            </span>
            <span className="mt-1 block text-sm leading-relaxed text-content-muted">
              The live list of what is worth farming right now, kept up to date in the XYZ Crypto channel.
            </span>
          </span>
        </span>
        <span className="btn-secondary inline-flex shrink-0 items-center gap-1.5 self-start sm:self-auto">
          Open the list <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.7} />
        </span>
      </a>
    </section>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Layers;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-surface-2 p-3">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-content-subtle">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.7} />
        {label}
      </span>
      <p className="mt-1.5 text-xs leading-relaxed text-content-muted">{value}</p>
    </div>
  );
}
