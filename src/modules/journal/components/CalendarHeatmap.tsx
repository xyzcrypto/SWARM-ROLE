"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { PeriodBucket } from "@/lib/journal-analytics";

const DAYS = 84; // ~12 weeks

// GitHub-style contribution heatmap, colored by realized P&L per day instead
// of commit count. Reuses the same day-bucketed data as the daily breakdown
// table - just a different presentation of periodBreakdown(trades, "day").
export function CalendarHeatmap({ dayBuckets }: { dayBuckets: PeriodBucket[] }) {
  const map = useMemo(() => new Map(dayBuckets.map((b) => [b.period, b])), [dayBuckets]);
  const [hover, setHover] = useState<string | null>(null);

  const days = useMemo(() => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const arr: { date: string; pnl: number; trades: number }[] = [];
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      const bucket = map.get(key);
      arr.push({ date: key, pnl: bucket?.pnl ?? 0, trades: bucket?.trades ?? 0 });
    }
    return arr;
  }, [map]);

  const maxAbs = Math.max(1, ...days.map((d) => Math.abs(d.pnl)));

  // Static class strings (not template-interpolated) so Tailwind's JIT scanner
  // can find them at build time.
  const MINT_BANDS = ["bg-mint-500/20", "bg-mint-500/40", "bg-mint-500/70"];
  const ROSE_BANDS = ["bg-rose-500/20", "bg-rose-500/40", "bg-rose-500/70"];
  function colorFor(pnl: number, trades: number) {
    if (trades === 0) return "bg-white/[0.03]";
    const intensity = Math.min(1, Math.abs(pnl) / maxAbs);
    const bandIdx = intensity > 0.66 ? 2 : intensity > 0.33 ? 1 : 0;
    return (pnl >= 0 ? MINT_BANDS : ROSE_BANDS)[bandIdx];
  }

  const weeks: (typeof days)[] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const hovered = hover ? days.find((d) => d.date === hover) : null;

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto pb-2">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((d) => (
              <button
                key={d.date}
                type="button"
                onMouseEnter={() => setHover(d.date)}
                onMouseLeave={() => setHover(null)}
                className={cn("h-3.5 w-3.5 rounded-[3px] transition-transform hover:scale-125", colorFor(d.pnl, d.trades))}
                aria-label={`${d.date}: ${d.trades} trades, $${d.pnl.toFixed(2)}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
        <span>
          {hovered
            ? `${new Date(hovered.date).toLocaleDateString()} — ${hovered.trades} trade${hovered.trades === 1 ? "" : "s"}, $${hovered.pnl.toFixed(2)}`
            : `Last ${DAYS} days`}
        </span>
        <span className="flex items-center gap-1">
          Less
          <span className="h-2.5 w-2.5 rounded-[2px] bg-white/[0.03]" />
          <span className="h-2.5 w-2.5 rounded-[2px] bg-mint-500/40" />
          <span className="h-2.5 w-2.5 rounded-[2px] bg-mint-500/70" />
          More
        </span>
      </div>
    </div>
  );
}
