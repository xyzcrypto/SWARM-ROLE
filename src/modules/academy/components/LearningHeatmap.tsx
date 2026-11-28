"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Day = { d: string; xp: number };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const label = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return `${MONTHS[m - 1]} ${day}, ${y}`;
};
/** 0 = nothing, then four steps. Thresholds sit where a quiz, a few quizzes and a big day fall. */
export function heatLevel(xp: number): 0 | 1 | 2 | 3 | 4 {
  return xp <= 0 ? 0 : xp < 25 ? 1 : xp < 100 ? 2 : xp < 250 ? 3 : 4;
}

/**
 * A member's learning calendar: one square per UTC day for 26 weeks, Monday
 * at the top, shaded by the XP they earned. Hover or tap a day for its total.
 * Everything is derived from the server's array, so SSR and the first client
 * render are identical; only the tooltip is interactive.
 */
export function LearningHeatmap({ days, className }: { days: Day[]; className?: string }) {
  const [pick, setPick] = useState<Day | null>(null);
  // On a narrow screen the calendar scrolls: start at today, not 26 weeks ago.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);
  // Pad the first column so rows line up with weekdays (Mon..Sun).
  const lead = useMemo(() => {
    if (!days.length) return 0;
    const dow = new Date(`${days[0].d}T00:00:00Z`).getUTCDay(); // 0 = Sun
    return (dow + 6) % 7;
  }, [days]);
  const cells = useMemo<(Day | null)[]>(() => [...Array.from({ length: lead }, () => null), ...days], [lead, days]);
  const weeks = Math.ceil(cells.length / 7);
  // Month labels over the first week that starts in a new month.
  const months = useMemo(() => {
    const out: { col: number; text: string }[] = [];
    let last = -1;
    for (let w = 0; w < weeks; w++) {
      const first = cells.slice(w * 7, w * 7 + 7).find(Boolean);
      if (!first) continue;
      const m = Number(first.d.slice(5, 7)) - 1;
      if (m !== last) {
        if (out.length === 0 || w - out[out.length - 1].col >= 3) out.push({ col: w, text: MONTHS[m] });
        last = m;
      }
    }
    return out;
  }, [cells, weeks]);
  const total = days.reduce((s, d) => s + d.xp, 0);
  const active = days.filter((d) => d.xp > 0).length;

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-baseline justify-between gap-3 text-xs text-content-subtle">
        <span>
          <span className="font-semibold text-content">{active}</span> active day{active === 1 ? "" : "s"} · <span className="font-semibold text-content">{total.toLocaleString("en-US")}</span> XP in 26 weeks
        </span>
        <span className="hidden min-h-[1rem] text-right sm:block" aria-live="polite">
          {pick ? `${label(pick.d)}: ${pick.xp ? `${pick.xp.toLocaleString("en-US")} XP` : "no activity"}` : ""}
        </span>
      </div>
      <div ref={scroller} className="mt-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="inline-block">
          <div className="relative ml-6 h-4 text-[0.625rem] text-content-subtle" style={{ width: weeks * 14 }}>
            {months.map((m) => (
              <span key={`${m.col}${m.text}`} className="absolute" style={{ left: m.col * 14 }}>
                {m.text}
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            <div className="grid grid-rows-7 gap-[0.1875rem] pr-1 text-[0.5625rem] leading-[0.6875rem] text-content-subtle">
              {["Mon", "", "Wed", "", "Fri", "", ""].map((d, i) => (
                <span key={i} className="h-[0.6875rem]">
                  {d}
                </span>
              ))}
            </div>
            <div className="grid grid-flow-col grid-rows-7 gap-[0.1875rem]" role="img" aria-label={`${active} active days and ${total} XP in the last 26 weeks`}>
              {cells.map((c, i) =>
                c ? (
                  <button
                    key={c.d}
                    type="button"
                    tabIndex={-1}
                    onMouseEnter={() => setPick(c)}
                    onFocus={() => setPick(c)}
                    onClick={() => setPick(c)}
                    title={`${label(c.d)}: ${c.xp ? `${c.xp} XP` : "no activity"}`}
                    className={cn("acad-heat h-[0.6875rem] w-[0.6875rem] rounded-[0.1875rem]", `is-l${heatLevel(c.xp)}`, pick?.d === c.d && "is-picked")}
                    aria-label={`${label(c.d)}: ${c.xp} XP`}
                  />
                ) : (
                  <span key={`pad${i}`} className="h-[0.6875rem] w-[0.6875rem]" />
                )
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-[0.625rem] text-content-subtle">
        <span className="sm:hidden" aria-live="polite">
          {pick ? `${label(pick.d)}: ${pick.xp ? `${pick.xp} XP` : "no activity"}` : "Tap a day"}
        </span>
        <span className="ml-auto flex items-center gap-1">
          Less
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className={cn("acad-heat h-[0.625rem] w-[0.625rem] rounded-[0.1875rem]", `is-l${l}`)} />
          ))}
          More
        </span>
      </div>
    </div>
  );
}
