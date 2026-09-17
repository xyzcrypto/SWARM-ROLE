"use client";

import { cn } from "@/lib/utils";
import { usdCompact, type GridCell } from "@modules/points/lib/points";

/**
 * The whole outcome space, rather than one number.
 *
 * A single "estimated value" is an anchor, and people plan around anchors. A
 * grid shows the shape of the bet instead - and the shape is usually the
 * finding: value moves 4x across the FDV axis and 5x across allocation here,
 * but FDV is the axis nobody can control and every farmer argues about
 * allocation.
 */
export function SensitivityGrid({
  grid,
  fdvs,
  allocs,
  currentFdv,
  currentAlloc,
}: {
  grid: GridCell[][];
  fdvs: number[];
  allocs: number[];
  currentFdv: number;
  currentAlloc: number;
}) {
  if (!grid.length || !fdvs.length) return null;

  // Scale colour by magnitude relative to the best cell, so the heat map reads
  // the same whether the numbers are hundreds or millions.
  //
  // ⚠️ The scale is a SQUARE ROOT, not linear, and that is the difference
  // between a heat map and a blank table. The FDV ladder is geometric and
  // value is linear in FDV, so the corner cells differ by ~125x - measured on
  // the default inputs, the grid ran from intensity 0.004 to 0.42, which paints
  // every cell but the last two as plain background. A reader sees "the grid is
  // broken" rather than "these outcomes are small". sqrt compresses that into a
  // band the eye can actually read across, without reordering anything.
  const peak = Math.max(...grid.flat().map((c) => Math.abs(c.netUsd)), 1);
  const intensityOf = (net: number) => Math.min(0.45, Math.sqrt(Math.abs(net) / peak) * 0.45);

  // Nearest column/row to the live assumption. Marking it is what connects the
  // grid to the panels above - without it this is a table of unrelated numbers.
  const nearest = (xs: number[], v: number) =>
    xs.reduce((best, x, i) => (Math.abs(x - v) < Math.abs(xs[best] - v) ? i : best), 0);
  const col = nearest(fdvs, currentFdv);
  const row = nearest(allocs, currentAlloc);

  return (
    <section className="surface rounded-3xl p-5 sm:p-8">
      <h2 className="font-display text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
        Every outcome, <span className="text-shine">not just one</span>
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
        Net of your true cost, across FDV and allocation. Mint is profit, red is loss. The outlined cell is where
        your current assumptions sit.
      </p>

      <div className="-mx-1 mt-6 overflow-x-auto px-1">
        <table className="w-full border-separate border-spacing-1 text-xs md:min-w-[620px]">
          <thead>
            <tr>
              <th className="p-1 text-left text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Alloc ↓ / FDV →
              </th>
              {fdvs.map((f, i) => (
                <th
                  key={f}
                  className={cn(
                    "mono p-1 text-right text-[11px] font-medium",
                    i === col ? "text-gold-200" : "text-zinc-500"
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
                  className={cn(
                    "mono p-1 text-left text-[11px] font-medium",
                    r === row ? "text-gold-200" : "text-zinc-500"
                  )}
                >
                  {allocs[r]}%
                </th>
                {cells.map((c, i) => {
                  const intensity = intensityOf(c.netUsd);
                  const win = c.netUsd >= 0;
                  return (
                    <td
                      key={c.fdvUsd}
                      className={cn(
                        "mono rounded-lg px-2 py-2 text-right tabular-nums transition-colors",
                        win ? "text-mint-100" : "text-rose-200",
                        r === row && i === col && "ring-2 ring-gold-400/70"
                      )}
                      style={{
                        backgroundColor: win
                          ? `rgba(34, 214, 146, ${intensity})`
                          : `rgba(244, 63, 94, ${intensity})`,
                      }}
                    >
                      {usdCompact(c.netUsd)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-zinc-600">
        Each cell is gross value at that FDV and allocation, minus your true cost. Read across a row to see how
        much the valuation decides, and down a column to see how little the allocation does by comparison.
      </p>
    </section>
  );
}
