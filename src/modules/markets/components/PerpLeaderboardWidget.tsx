"use client";

import React from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { pct, compactUsd } from "@/lib/markets";
import { FEATURED_PERP_VENUES, type PerpVenue } from "../lib/perp-venues";

interface PerpLeaderboardWidgetProps {
  venues?: PerpVenue[];
  onViewAll?: () => void;
}

function VenueLogo({ src, name }: { src: string | null; name: string }) {
  const [err, setErr] = React.useState(false);
  if (src && !err) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={18}
        height={18}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="h-[1.125rem] w-[1.125rem] shrink-0 rounded-full bg-zinc-900 object-contain ring-1 ring-black/10 dark:ring-white/10"
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <div className="flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded-full bg-gold-500/10 text-[0.5625rem] font-bold text-amber-600 dark:text-gold-300 ring-1 ring-gold-500/30">
      {name[0]}
    </div>
  );
}

/**
 * The seven venues the owner chose, ranked by live 24h volume. Every figure is
 * from a live source (`/api/markets/perp` → CoinGecko, Hyperliquid, DefiLlama);
 * a venue no source reports shows a dash.
 */
export function PerpLeaderboardWidget({ venues, onViewAll }: PerpLeaderboardWidgetProps) {
  const top = Math.max(1, ...(venues ?? []).map((v) => v.volume24h ?? 0));
  const showChange = (venues ?? []).some((v) => v.change1d != null);

  return (
    <div className="neu-card rounded-2xl border border-white/60 dark:border-white/[0.08] p-4 shadow-neu flex flex-col h-full">
      <div className="flex items-center justify-between pb-2.5 border-b border-black/[0.06] dark:border-white/[0.06]">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Perpetual DEX Leaderboard</h2>
        <button
          type="button"
          onClick={onViewAll}
          className="flex items-center gap-0.5 text-xs font-medium text-sky-600 dark:text-sky-400 hover:text-sky-500 transition-colors"
        >
          View All
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      <div className="flex items-center gap-2 py-1.5 text-[0.59375rem] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-black/[0.04] dark:border-white/[0.04]">
        <div className="w-4 text-center shrink-0">#</div>
        <div className="flex-1 min-w-0">Protocol</div>
        <div className="w-[3.625rem] text-right shrink-0">24h Vol</div>
        <div className="w-[3.25rem] text-right shrink-0">OI</div>
        {showChange && <div className="w-[2.75rem] text-right shrink-0">24h %</div>}
      </div>

      <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04] flex-1">
        {!venues
          ? FEATURED_PERP_VENUES.map((v) => (
              <div key={v.key} className="flex items-center py-[0.6875rem]">
                <div className="h-3.5 w-full animate-pulse rounded bg-white/[0.05]" />
              </div>
            ))
          : venues.map((r, i) => {
              const up = (r.change1d ?? 0) >= 0;
              return (
                <div key={r.key} className="flex items-center gap-2 py-2 px-0.5 rounded-lg transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03] text-xs">
                  <div className="w-4 text-center mono text-[0.6875rem] text-zinc-500 shrink-0">{r.volume24h != null ? i + 1 : "-"}</div>
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <VenueLogo src={r.logo} name={r.name} />
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate text-xs">{r.name}</span>
                    </div>
                    {/* Share of the leader's 24h volume, from the same live feed. */}
                    <div className="mt-1 h-[0.1875rem] w-full overflow-hidden rounded-full bg-black/[0.05] dark:bg-white/[0.05]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-mint-500/70 to-gold-400/70"
                        style={{ width: `${r.volume24h != null ? Math.max(2, (r.volume24h / top) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-[3.625rem] text-right mono text-zinc-800 dark:text-zinc-200 font-medium text-[0.6875rem] shrink-0">
                    {compactUsd(r.volume24h)}
                  </div>
                  <div className="w-[3.25rem] text-right mono text-zinc-600 dark:text-zinc-400 text-[0.6875rem] shrink-0">
                    {compactUsd(r.openInterest)}
                  </div>
                  {showChange && (
                    <div
                      className={cn(
                        "w-[2.75rem] text-right mono font-semibold text-[0.6875rem] shrink-0",
                        r.change1d == null ? "text-zinc-500" : up ? "text-emerald-600 dark:text-mint-400" : "text-rose-600 dark:text-red-400"
                      )}
                    >
                      {pct(r.change1d, 1)}
                    </div>
                  )}
                </div>
              );
            })}
      </div>

      <p className="pt-2 text-[0.625rem] text-zinc-500">Live 24h volume and open interest via CoinGecko, Hyperliquid and DefiLlama.</p>
    </div>
  );
}
