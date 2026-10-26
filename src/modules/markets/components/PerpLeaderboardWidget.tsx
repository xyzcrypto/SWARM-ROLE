"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { pct, compactUsd, type PerpDex, type PerpMarket } from "@/lib/markets";

interface PerpLeaderboardWidgetProps {
  dexs?: PerpDex[];
  markets?: PerpMarket[];
  onViewAll?: () => void;
}

const PROTOCOL_LOGOS: Record<string, string> = {
  lighter: "https://icons.llamao.fi/icons/protocols/lighter",
  variational: "https://icons.llamao.fi/icons/protocols/variational",
  hyperliquid: "https://assets.coingecko.com/coins/images/50882/small/hyperliquid.jpg",
  jupiter: "https://assets.coingecko.com/coins/images/34188/small/jup.png",
  "jupiter-perpetuals": "https://assets.coingecko.com/coins/images/34188/small/jup.png",
  dydx: "https://assets.coingecko.com/coins/images/17500/small/hjnIm9bV.jpg",
};

const defaultProtocols = [
  { rank: 1, name: "Hyperliquid", slug: "hyperliquid", volume: 18.2e9, oi: 4.2e9, funding: 0.00012, change24h: 8.2, logo: PROTOCOL_LOGOS.hyperliquid },
  { rank: 2, name: "Lighter", slug: "lighter", volume: 7.8e9, oi: 1.8e9, funding: 0.00009, change24h: 12.4, logo: PROTOCOL_LOGOS.lighter, customBadge: { letter: "L", bg: "bg-amber-500/20 text-amber-300 ring-amber-400/40" } },
  { rank: 3, name: "Variational", slug: "variational", volume: 4.2e9, oi: 920e6, funding: 0.00014, change24h: 6.8, logo: PROTOCOL_LOGOS.variational, customBadge: { letter: "V", bg: "bg-purple-500/20 text-purple-300 ring-purple-400/40" } },
  { rank: 4, name: "Jupiter", slug: "jupiter-perpetuals", volume: 2.9e9, oi: 620e6, funding: 0.00010, change24h: 4.2, logo: PROTOCOL_LOGOS["jupiter-perpetuals"] },
  { rank: 5, name: "dYdX", slug: "dydx", volume: 2.1e9, oi: 580e6, funding: 0.00011, change24h: 3.1, logo: PROTOCOL_LOGOS.dydx },
];

function fmtCompact(n: number | null | undefined): string {
  return compactUsd(n);
}

function ProtocolLogoImg({
  src,
  name,
  customBadge,
}: {
  src?: string | null;
  name: string;
  customBadge?: { letter: string; bg: string };
}) {
  const [err, setErr] = React.useState(false);
  const resolvedSrc = !err ? src || PROTOCOL_LOGOS[name.toLowerCase()] : null;

  if (resolvedSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolvedSrc}
        alt={name}
        className="h-4 w-4 rounded-full ring-1 ring-black/10 dark:ring-white/10 shrink-0 object-contain bg-zinc-800"
        onError={() => setErr(true)}
      />
    );
  }

  if (customBadge) {
    return (
      <div className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-1 text-[9px] font-black", customBadge.bg)}>
        {customBadge.letter}
      </div>
    );
  }

  return (
    <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gold-500/10 text-[9px] font-bold text-amber-600 dark:text-gold-300 ring-1 ring-gold-500/30">
      {name[0]}
    </div>
  );
}

export function PerpLeaderboardWidget({ dexs, onViewAll }: PerpLeaderboardWidgetProps) {
  const rows = React.useMemo(() => {
    if (dexs && dexs.length >= 3) {
      return dexs.slice(0, 5).map((d, i) => {
        const def = defaultProtocols[i] || defaultProtocols[0];
        const slugKey = (d.slug || d.name || "").toLowerCase();
        return {
          rank: i + 1,
          name: d.name,
          slug: d.slug,
          volume: d.volume24h || def.volume,
          oi: def.oi,
          funding: def.funding,
          change24h: d.change1d || def.change24h,
          logo: d.logo || PROTOCOL_LOGOS[slugKey] || def.logo,
          customBadge: def.customBadge,
        };
      });
    }
    return defaultProtocols;
  }, [dexs]);

  return (
    <div className="neu-card rounded-2xl border border-white/60 dark:border-white/[0.08] p-4 shadow-neu flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-black/[0.06] dark:border-white/[0.06]">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Perpetual DEX Leaderboard</h2>
        <button
          onClick={onViewAll}
          className="flex items-center gap-0.5 text-xs font-medium text-sky-600 dark:text-sky-400 hover:text-sky-500 transition-colors"
        >
          View All
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {/* Table Headers */}
      <div className="flex items-center gap-1 py-1.5 text-[9.5px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-black/[0.04] dark:border-white/[0.04]">
        <div className="w-4 text-center shrink-0">#</div>
        <div className="flex-1 min-w-0">Protocol</div>
        <div className="w-[52px] text-right shrink-0">Volume</div>
        <div className="w-[36px] text-right shrink-0 hidden sm:block">OI</div>
        <div className="w-[42px] text-right shrink-0 hidden sm:block">Funding</div>
        <div className="w-[42px] sm:w-[38px] text-right shrink-0">24h %</div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04] flex-1">
        {rows.map((r) => {
          const up = r.change24h >= 0;
          return (
            <Link
              key={r.name}
              href={r.slug ? `/markets/protocol/derivatives/${r.slug}` : "/markets"}
              className="flex items-center gap-1 py-2 px-0.5 rounded-lg transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03] group text-xs"
            >
              <div className="w-4 text-center mono text-[11px] text-zinc-500 dark:text-zinc-500 shrink-0">
                {r.rank}
              </div>
              <div className="flex-1 flex items-center gap-1.5 min-w-0 pr-1">
                <ProtocolLogoImg src={r.logo} name={r.name} customBadge={r.customBadge} />
                <span className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors truncate text-xs">
                  {r.name}
                </span>
              </div>
              <div className="w-[52px] text-right mono text-zinc-800 dark:text-zinc-200 font-medium text-[11px] shrink-0">
                {fmtCompact(r.volume)}
              </div>
              <div className="w-[36px] text-right mono text-zinc-600 dark:text-zinc-400 text-[11px] shrink-0 hidden sm:block">
                {fmtCompact(r.oi)}
              </div>
              <div className="w-[42px] text-right mono text-zinc-600 dark:text-zinc-400 text-[11px] shrink-0 hidden sm:block">
                {(r.funding * 100).toFixed(3)}%
              </div>
              <div
                className={cn(
                  "w-[42px] sm:w-[38px] text-right mono font-semibold text-[11px] shrink-0",
                  up ? "text-emerald-600 dark:text-mint-400" : "text-rose-600 dark:text-red-400"
                )}
              >
                {pct(r.change24h, 1)}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
