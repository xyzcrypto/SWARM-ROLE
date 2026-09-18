"use client";

import { ArrowRight, Coins, DollarSign, Layers, TrendingUp, Wallet } from "lucide-react";
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
  {
    id: "hyperliquid",
    name: "Hyperliquid",
    points: "3.1M",
    estValue: "$2,800",
    cost: "$600",
    roi: "+367%",
    status: "Farming",
  },
  {
    id: "lighter",
    name: "Lighter",
    points: "0.9M",
    estValue: "$820",
    cost: "$300",
    roi: "+173%",
    status: "Farming",
  },
];

export function MyAirdropsCard({ programs, activeId, onSelect }: MyAirdropsCardProps) {
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

        <button
          type="button"
          onClick={() => {
            const el = document.getElementById("featured-programs");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
          className="group flex items-center gap-1.5 text-xs font-semibold text-gold-400 hover:text-gold-300 transition-colors"
        >
          View Portfolio
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-active:translate-x-0.5" />
        </button>
      </div>

      {/* 4 Mini Metric Cards */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {/* Total Portfolio Value */}
        <div className="rounded-xl border border-hairline bg-base p-2.5">
          <div className="flex items-center gap-1.5 text-content-subtle">
            <Wallet className="h-3.5 w-3.5 text-gold-400" />
            <span className="text-[10px] uppercase font-medium">Total Portfolio Value</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="mono text-base font-bold text-content">$8,420</span>
            <span className="text-[10px] font-semibold text-emerald-400">+12.4%</span>
          </div>
        </div>

        {/* Total Points */}
        <div className="rounded-xl border border-hairline bg-base p-2.5">
          <div className="flex items-center gap-1.5 text-content-subtle">
            <Coins className="h-3.5 w-3.5 text-gold-400" />
            <span className="text-[10px] uppercase font-medium">Total Points</span>
          </div>
          <div className="mt-1">
            <span className="mono text-base font-bold text-content">12.4M</span>
          </div>
        </div>

        {/* Active Farms */}
        <div className="rounded-xl border border-hairline bg-base p-2.5">
          <div className="flex items-center gap-1.5 text-content-subtle">
            <Layers className="h-3.5 w-3.5 text-gold-400" />
            <span className="text-[10px] uppercase font-medium">Active Farms</span>
          </div>
          <div className="mt-1">
            <span className="font-display text-base font-bold text-content">7</span>
          </div>
        </div>

        {/* Farming Cost */}
        <div className="rounded-xl border border-hairline bg-base p-2.5">
          <div className="flex items-center gap-1.5 text-content-subtle">
            <DollarSign className="h-3.5 w-3.5 text-gold-400" />
            <span className="text-[10px] uppercase font-medium">Farming Cost</span>
          </div>
          <div className="mt-1">
            <span className="mono text-base font-bold text-content">$3,240</span>
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
                  <td className="py-2.5 mono font-semibold text-emerald-400">{row.roi}</td>
                  <td className="py-2.5 text-right">
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
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
  );
}
