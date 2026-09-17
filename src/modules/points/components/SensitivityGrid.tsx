"use client";

import { cn } from "@/lib/utils";
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
 */
export function SensitivityGrid({
  grid,
  fdvs,
  allocs,
  currentFdv,
  currentAlloc,
  totalCostUsd,
  programName,
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
}) {
  if (!grid.length || !fdvs.length) return null;

  const hasCost = totalCostUsd > 0;

  // Nearest column/row to the live assumption. Marking it is what connects the
  // grid to the panels above - without it this is a table of unrelated numbers.
  const nearest = (xs: number[], v: number) =>
    xs.reduce((best, x, i) => (Math.abs(x - v) < Math.abs(xs[best] - v) ? i : best), 0);
  const col = nearest(fdvs, currentFdv);
  const row = nearest(allocs, currentAlloc);

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

  return (
    <section className="surface rounded-3xl p-5 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-content sm:text-2xl">
            Every outcome{programName ? ` for ${programName}` : ""},{" "}
            <span className="text-shine">not just one</span>
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-content-muted">
            {hasCost ? (
              <>
                Return on your true cost, across FDV and allocation. <strong className="text-content">1.0x is
                break-even</strong> — below it the farm lost money. The outlined cell is where your assumptions sit.
              </>
            ) : (
              <>
                Gross value across FDV and allocation. Enter your costs above and this becomes a return on cost,
                with a break-even line.
              </>
            )}
          </p>
        </div>
        <Legend hasCost={hasCost} />
      </div>

      <div className="-mx-1 mt-6 overflow-x-auto px-1">
        <table className="w-full border-separate border-spacing-1 text-xs md:min-w-[620px]">
          <caption className="sr-only">
            {hasCost ? "Return on cost" : "Gross value"} for each combination of fully diluted valuation and
            points allocation.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="p-1 text-left text-[10px] font-medium uppercase tracking-wide text-content-subtle">
                Alloc ↓ / FDV →
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
                    "mono p-1 text-left text-[11px] font-medium",
                    r === row ? "text-gold-300" : "text-content-subtle"
                  )}
                >
                  {allocs[r]}%
                </th>
                {cells.map((c, i) => {
                  const { alpha, up } = tint(c);
                  const here = r === row && i === col;
                  return (
                    <td
                      key={c.fdvUsd}
                      // Both numbers are here, but only one is shown: the
                      // multiple decides, the dollars are what you actually get.
                      title={`${usdCompact(c.grossUsd)} gross · ${usdCompact(c.netUsd)} net${
                        hasCost ? ` · ${c.roiMultiple.toFixed(2)}x on cost` : ""
                      }`}
                      className={cn(
                        "mono rounded-lg px-2 py-2 text-right tabular-nums transition-colors",
                        // ⚠️ Theme-aware, NOT text-mint-*/text-rose-*. Measured in
                        // the light theme, `text-mint-100` on this tint scored
                        // 1.01:1 - the entire grid was invisible. These two
                        // tokens exist for exactly this and flip per theme.
                        up ? "grid-net-up" : "grid-net-down",
                        here && "ring-2 ring-gold-400/80"
                      )}
                      style={{
                        backgroundColor: up
                          ? `color-mix(in srgb, var(--data-up) ${Math.round(alpha * 100)}%, transparent)`
                          : `color-mix(in srgb, var(--data-down) ${Math.round(alpha * 100)}%, transparent)`,
                      }}
                    >
                      {hasCost ? (
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
        Read across a row to see how much the valuation decides, and down a column to see how little the allocation
        does by comparison. That asymmetry is the point: FDV is the axis nobody controls, and it is the one that
        moves the answer.
      </p>
    </section>
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
