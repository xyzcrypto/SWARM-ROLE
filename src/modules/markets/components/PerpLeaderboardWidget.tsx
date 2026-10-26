"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { pct, compactUsd, type PerpDex, type PerpMarket } from "@/lib/markets";
import { getPlatform, platformLogo } from "../lib/dex-registry";

interface PerpLeaderboardWidgetProps {
  dexs?: PerpDex[];
  markets?: PerpMarket[];
  onViewAll?: () => void;
}

/** Venues the owner asked to drop from the board, matched on slug or name. */
const EXCLUDED = /^(dydx|jupiter)/i;

/**
 * Newer perp DEXs the owner wants on the board even when they are not yet in
 * DefiLlama's top derivatives list. A venue that IS in the live list shows its
 * live volume; one that is not shows a dash, never an invented number.
 */
const FEATURED: { key: string; name: string; match: RegExp; href?: string; logo?: string | null }[] = [
  { key: "arcus", name: "Arcus", match: /^arcus\b/i, href: "/points", logo: platformLogo(getPlatform("arcus") ?? { links: {} }) },
  { key: "txflow", name: "TXFlow", match: /^tx\s?flow\b/i },
  { key: "risex", name: "RiseX", match: /^rise\s?x\b/i, href: "/points", logo: "/risex-logo.png" },
];

const LIVE_ROWS = 6;

type Row = {
  key: string;
  name: string;
  href?: string;
  logo: string | null;
  volume: number | null;
  change24h: number | null;
};

function ProtocolLogoImg({ src, name }: { src?: string | null; name: string }) {
  const [err, setErr] = React.useState(false);
  if (src && !err) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        loading="lazy"
        className="h-4 w-4 rounded-full ring-1 ring-black/10 dark:ring-white/10 shrink-0 object-contain bg-zinc-800"
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gold-500/10 text-[9px] font-bold text-amber-600 dark:text-gold-300 ring-1 ring-gold-500/30">
      {name[0]}
    </div>
  );
}

export function PerpLeaderboardWidget({ dexs, onViewAll }: PerpLeaderboardWidgetProps) {
  const { rows, top } = React.useMemo(() => {
    const live = (dexs ?? []).filter((d) => !EXCLUDED.test(d.slug || "") && !EXCLUDED.test(d.name || ""));
    const featuredHit = (d: PerpDex) => FEATURED.find((f) => f.match.test(d.name) || f.match.test(d.slug));

    const rows: Row[] = live
      .filter((d) => !featuredHit(d))
      .slice(0, LIVE_ROWS)
      .map((d) => ({
        key: d.slug || d.name,
        name: d.name,
        href: d.slug ? `/markets/protocol/derivatives/${d.slug}` : undefined,
        logo: d.logo,
        volume: d.volume24h,
        change24h: d.change1d,
      }));

    for (const f of FEATURED) {
      const hit = live.find((d) => f.match.test(d.name) || f.match.test(d.slug));
      rows.push({
        key: f.key,
        name: f.name,
        href: hit?.slug ? `/markets/protocol/derivatives/${hit.slug}` : f.href,
        logo: hit?.logo || f.logo || null,
        volume: hit ? hit.volume24h : null,
        change24h: hit ? hit.change1d : null,
      });
    }

    rows.sort((a, b) => (b.volume ?? -1) - (a.volume ?? -1));
    return { rows, top: Math.max(1, ...rows.map((r) => r.volume ?? 0)) };
  }, [dexs]);

  const loading = !dexs;

  return (
    <div className="neu-card rounded-2xl border border-white/60 dark:border-white/[0.08] p-4 shadow-neu flex flex-col h-full">
      {/* Header */}
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

      {/* Table Headers */}
      <div className="flex items-center gap-2 py-1.5 text-[9.5px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-black/[0.04] dark:border-white/[0.04]">
        <div className="w-4 text-center shrink-0">#</div>
        <div className="flex-1 min-w-0">Protocol</div>
        <div className="w-[60px] text-right shrink-0">24h Vol</div>
        <div className="w-[48px] text-right shrink-0">24h %</div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04] flex-1">
        {loading
          ? Array.from({ length: LIVE_ROWS + FEATURED.length }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 py-2">
                <div className="h-3 w-full animate-pulse rounded bg-white/[0.05]" />
              </div>
            ))
          : rows.map((r, i) => {
              const up = (r.change24h ?? 0) >= 0;
              const inner = (
                <>
                  <div className="w-4 text-center mono text-[11px] text-zinc-500 shrink-0">{r.volume != null ? i + 1 : "-"}</div>
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <ProtocolLogoImg src={r.logo} name={r.name} />
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors truncate text-xs">
                        {r.name}
                      </span>
                      {r.volume == null && (
                        <span className="shrink-0 rounded-full border border-gold-400/30 bg-gold-400/10 px-1.5 py-px text-[8.5px] font-semibold uppercase tracking-wide text-amber-700 dark:text-gold-300">
                          Not listed
                        </span>
                      )}
                    </div>
                    {/* Share of the board leader's volume - real, from the same feed. */}
                    <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-black/[0.05] dark:bg-white/[0.05]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-mint-500/70 to-gold-400/70"
                        style={{ width: `${r.volume != null ? Math.max(2, (r.volume / top) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-[60px] text-right mono text-zinc-800 dark:text-zinc-200 font-medium text-[11px] shrink-0">
                    {r.volume != null ? compactUsd(r.volume) : "-"}
                  </div>
                  <div
                    className={cn(
                      "w-[48px] text-right mono font-semibold text-[11px] shrink-0",
                      r.change24h == null
                        ? "text-zinc-500"
                        : up
                          ? "text-emerald-600 dark:text-mint-400"
                          : "text-rose-600 dark:text-red-400"
                    )}
                  >
                    {r.change24h != null ? pct(r.change24h, 1) : "-"}
                  </div>
                </>
              );
              const cls = "flex items-center gap-2 py-2 px-0.5 rounded-lg transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03] group text-xs";
              return r.href ? (
                <Link key={r.key} href={r.href} className={cls}>
                  {inner}
                </Link>
              ) : (
                <div key={r.key} className={cls}>
                  {inner}
                </div>
              );
            })}
      </div>

      <p className="pt-2 text-[10px] text-zinc-500">Live 24h volume via DefiLlama.</p>
    </div>
  );
}
