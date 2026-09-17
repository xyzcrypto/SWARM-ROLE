"use client";

import { LayoutGrid, RotateCcw } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { LiveChip, PointsPanel } from "./PointsPanel";
import { usdCompact, type GridCell } from "@modules/points/lib/points";

/**
 * The whole outcome space, rather than one number.
 *
 * ## Why it shows a MULTIPLE, not a dollar amount
 *
 * The first version painted net dollars. On a geometric FDV ladder that is
 * dominated by the top-right corner - and when the farm is profitable at every
 * cell, which is the common case, the result is a uniformly green table where
 * no cell means anything relative to any other. A grid nobody can read is worse
 * than no grid, because it looks like information.
 *
 * Return on cost is scale-free, so every cell is comparable, and it has a
 * natural pivot everyone already understands: **1.0x is break-even**. Below it
 * you lost money, above it you did not. That single boundary is the most
 * actionable thing on this page, and the colour scale is built around it rather
 * than around the biggest number present.
 *
 * With no cost entered there is no multiple to show, so it falls back to net
 * dollars - honestly labelled, rather than dividing by zero and printing "Inf".
 *
 * ## Why it is not a static table
 *
 * The ladder is built around the LIVE peer median, so the whole grid re-centres
 * when the comparables route refreshes - every 320s, and on tab wake. Three
 * things make that visible and usable rather than merely true:
 *
 * - the live column is marked separately from your own assumption, so you can
 *   see how far your number sits from what the market is currently paying;
 * - the break-even contour is drawn through the rows, so the boundary is a line
 *   on the table rather than something you locate cell by cell;
 * - every cell is a control. Clicking one adopts that FDV and allocation, and
 *   the relink button puts you back on the live anchor.
 */
export function SensitivityGrid({
  grid,
  fdvs,
  allocs,
  currentFdv,
  currentAlloc,
  totalCostUsd,
  programName,
  onPick,
  liveFdv = 0,
  liveLabel,
  anchorIsLive = false,
  liveLow = 0,
  liveHigh = 0,
  livePeers = 0,
  fetchedAt = null,
  breakEvenFdvs,
  linked = false,
  onRelink,
}: {
  grid: GridCell[][];
  fdvs: number[];
  allocs: number[];
  currentFdv: number;
  currentAlloc: number;
  totalCostUsd: number;
  /** Named in the heading, so a grid of numbers cannot be read against the
   *  wrong programme. */
  programName?: string;
  /** Adopt a cell's scenario. Without this the grid is a table you read; with
   *  it, it is a control you steer with - which is the difference between
   *  "interesting" and "useful". */
  onPick?: (fdvUsd: number, allocationPct: number) => void;
  /** The FDV the live comparables currently imply. 0 when they are unavailable,
   *  in which case none of the live affordances render at all - a stale or
   *  absent number must never be dressed up as a live one. */
  liveFdv?: number;
  /** What the anchor is, in words: "live peer median", "published scenario". */
  liveLabel?: string;
  /**
   * Whether the anchor actually came from live comparables.
   *
   * ⚠️ Separate from `liveFdv > 0`, and that distinction shipped wrong: the
   * panel drew a green **"Live anchor"** chip directly above the sentence
   * "Ladder centred on the published scenario $290.00M". A published scenario is
   * a hand-entered registry figure that has not moved in weeks. Labelling it
   * live is the precise failure this whole page argues against - a static number
   * wearing the costume of a measured one.
   */
  anchorIsLive?: boolean;
  /** The cheapest and dearest FDV the peer set implies. 0 when the anchor did
   *  not come from comparables, in which case no band is drawn - a published
   *  scenario is a single number and must not be dressed in a range it does
   *  not have. */
  liveLow?: number;
  liveHigh?: number;
  /** How many peers produced that band. A range from two peers is not a range. */
  livePeers?: number;
  /** When the live data last arrived. Null until the first fetch resolves, so
   *  this is state, never a clock read during render. */
  fetchedAt?: number | null;
  /** Break-even FDV per allocation row, in the same order as `allocs`. */
  breakEvenFdvs?: number[];
  /** Whether the assumption is currently following the live anchor. */
  linked?: boolean;
  onRelink?: () => void;
}) {
  if (!grid.length || !fdvs.length) return null;

  const hasCost = totalCostUsd > 0;

  // Nearest column/row to the live assumption. Marking it is what connects the
  // grid to the panels above - without it this is a table of unrelated numbers.
  const nearest = (xs: number[], v: number) =>
    xs.reduce((best, x, i) => (Math.abs(x - v) < Math.abs(xs[best] - v) ? i : best), 0);
  const col = nearest(fdvs, currentFdv);
  const row = nearest(allocs, currentAlloc);
  // Separate from `col` on purpose. When they coincide your assumption IS the
  // market's; when they do not, the distance between the two marks is the most
  // informative thing on the table and collapsing them would hide it.
  const liveCol = liveFdv > 0 ? nearest(fdvs, liveFdv) : -1;

  /**
   * Colour around break-even.
   *
   * Log-scaled on each side of 1.0x: farming outcomes are multiplicative, so
   * 2x and 4x should look as different as 4x and 8x. A linear ramp spends its
   * whole range on the largest cell and leaves the rest flat - measured on the
   * first version, intensities ran 0.004 to 0.42 and every cell but two painted
   * as plain background.
   */
  // ⚠️ The cap is 0.28, not 0.45, and it is a CONTRAST limit rather than a
  // taste one. The cell text is `--data-down` (#dc2626, 4.54:1 on white) - only
  // just over AA - and a tint darkens the ground under it. Measured in the
  // light theme at 0.45 alpha, every loss cell scored **4.27:1**, under the 4.5
  // it needs. At 0.28 they clear it, and the ramp is still perfectly readable
  // because its job is ranking, not saturation.
  //
  // This did not show up in the first audit because that fixture happened to
  // have no losing cells - the whole grid was green, where the foreground has
  // far more headroom.
  const MAX_TINT = 0.28;
  const tint = (c: GridCell): { alpha: number; up: boolean } => {
    if (!hasCost) {
      const peak = Math.max(...grid.flat().map((x) => Math.abs(x.netUsd)), 1);
      return { alpha: Math.min(MAX_TINT, Math.sqrt(Math.abs(c.netUsd) / peak) * MAX_TINT), up: c.netUsd >= 0 };
    }
    const r = c.roiMultiple;
    const up = r >= 1;
    // 1x -> 0 intensity, 10x (or 1/10th) -> full. Beyond that it saturates,
    // which is correct: at 30x nobody needs the colour to keep getting louder.
    const mag = Math.min(1, Math.abs(Math.log10(Math.max(r, 1e-6))) / 1);
    return { alpha: 0.05 + mag * (MAX_TINT - 0.05), up };
  };

  // The single most useful sentence on the panel: where the line is for YOUR
  // allocation, and where the market currently sits relative to it. Both numbers
  // already exist; nothing here made a reader do the comparison.
  const beHere = hasCost ? breakEvenFdvs?.[row] ?? 0 : 0;
  const clearsIt = beHere > 0 && liveFdv > 0 ? liveFdv >= beHere : null;

  // ── the band the market actually implies ──────────────────────────────────
  // A median alone invites planning around the median. The low and the high are
  // the peers DISAGREEING, and the width of that disagreement is usually the
  // finding - so bear / base / bull are computed from real comparables rather
  // than from a made-up +/- percentage.
  //
  // Requires three peers. A "range" from two is one peer either side of nothing,
  // and dressing that as a scenario band would be inventing precision.
  const hasBand = livePeers >= 3 && liveLow > 0 && liveHigh > liveLow;
  const scenarios = hasBand
    ? ([
        { key: "Bear", fdv: liveLow, tone: "down" as const, note: "cheapest peer" },
        { key: "Base", fdv: liveFdv, tone: "base" as const, note: "peer median" },
        { key: "Bull", fdv: liveHigh, tone: "up" as const, note: "dearest peer" },
      ])
    : [];
  /** Value at an arbitrary FDV, read off the row the reader is actually on. */
  const atFdv = (fdv: number) => {
    const cells = grid[row] ?? [];
    const base = cells[0];
    if (!base || !(base.fdvUsd > 0)) return { gross: 0, roi: 0 };
    // Gross is linear in FDV once the share is fixed, so this scales exactly
    // rather than needing another pass of projectValue.
    const gross = (base.grossUsd / base.fdvUsd) * fdv;
    return { gross, roi: hasCost ? gross / totalCostUsd : 0 };
  };

  return (
    <PointsPanel
      eyebrow="Every outcome"
      icon={LayoutGrid}
      title={`Not one number${programName ? `, for ${programName}` : ""}`}
      accent="but the whole range"
      description={
        hasCost
          ? "Return on your true cost, across FDV and allocation. 1.0x is break-even, below it the farm lost money. Tap any cell to load that scenario above."
          : "Gross value across FDV and allocation. Enter your costs above and this becomes a return on cost, with a break-even line."
      }
      actions={<Legend hasCost={hasCost} />}
      meta={
        liveFdv > 0 ? (
          <>
            {anchorIsLive ? (
              <LiveChip state="live">Live anchor</LiveChip>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-2.5 py-1 font-medium text-content-subtle">
                <span className="h-1.5 w-1.5 rounded-full bg-content-subtle" />
                Published scenario
              </span>
            )}
            <span className="text-content-muted">
              Ladder centred on the {liveLabel ?? "live anchor"}{" "}
              <span className="mono text-content">{usdCompact(liveFdv)}</span>
              {/* `fetchedAt` is null until the first fetch resolves, so this
                  clause is absent from the server render and appears with the
                  data. Nothing here is derived from a clock during render. */}
              {fetchedAt ? (
                <span className="text-content-subtle"> · updated {formatDateTime(new Date(fetchedAt))}</span>
              ) : null}
            </span>
            {linked ? (
              <span className="text-content-subtle">Your assumption follows it.</span>
            ) : onRelink ? (
              <button
                type="button"
                onClick={onRelink}
                className="inline-flex items-center gap-1 rounded-lg border border-hairline px-2 py-1 font-medium text-content-muted transition-colors hover:text-gold-200"
              >
                <RotateCcw className="h-3 w-3" strokeWidth={1.7} />
                Follow live again
              </button>
            ) : null}
          </>
        ) : null
      }
    >
      {/* Bear / base / bull, from the live peer spread. Three numbers a reader
          can act on, above a grid that shows why they are those numbers. */}
      {scenarios.length > 0 && (
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {scenarios.map((sc) => {
            const { gross, roi } = atFdv(sc.fdv);
            return (
              <button
                key={sc.key}
                type="button"
                onClick={onPick ? () => onPick(sc.fdv, allocs[row]) : undefined}
                disabled={!onPick}
                className={cn(
                  "rounded-2xl border border-hairline bg-surface-2 p-4 text-left transition-colors",
                  onPick && "hover:border-gold-500/25 active:border-gold-500/25"
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-content-subtle">
                    {sc.key}
                  </span>
                  <span className="text-[10px] text-content-subtle">{sc.note}</span>
                </span>
                <span className="mono mt-1.5 block text-lg font-semibold tabular-nums text-content">
                  {usdCompact(gross)}
                </span>
                <span className="mt-0.5 flex items-center gap-2 text-[11px]">
                  <span className="mono text-content-subtle">{usdCompact(sc.fdv)} FDV</span>
                  {hasCost && (
                    <span className={cn("mono font-semibold", roi >= 1 ? "grid-net-up" : "grid-net-down")}>
                      {formatMultiple(roi)}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* The verdict, stated. A grid shows you everything; this says the one
          thing you came to find out. */}
      {beHere > 0 && (
        <p className="mt-5 rounded-xl border border-hairline bg-surface-2 px-4 py-3 text-sm leading-relaxed text-content-muted">
          At <span className="mono font-semibold text-content">{allocs[row]}%</span> of supply you break even at{" "}
          <span className="mono font-semibold text-content">{usdCompact(beHere)}</span> FDV.
          {clearsIt === null ? null : clearsIt ? (
            <>
              {" "}
              The live market implies{" "}
              <span className="mono font-semibold grid-net-up">{usdCompact(liveFdv)}</span>, which clears it by{" "}
              <span className="mono font-semibold grid-net-up">{(liveFdv / beHere).toFixed(2)}x</span>.
            </>
          ) : (
            <>
              {" "}
              The live market implies{" "}
              <span className="mono font-semibold grid-net-down">{usdCompact(liveFdv)}</span>, which is{" "}
              <span className="mono font-semibold grid-net-down">{(beHere / liveFdv).toFixed(2)}x</span> short of it.
            </>
          )}
        </p>
      )}

      <div className="-mx-1 mt-6 overflow-x-auto px-1">
        <table className="w-full table-fixed border-separate border-spacing-1 text-xs md:min-w-[620px]">
          <caption className="sr-only">
            {hasCost ? "Return on cost" : "Gross value"} for each combination of fully diluted valuation and
            points allocation.
          </caption>
          <thead>
            <tr>
              {/* Two short lines rather than one long one: on a 393px screen
                  the single-line version was sized by the "50%" column beneath
                  it and clipped to "LLOC / DV →". */}
              <th scope="col" className="whitespace-nowrap p-1 text-left text-[10px] font-medium uppercase tracking-wide text-content-subtle">
                Alloc ↓<br />FDV →
              </th>
              {fdvs.map((f, i) => (
                <th
                  key={f}
                  scope="col"
                  className={cn(
                    "mono p-1 text-right text-[11px] font-medium",
                    i === col ? "text-gold-300" : "text-content-subtle"
                  )}
                >
                  {usdCompact(f)}
                  {i === liveCol && (
                    <span
                      title={`Closest rung to the live ${liveLabel ?? "anchor"} (${usdCompact(liveFdv)})`}
                      className="ml-1 inline-block h-1.5 w-1.5 rounded-full align-middle bg-mint-400"
                    >
                      <span className="sr-only">live market level</span>
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((cells, r) => (
              <tr key={allocs[r]}>
                <th
                  scope="row"
                  className={cn(
                    "mono whitespace-nowrap p-1 text-left text-[11px] font-medium",
                    r === row ? "text-gold-300" : "text-content-subtle"
                  )}
                >
                  {allocs[r]}%
                  {/* The row's break-even FDV, stated rather than implied. A
                      reader should not have to scan five cells to find where
                      the line falls for their allocation. */}
                  {hasCost && breakEvenFdvs?.[r] ? (
                    <span className="ml-1 hidden text-[10px] font-normal text-content-subtle opacity-80 sm:inline">
                      BE {usdCompact(breakEvenFdvs[r])}
                    </span>
                  ) : null}
                </th>
                {cells.map((c, i) => {
                  const { alpha, up } = tint(c);
                  const here = r === row && i === col;
                  // The break-even contour: the leftmost rung in this row that
                  // clears 1.0x. Drawing the boundary as a line is the whole
                  // reason the table beats reading five numbers.
                  const firstUp =
                    hasCost && c.roiMultiple >= 1 && !(cells[i - 1]?.roiMultiple >= 1);
                  // Both numbers are here, but only one is shown: the multiple
                  // decides, the dollars are what you actually get.
                  const label = `${usdCompact(c.grossUsd)} gross · ${usdCompact(c.netUsd)} net${
                    hasCost ? ` · ${c.roiMultiple.toFixed(2)}x on cost` : ""
                  }`;
                  const body = hasCost ? (
                    <>
                      <span className={cn("font-semibold", here && "text-[13px]")}>
                        {formatMultiple(c.roiMultiple)}
                      </span>
                      <span className="ml-1 hidden text-[10px] opacity-70 sm:inline">
                        {usdCompact(c.netUsd)}
                      </span>
                    </>
                  ) : (
                    usdCompact(c.grossUsd)
                  );
                  return (
                    <td
                      key={c.fdvUsd}
                      title={label}
                      className={cn(
                        "mono rounded-lg text-right tabular-nums transition-colors",
                        // ⚠️ Theme-aware, NOT text-mint-*/text-rose-*. Measured in
                        // the light theme, `text-mint-100` on this tint scored
                        // 1.01:1 - the entire grid was invisible. These two
                        // tokens exist for exactly this and flip per theme.
                        up ? "grid-net-up" : "grid-net-down",
                        here && "ring-2 ring-gold-400/80",
                        firstUp && "border-l-2 border-l-mint-400/70",
                        i === liveCol && !here && "ring-1 ring-mint-400/40",
                        // The button owns the padding when there is one, so the
                        // whole cell is the hit target rather than the text in it.
                        onPick ? "p-0" : "px-2 py-2"
                      )}
                      style={{
                        backgroundColor: up
                          ? `color-mix(in srgb, var(--data-up) ${Math.round(alpha * 100)}%, transparent)`
                          : `color-mix(in srgb, var(--data-down) ${Math.round(alpha * 100)}%, transparent)`,
                      }}
                    >
                      {onPick ? (
                        <button
                          type="button"
                          onClick={() => onPick(c.fdvUsd, allocs[r])}
                          aria-pressed={here}
                          aria-label={`Use ${usdCompact(c.fdvUsd)} FDV at ${allocs[r]}% — ${label}`}
                          className="block w-full rounded-lg px-2 py-2 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                        >
                          {body}
                        </button>
                      ) : (
                        body
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-content-subtle">
        {onPick ? "Tap any cell to load that FDV and allocation into the section above. " : ""}
        {liveCol >= 0 ? (
          <>
            The <span className="text-mint-300">mint</span> mark is where the live market sits; the gold outline is
            where your assumption sits.{" "}
          </>
        ) : null}
        {hasCost ? "The mint edge inside a row is where that allocation breaks even. " : ""}
        Read across a row to see how much the valuation decides, and down a column to see how little the allocation
        does by comparison. That asymmetry is the point: FDV is the axis nobody controls, and it is the one that
        moves the answer.
      </p>
    </PointsPanel>
  );
}

/** Below 10x, two decimals carry real information; above it they are noise. */
function formatMultiple(r: number): string {
  if (!Number.isFinite(r) || r <= 0) return "—";
  if (r >= 100) return `${Math.round(r)}x`;
  if (r >= 10) return `${r.toFixed(1)}x`;
  return `${r.toFixed(2)}x`;
}

function Legend({ hasCost }: { hasCost: boolean }) {
  if (!hasCost) return null;
  return (
    <dl className="flex items-center gap-3 text-[11px]">
      <div className="flex items-center gap-1.5">
        <span
          className="h-3 w-3 rounded"
          style={{ backgroundColor: "color-mix(in srgb, var(--data-down) 24%, transparent)" }}
        />
        <dt className="sr-only">Loss</dt>
        <dd className="text-content-muted">under 1x</dd>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded border border-hairline" />
        <dt className="sr-only">Break-even</dt>
        <dd className="text-content-muted">1x</dd>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className="h-3 w-3 rounded"
          style={{ backgroundColor: "color-mix(in srgb, var(--data-up) 24%, transparent)" }}
        />
        <dt className="sr-only">Profit</dt>
        <dd className="text-content-muted">over 1x</dd>
      </div>
    </dl>
  );
}
