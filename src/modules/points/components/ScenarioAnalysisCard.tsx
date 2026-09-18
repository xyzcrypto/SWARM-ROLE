"use client";

import { useMemo } from "react";
import { Download } from "lucide-react";
import { usdCompact } from "@modules/points/lib/points";
import { cn } from "@/lib/utils";

interface ScenarioAnalysisCardProps {
  yourPoints: number;
  totalPoints: number;
  currentAlloc: number;
  currentFdv: number;
  onSelectScenario: (fdv: number, alloc: number) => void;
  programName?: string;
}

const FDV_COLS = [
  { label: "$100M", value: 100_000_000 },
  { label: "$300M", value: 300_000_000 },
  { label: "$500M", value: 500_000_000 },
  { label: "$1B", value: 1_000_000_000 },
  { label: "$3B", value: 3_000_000_000 },
];

const ALLOC_ROWS = [10, 20, 30, 40, 50];

export function ScenarioAnalysisCard({
  yourPoints,
  totalPoints,
  currentAlloc,
  currentFdv,
  onSelectScenario,
  programName,
}: ScenarioAnalysisCardProps) {
  // 5x5 Matrix Calculations
  const matrix = useMemo(() => {
    const totalPool = totalPoints || 1;
    const share = yourPoints / totalPool;

    return ALLOC_ROWS.map((alloc) => {
      const rowCells = FDV_COLS.map((col) => {
        const gross = share * (alloc / 100) * col.value;
        return {
          fdv: col.value,
          alloc,
          gross: Math.round(gross),
        };
      });
      return { alloc, cells: rowCells };
    });
  }, [yourPoints, totalPoints]);

  // Find min and max for heatmap scaling
  const allValues = matrix.flatMap((r) => r.cells.map((c) => c.gross));
  const minVal = Math.min(...allValues, 1);
  const maxVal = Math.max(...allValues, 1000);

  const getHeatmapColor = (val: number) => {
    const ratio = (val - minVal) / (maxVal - minVal || 1);
    if (ratio < 0.15) {
      return "bg-rose-950/40 text-rose-300 border-rose-900/30";
    } else if (ratio < 0.4) {
      return "bg-amber-950/40 text-amber-300 border-amber-900/30";
    } else if (ratio < 0.75) {
      return "bg-gold-500/20 text-gold-300 border-gold-500/30";
    } else {
      return "bg-emerald-950/50 text-emerald-300 border-emerald-500/40";
    }
  };

  const exportCsv = () => {
    const headers = ["Allocation %", ...FDV_COLS.map((c) => c.label)].join(",");
    const rows = matrix.map((r) => [r.alloc + "%", ...r.cells.map((c) => c.gross)].join(","));
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${programName || "airdrop"}_scenarios.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-hairline bg-surface-2 p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-hairline">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-content sm:text-xl">
            Scenario Analysis
          </h2>
          <p className="text-xs text-content-muted">
            Estimated returns based on different FDV and allocation scenarios
          </p>
        </div>

        {/* Export Data Button */}
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-1.5 rounded-xl border border-hairline bg-base px-3 py-1.5 text-xs font-semibold text-content-muted hover:border-gold-500/30 hover:text-content transition-all"
        >
          <Download className="h-3.5 w-3.5 text-gold-400" />
          <span>Export Data</span>
        </button>
      </div>

      {/* Heatmap Table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-center border-collapse">
          <thead>
            <tr>
              <th className="py-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-content-subtle text-left">
                Alloc. \ FDV
              </th>
              {FDV_COLS.map((col) => (
                <th
                  key={col.label}
                  className="py-2 px-2 text-xs font-bold text-content-muted mono"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="space-y-1">
            {matrix.map((row) => (
              <tr key={row.alloc}>
                <td className="py-1.5 px-2 text-xs font-bold text-content-muted text-left">
                  {row.alloc}%
                </td>
                {row.cells.map((cell) => {
                  const isCurrent =
                    Math.abs(cell.alloc - currentAlloc) < 1 &&
                    Math.abs(cell.fdv - currentFdv) < 100_000_000;

                  return (
                    <td key={cell.fdv} className="p-1">
                      <button
                        type="button"
                        onClick={() => onSelectScenario(cell.fdv, cell.alloc)}
                        className={cn(
                          "w-full rounded-lg border py-2 px-1 text-xs mono font-bold transition-all hover:scale-105 active:scale-105",
                          getHeatmapColor(cell.gross),
                          isCurrent && "ring-2 ring-gold-400 shadow-md font-extrabold"
                        )}
                      >
                        {usdCompact(cell.gross)}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 pt-3 border-t border-hairline text-[11px] text-content-muted">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-500" />
          <span>Low Return</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          <span>Moderate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-gold-400" />
          <span>Good</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span>High</span>
        </div>
      </div>
    </div>
  );
}
