"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Coins, DollarSign, Layers, Lock, Sparkles, Wallet } from "lucide-react";
import { platformLogo } from "@/lib/dex-registry";
import { cn } from "@/lib/utils";
import type { ProgramView } from "@modules/points/lib/programs";

interface MyAirdropsCardProps {
  programs: ProgramView[];
  activeId: string;
  onSelect: (id: string) => void;
}

interface PortfolioRow {
  id: string;
  name: string;
  points: string;
  estValue: string;
  cost: string;
  roi: string;
  status: string;
}

const PORTFOLIO_DATA: PortfolioRow[] = [
  {
    id: "sodex",
    name: "Sodex",
    points: "2.4M",
    estValue: "$2,100",
    cost: "$800",
    roi: "+162%",
    status: "Farming",
  },
  {
    id: "risex",
    name: "RiseX",
    points: "1.8M",
    estValue: "$1,450",
    cost: "$600",
    roi: "+142%",
    status: "Farming",
  },
  {
    id: "variational",
    name: "Variational",
    points: "4.2M",
    estValue: "$4,300",
    cost: "$1,200",
    roi: "+258%",
    status: "Farming",
  },
];

export function MyAirdropsCard({ programs, activeId, onSelect }: MyAirdropsCardProps) {
  const summary = useMemo(() => {
    return {
      totalVal: "$7,850",
      growth: "+14.2%",
      totalPts: "8.4M",
      activeFarms: PORTFOLIO_DATA.length,
      farmingCost: "$2,600",
    };
  }, []);

  return (
    <div id="my-airdrops" className="scroll-mt-32 flex flex-col justify-between rounded-2xl border border-hairline bg-surface-2 p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-hairline">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-content sm:text-xl">
            My Airdrops
          </h2>
          <p className="text-xs text-content-muted">
            Track all your farming positions in one place
          </p>
        </div>

        <Link
          href="/portfolio"
          className="group flex items-center gap-1.5 text-xs font-semibold text-gold-400 hover:text-gold-300 transition-colors"
        >
          View Portfolio
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-active:translate-x-0.5" />
        </Link>
      </div>

      {/* ── Coming soon ──────────────────────────────────────────────────
          Everything below this point is a MOCKUP, and it has to say so.

          ⚠️ The numbers here are hard-coded: "Sodex · 2.4M points · $2,100 ·
          +162% ROI" under a heading that reads "My Airdrops". Nothing fetches
          them and no wallet is connected - they are the same for every visitor,
          including one who has never farmed anything. Presented sharp and
          unlabelled, that is a reader being shown a portfolio they do not have,
          and the first thing they would do is act on it.

          Blurring it is not decoration, it is the honesty fix: the shape of the
          feature stays legible, the figures stop being readable, and the badge
          says plainly that it is not live yet. It also does the thing that was
          asked for, which is to make the page feel like something substantial
          is coming. `select-none` and `aria-hidden` keep the fake numbers out
          of copy-paste and out of a screen reader. */}
      <div className="relative mt-4">
        <div
          aria-hidden="true"
          // A stable hook for the check that this is genuinely blurred.
          // ⚠️ `aria-hidden` alone is NOT a selector for it: lucide puts
          // `aria-hidden="true"` on every icon it renders, so the arrow in the
          // header above matches first and a probe measuring "the hidden
          // element" measures an SVG with no filter and reports a pass.
          data-mock="portfolio"
          className="pointer-events-none select-none blur-[7px] saturate-[0.85]"
        >

      {/* 4 Mini Metric Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {/* Total Portfolio Value */}
        <div className="rounded-xl border border-hairline bg-base p-2.5">
          <div className="flex items-center gap-1.5 text-content-subtle">
            <Wallet className="h-3.5 w-3.5 text-gold-400" />
            <span className="text-[10px] uppercase font-medium">Total Portfolio Value</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="mono text-[15px] font-bold text-content">{summary.totalVal}</span>
            <span className="text-[10px] font-semibold text-mint-400">{summary.growth}</span>
          </div>
        </div>

        {/* Total Points */}
        <div className="rounded-xl border border-hairline bg-base p-2.5">
          <div className="flex items-center gap-1.5 text-content-subtle">
            <Coins className="h-3.5 w-3.5 text-gold-400" />
            <span className="text-[10px] uppercase font-medium">Total Points</span>
          </div>
          <div className="mt-1">
            <span className="mono text-[15px] font-bold text-content">{summary.totalPts}</span>
          </div>
        </div>

        {/* Active Farms */}
        <div className="rounded-xl border border-hairline bg-base p-2.5">
          <div className="flex items-center gap-1.5 text-content-subtle">
            <Layers className="h-3.5 w-3.5 text-gold-400" />
            <span className="text-[10px] uppercase font-medium">Active Farms</span>
          </div>
          <div className="mt-1">
            <span className="font-display text-[15px] font-bold text-content">{summary.activeFarms}</span>
          </div>
        </div>

        {/* Farming Cost */}
        <div className="rounded-xl border border-hairline bg-base p-2.5">
          <div className="flex items-center gap-1.5 text-content-subtle">
            <DollarSign className="h-3.5 w-3.5 text-gold-400" />
            <span className="text-[10px] uppercase font-medium">Farming Cost</span>
          </div>
          <div className="mt-1">
            <span className="mono text-[15px] font-bold text-content">{summary.farmingCost}</span>
          </div>
        </div>
      </div>

      {/* Positions Table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-hairline text-content-subtle text-[11px]">
              <th className="pb-2 font-medium">Protocol</th>
              <th className="pb-2 font-medium mono">Points</th>
              <th className="pb-2 font-medium mono">Est. Value</th>
              <th className="pb-2 font-medium mono">Cost</th>
              <th className="pb-2 font-medium mono">ROI</th>
              <th className="pb-2 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {PORTFOLIO_DATA.map((row) => {
              const prog = programs.find((p) => p.id === row.id);
              const logo = prog ? platformLogo({ links: prog.links, logo: prog.logo ?? undefined }) : null;
              const isSelected = activeId === row.id;

              return (
                <tr
                  key={row.id}
                  onClick={() => onSelect(row.id)}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-white/5",
                    isSelected && "bg-gold-500/10"
                  )}
                >
                  <td className="py-2.5 flex items-center gap-2">
                    {logo ? (
                      <img src={logo} alt="" className="h-5 w-5 rounded-md object-contain" />
                    ) : (
                      <span className="grid h-5 w-5 place-items-center rounded-md bg-white/5 text-[9px] font-bold text-content">
                        {row.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <span className="font-semibold text-content">{row.name}</span>
                  </td>
                  <td className="py-2.5 mono text-content-muted">{row.points}</td>
                  <td className="py-2.5 mono font-semibold text-gold-200">{row.estValue}</td>
                  <td className="py-2.5 mono text-content-muted">{row.cost}</td>
                  <td className="py-2.5 mono font-semibold text-mint-400">{row.roi}</td>
                  <td className="py-2.5 text-right">
                    <span className="inline-flex items-center rounded-full bg-mint-500/10 px-2 py-0.5 text-[10px] font-semibold text-mint-300">
                      {row.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

        </div>

        {/* The overlay. Deliberately the loudest thing in the card: the point is
            that a reader should feel something substantial is coming, not
            squint at a disclaimer. */}
        <div className="absolute inset-0 grid place-items-center rounded-xl bg-gradient-to-b from-ink-950/40 via-ink-950/75 to-ink-950/95 px-4 text-center">
          <div className="animate-rise-in">
            <span className="relative inline-flex">
              {/* The breathing ring is the one live-feeling element, and it is
                  earned - it is saying "being built", not decorating. */}
              <span className="absolute inset-0 animate-glow-breathe rounded-2xl bg-gold-500/20 blur-md" />
              <span className="relative grid h-12 w-12 place-items-center rounded-2xl border border-gold-500/30 bg-gold-500/10 text-gold-200">
                <Lock className="h-5 w-5" strokeWidth={1.8} />
              </span>
            </span>

            <p className="mt-3 font-display text-base font-bold tracking-tight text-content sm:text-lg">
              Portfolio tracking is <span className="text-shine">coming soon</span>
            </p>
            <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-content-muted">
              Connect once and every farm you run shows up here with its real cost basis, live
              value and break-even. The figures behind this blur are a mockup, not yours.
            </p>

            <span className="mono mt-3 inline-flex items-center gap-1.5 rounded-full border border-gold-500/25 bg-gold-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-200">
              <Sparkles className="h-3 w-3" strokeWidth={2} />
              In build
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
