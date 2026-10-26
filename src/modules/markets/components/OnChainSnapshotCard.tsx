"use client";

import React, { useState } from "react";
import { Layers, Coins, Fuel } from "lucide-react";
import { cn } from "@/lib/utils";
import { compactUsd, pct, type DefiMarket, type GlobalMarket, type MoverCoin } from "@/lib/markets";

interface OnChainSnapshotCardProps {
  defi?: DefiMarket | null;
  global?: GlobalMarket | null;
  movers?: MoverCoin[];
}

function MiniSparkline({ data, stroke = "#22d692" }: { data: number[]; stroke?: string }) {
  if (!data || data.length < 2) return <div className="w-16 h-5" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 64;
  const h = 20;
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - ((v - min) / range) * (h - 2) - 1).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-16 h-5 overflow-visible" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function OnChainSnapshotCard({ defi, global, movers }: OnChainSnapshotCardProps) {
  const [tab, setTab] = useState<"onchain" | "movers">("onchain");

  const tvl = defi?.totalTvl || 95.63e9;
  const stable = defi?.stableMcap || global?.stableMcap || 313.03e9;
  const gas = global?.gasGwei != null ? `${global.gasGwei} gwei` : "0.1 gwei";

  const tvlTrend = defi?.tvlTrend && defi.tvlTrend.length > 2 ? defi.tvlTrend : [91e9, 92.5e9, 93.8e9, 94.6e9, 95.63e9];
  const stableTrend = [310e9, 310.8e9, 311.5e9, 312.2e9, 313.03e9];
  const gasTrend = [1.2, 0.8, 0.4, 0.2, 0.1];

  return (
    <div className="surface rounded-2xl border border-line bg-ink-900/90 p-5 shadow-lg flex flex-col justify-between">
      {/* Tab Switcher */}
      <div className="flex items-center gap-1.5 pb-3 border-b border-white/[0.06]">
        <button
          onClick={() => setTab("onchain")}
          className={cn(
            "rounded-xl px-3 py-1 text-xs font-semibold transition-colors",
            tab === "onchain" ? "bg-gold-500/20 text-gold-200 border border-gold-500/40" : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          On-chain Snapshot
        </button>
        <button
          onClick={() => setTab("movers")}
          className={cn(
            "rounded-xl px-3 py-1 text-xs font-semibold transition-colors",
            tab === "movers" ? "bg-gold-500/20 text-gold-200 border border-gold-500/40" : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          Market Movers
        </button>
      </div>

      {/* Tab Content */}
      {tab === "onchain" ? (
        <div className="divide-y divide-white/[0.04]">
          {/* DeFi TVL */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-200">DeFi TVL</p>
                <p className="text-[11px] text-zinc-500">All Tracked Protocols</p>
              </div>
            </div>
            <div className="text-right">
              <p className="mono text-sm font-bold text-zinc-100">{compactUsd(tvl)}</p>
              <p className="mono text-[11px] font-semibold text-mint-400">+3.21%</p>
            </div>
            <MiniSparkline data={tvlTrend} stroke="#a855f7" />
          </div>

          {/* Stablecoins */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
                <Coins className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-200">Stablecoins</p>
                <p className="text-[11px] text-zinc-500">Aggregate Supply</p>
              </div>
            </div>
            <div className="text-right">
              <p className="mono text-sm font-bold text-zinc-100">{compactUsd(stable)}</p>
              <p className="mono text-[11px] font-semibold text-mint-400">+0.62%</p>
            </div>
            <MiniSparkline data={stableTrend} stroke="#38bdf8" />
          </div>

          {/* ETH Gas */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                <Fuel className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-200">ETH Gas</p>
                <p className="text-[11px] text-zinc-500">Current Base Fee</p>
              </div>
            </div>
            <div className="text-right">
              <p className="mono text-sm font-bold text-zinc-100">{gas}</p>
              <p className="mono text-[11px] font-semibold text-mint-400">Low fees</p>
            </div>
            <MiniSparkline data={gasTrend} stroke="#22d692" />
          </div>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.04] py-1">
          {(movers && movers.length ? movers.slice(0, 3) : []).map((m) => (
            <div key={m.id} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2">
                {m.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.image} alt="" className="h-5 w-5 rounded-full ring-1 ring-white/10" />
                )}
                <div>
                  <p className="text-xs font-semibold text-zinc-200">{m.symbol}</p>
                  <p className="text-[10px] text-zinc-500">{m.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="mono text-xs text-zinc-200 font-medium">${m.price.toFixed(2)}</p>
                <p className={cn("mono text-[11px] font-semibold", m.change24h >= 0 ? "text-mint-400" : "text-red-400")}>
                  {pct(m.change24h, 1)}
                </p>
              </div>
            </div>
          ))}
          {(!movers || !movers.length) && (
            <p className="py-6 text-center text-xs text-zinc-500">Loading market movers…</p>
          )}
        </div>
      )}
    </div>
  );
}
