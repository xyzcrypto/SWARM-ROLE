"use client";

import { useEffect, useRef, useState } from "react";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { PerpChartLazy as PerpChart } from "./PerpChartLazy";
import { compactUsd, pct, fngLabel, type GlobalMarket, type DefiMarket } from "@/lib/markets";
import { cn } from "@/lib/utils";

// Visibility-gated poller (same pattern as MarketTicker/PerpChart): fetch now,
// then on an interval only while the tab is visible, catching up on return.
function usePolledJson<T>(url: string, everyMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error("bad status");
        const j = await res.json();
        if (!active) return;
        setData(j);
        setLive(Boolean(j.live));
      } catch {
        if (active) setLive(false);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    const t = setInterval(() => {
      if (!document.hidden) load();
    }, everyMs);
    const onVis = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      active = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [url, everyMs]);
  return { data, live, loading };
}

type GlobalResp = GlobalMarket & { live: boolean };
type DefiResp = DefiMarket & { live: boolean };

export function MarketsClient() {
  const g = usePolledJson<GlobalResp>("/api/markets/global", 60_000);
  const d = usePolledJson<DefiResp>("/api/markets/defi", 120_000);
  const anyLive = g.live || d.live;

  return (
    <div className="space-y-8">
      {/* Status line */}
      <div className="flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
        <span className="relative flex h-2 w-2">
          {anyLive && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-400 opacity-70" />}
          <span className={cn("relative inline-flex h-2 w-2 rounded-full", anyLive ? "bg-mint-400" : "bg-amber-400")} />
        </span>
        <span className="mono">{anyLive ? "Live market data" : "Cached snapshot"}</span>
      </div>

      {/* Global KPI tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Total Market Cap" value={compactUsd(g.data?.marketCap)} sub={g.data ? pct(g.data.mcapChange24h) : "—"} subTone={(g.data?.mcapChange24h ?? 0) >= 0 ? "up" : "down"} loading={g.loading} />
        <Tile label="24h Volume" value={compactUsd(g.data?.volume24h)} loading={g.loading} />
        <Tile label="BTC Dominance" value={g.data ? `${g.data.btcDominance.toFixed(1)}%` : "—"} sub={g.data ? `ETH ${g.data.ethDominance.toFixed(1)}%` : undefined} loading={g.loading} />
        <FearGreedTile fg={g.data?.fearGreed ?? null} loading={g.loading} />
      </div>

      {/* Optional CMC enrichment */}
      {(g.data?.defiMcap || g.data?.stableMcap) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {g.data?.defiMcap ? <Tile label="DeFi Market Cap" value={compactUsd(g.data.defiMcap)} accent="mint" /> : null}
          {g.data?.stableMcap ? <Tile label="Stablecoin Market Cap" value={compactUsd(g.data.stableMcap)} accent="gold" /> : null}
        </div>
      )}

      {/* DeFi section */}
      <section className="grid gap-6 lg:grid-cols-3">
        {/* Total TVL + sparkline */}
        <div className="surface lift rounded-2xl p-5 lg:col-span-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Total DeFi TVL</p>
          <p className="mono mt-1.5 text-2xl font-bold text-mint-gradient">{compactUsd(d.data?.totalTvl)}</p>
          <Sparkline data={d.data?.tvlTrend ?? []} />
          <p className="mt-2 text-[11px] text-zinc-600">Stablecoins: {compactUsd(d.data?.stableMcap)}</p>
        </div>

        {/* Top protocols */}
        <div className="surface rounded-2xl p-5 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-gold-300" />
            <p className="text-sm font-semibold text-zinc-100">Top DeFi Protocols</p>
          </div>
          {d.loading && !d.data ? (
            <SkeletonRows />
          ) : (
            <div className="divide-y divide-white/5">
              {(d.data?.topProtocols ?? []).map((p, i) => (
                <div key={p.name} className="flex items-center gap-3 py-2">
                  <span className="mono w-4 shrink-0 text-[11px] text-zinc-600">{i + 1}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.logo && <img src={p.logo} alt="" width={20} height={20} loading="lazy" className="h-5 w-5 rounded-full ring-1 ring-white/10" onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")} />}
                  <span className="flex-1 truncate text-sm text-zinc-200">{p.name}</span>
                  <span className="hidden shrink-0 text-[11px] text-zinc-500 sm:inline">{p.chain}</span>
                  <span className="mono w-20 shrink-0 text-right text-sm text-zinc-300">{compactUsd(p.tvl)}</span>
                  <span className={cn("mono w-16 shrink-0 text-right text-[11px]", p.change1d >= 0 ? "text-mint-400" : "text-red-400")}>{pct(p.change1d, 1)}</span>
                </div>
              ))}
              {!d.loading && !(d.data?.topProtocols ?? []).length && (
                <p className="py-4 text-center text-sm text-zinc-500">Protocol data is loading…</p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Top chains */}
      <section className="surface rounded-2xl p-5">
        <p className="mb-3 text-sm font-semibold text-zinc-100">Top Chains by TVL</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(d.data?.topChains ?? []).slice(0, 8).map((c) => (
            <div key={c.name} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
              <span className="truncate text-sm text-zinc-300">{c.name}</span>
              <span className="mono text-xs text-zinc-400">{compactUsd(c.tvl)}</span>
            </div>
          ))}
          {!d.loading && !(d.data?.topChains ?? []).length && (
            <p className="col-span-full py-2 text-center text-sm text-zinc-500">Chain data is loading…</p>
          )}
        </div>
      </section>

      {/* Featured charts */}
      <section className="grid gap-6 lg:grid-cols-2">
        <PerpChart coin={{ id: "bitcoin", symbol: "BTC", base: 64000 }} />
        <PerpChart coin={{ id: "ethereum", symbol: "ETH", base: 3400 }} />
      </section>

      <p className="text-center text-[11px] text-zinc-600">
        Data: CoinGecko · DefiLlama · alternative.me. Not financial advice.
      </p>
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  subTone,
  accent,
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  subTone?: "up" | "down";
  accent?: "mint" | "gold";
  loading?: boolean;
}) {
  return (
    <div className="surface lift rounded-2xl p-5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p
        className={cn(
          "mono mt-1.5 text-2xl font-bold",
          accent === "mint" ? "text-mint-gradient" : accent === "gold" ? "text-gold-gradient" : "text-zinc-50",
          loading && "animate-pulse text-zinc-600"
        )}
      >
        {loading ? "…" : value}
      </p>
      {sub && (
        <p className={cn("mono mt-1 inline-flex items-center gap-1 text-[11px]", subTone === "up" ? "text-mint-400" : subTone === "down" ? "text-red-400" : "text-zinc-500")}>
          {subTone === "up" ? <TrendingUp className="h-3 w-3" /> : subTone === "down" ? <TrendingDown className="h-3 w-3" /> : null}
          {sub}
        </p>
      )}
    </div>
  );
}

function FearGreedTile({ fg, loading }: { fg: { value: number; label: string } | null; loading?: boolean }) {
  const v = fg?.value ?? 50;
  const { label, tone } = fngLabel(v);
  const barColor = tone === "red" ? "bg-red-400" : tone === "amber" ? "bg-amber-400" : "bg-mint-400";
  const textColor = tone === "red" ? "text-red-300" : tone === "amber" ? "text-amber-300" : "text-mint-300";
  return (
    <div className="surface lift rounded-2xl p-5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Fear & Greed</p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className={cn("mono text-2xl font-bold", loading ? "animate-pulse text-zinc-600" : textColor)}>{loading ? "…" : v}</span>
        {!loading && <span className={cn("text-xs font-medium", textColor)}>{fg?.label || label}</span>}
      </div>
      {/* 0–100 gauge track with a marker */}
      <div className="relative mt-3 h-1.5 rounded-full bg-gradient-to-r from-red-500/50 via-amber-400/50 to-mint-500/50">
        <span
          className={cn("absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full ring-2 ring-ink-950", barColor)}
          style={{ left: `calc(${Math.max(0, Math.min(100, v))}% - 6px)` }}
        />
      </div>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) return <div className="mt-3 h-10" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 100;
  const h = 32;
  const pts = data
    .map((v, i) => `${((i / (data.length - 1)) * w).toFixed(2)},${(h - ((v - min) / range) * h).toFixed(2)}`)
    .join(" ");
  const up = data[data.length - 1] >= data[0];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-3 h-10 w-full" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={up ? "var(--chart-mint)" : "var(--chart-gold)"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-8 animate-pulse rounded-lg bg-white/5" />
      ))}
    </div>
  );
}
