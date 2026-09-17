"use client";

import { BadgeCheck, ChevronDown, CircleHelp, ExternalLink, Gauge, Layers, Percent } from "lucide-react";
import { cn } from "@/lib/utils";
import { platformLogo } from "@/lib/dex-registry";
import { usdCompact, type CompVenue, type ValueResult } from "@modules/points/lib/points";
import { PHASE_LABEL, hasLiveComps, type ProgramView } from "@modules/points/lib/programs";
import { ValuePanel } from "./ValuePanel";

const PHASE_TONE: Record<ProgramView["phase"], string> = {
  live: "border-mint-500/30 bg-mint-500/10 text-mint-200",
  upcoming: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  distributed: "border-gold-500/30 bg-gold-500/10 text-gold-200",
  ended: "border-hairline bg-white/[0.03] text-content-subtle",
};

/**
 * One programme, one complete calculation.
 *
 * Each tracked programme gets its own section with its own inputs, its own
 * scenario quick-picks and its own result - rather than a single calculator you
 * switch between. Switching meant you could never see your Sodex and your
 * RiseX position at the same time, which is the comparison anyone farming more
 * than one of them actually wants to make.
 *
 * The layout follows what /tools had, because that is what the numbers were
 * written for: the programme's own note, the five fields, the published
 * scenario pills under the field each one sets, then the result.
 */
export function ProgramSection({
  program,
  form,
  set,
  value,
  anchor,
  anchorFdv,
  target,
  open,
  onToggle,
}: {
  program: ProgramView;
  form: any;
  set: (k: any, v: any) => void;
  value: ValueResult;
  anchor: "comps" | "program" | "none";
  anchorFdv: number;
  target: CompVenue | null;
  /** Collapsed by default so the page is a list you scan, not a document you
   *  scroll. The summary row still carries the headline number, so comparing
   *  two programmes never requires opening either. */
  open: boolean;
  onToggle: () => void;
}) {
  const logo = platformLogo({ links: program.links, logo: program.logo ?? undefined });

  return (
    <section id={`programme-${program.id}`} className="surface scroll-mt-28 rounded-3xl p-5 sm:p-7 lg:p-8">
      {/* ⚠️ The logo does NOT lead this row, and that is an alignment fix rather
          than a taste one. It used to sit first, which pushed the programme name
          40px right of every other panel title on the page - measured at x=177
          against x=125 everywhere else. Six panels lining up and three not is
          exactly what reads as "not aligned", and no amount of polish elsewhere
          survives a ragged left edge.

          So the left column is the same grammar every other panel uses (eyebrow,
          then title, both flush to the card's padding), and the brand mark moves
          to the right where it sits with the number it belongs to. */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full flex-wrap items-start justify-between gap-x-6 gap-y-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <span className={cn("eyebrow-glass inline-flex items-center gap-1.5 text-[11px]", PHASE_TONE[program.phase])}>
            {PHASE_LABEL[program.phase]}
          </span>
          <h2 className="mt-3 font-display text-xl font-semibold tracking-tight text-content sm:text-2xl">
            {program.name}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {/* Whose numbers these are. The single most important thing on a
                card full of confident-looking figures. */}
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[11px] font-medium",
                program.confirmed ? "text-mint-300" : "text-content-subtle"
              )}
            >
              {program.confirmed ? (
                <BadgeCheck className="h-3.5 w-3.5" strokeWidth={1.7} />
              ) : (
                <CircleHelp className="h-3.5 w-3.5" strokeWidth={1.7} />
              )}
              {program.confirmed ? "Confirmed by the protocol" : "Community assumptions"}
            </span>
            {hasLiveComps(program) && (
              <span className="mono text-[11px] text-mint-300">
                {usdCompact(program.venue!.volume24h)} 24h
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {/* The headline number, always visible. This is what makes a closed
              section still worth reading. */}
          <span className="text-right">
            <span className="mono block text-lg font-semibold text-gold-gradient sm:text-xl">
              {usdCompact(value.grossUsd)}
            </span>
            <span className="block text-[10px] text-content-subtle">
              {usdCompact(value.liquidAtTgeUsd)} at TGE
            </span>
          </span>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 rounded-xl"
              onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")}
            />
          ) : (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/5 text-[11px] font-semibold text-content-muted">
              {program.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <ChevronDown
            className={cn("h-5 w-5 shrink-0 text-content-subtle transition-transform", open && "rotate-180")}
            strokeWidth={1.7}
          />
        </div>
      </button>

      {open && (
        <>
      {/* The programme's own caveat, in its own words. It says which of these
          numbers are real and which are planning assumptions, and it is the
          thing a reader should see before the figures, not after. */}
      <p className="mt-4 rounded-xl border border-hairline bg-surface-2 px-4 py-3 text-xs leading-relaxed text-content-muted">
        {program.notes}
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Fact icon={Layers} label="Markets" value={program.supportedMarkets} />
        <Fact icon={Gauge} label="Max leverage" value={program.maxLeverage} />
        <Fact icon={Percent} label="Fees" value={program.fees} />
      </div>

      {program.earnRate && (
        <p className="mt-4 text-sm leading-relaxed text-content-muted">
          <span className="text-xs font-semibold uppercase tracking-wide text-content-subtle">
            How points accrue —{" "}
          </span>
          {program.earnRate}
        </p>
      )}

      <div className="mt-6 border-t border-hairline pt-6">
        <ValuePanel
          form={form}
          set={set}
          value={value}
          target={target}
          linked={form.fdvLinked}
          anchor={anchor}
          anchorFdv={anchorFdv}
          programName={program.name}
          allocationScenarios={program.scenario.allocationScenarios}
          fdvScenarios={program.scenario.fdvScenariosUsd}
          bare
        />
      </div>
      {program.links.website && (
        <a
          href={program.links.website}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1 text-xs text-content-muted transition-colors hover:text-gold-200"
        >
          Official site <ExternalLink className="h-3 w-3" strokeWidth={1.7} />
        </a>
      )}
        </>
      )}
    </section>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof Layers; label: string; value: string }) {
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
