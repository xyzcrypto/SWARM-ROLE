"use client";

import { ArrowRight } from "lucide-react";
import { platformLogo } from "@/lib/dex-registry";
import { cn } from "@/lib/utils";
import type { ProgramView } from "@modules/points/lib/programs";

interface FeaturedProgramsBarProps {
  programs: ProgramView[];
  activeId: string;
  onSelect: (id: string) => void;
  onViewAll?: () => void;
}

interface FeaturedItem {
  id: string;
  name: string;
  badge: "Official" | "Community";
  pointsLabel: string;
  allocLabel: string;
  tags: string[];
}

const FEATURED_ITEMS: FeaturedItem[] = [
  {
    id: "sodex",
    name: "Sodex",
    badge: "Official",
    pointsLabel: "27M Points",
    allocLabel: "15% Allocation",
    tags: ["Spot", "Perps", "RWA"],
  },
  {
    id: "risex",
    name: "RiseX",
    badge: "Community",
    pointsLabel: "12M Points",
    allocLabel: "10% Allocation",
    tags: ["Perps", "Options"],
  },
  {
    id: "variational",
    name: "Variational",
    badge: "Official",
    pointsLabel: "9.4M Points",
    allocLabel: "12% Allocation",
    tags: ["Options", "Perps", "Spot"],
  },
  {
    id: "hyperliquid",
    name: "Hyperliquid",
    badge: "Official",
    pointsLabel: "45M Points",
    allocLabel: "20% Allocation",
    tags: ["Perps", "Spot"],
  },
  {
    id: "lighter",
    name: "Lighter",
    badge: "Community",
    pointsLabel: "8.2M Points",
    allocLabel: "10% Allocation",
    tags: ["Perps", "Spot"],
  },
];

export function FeaturedProgramsBar({
  programs,
  activeId,
  onSelect,
  onViewAll,
}: FeaturedProgramsBarProps) {
  return (
    <div id="featured-programs" className="scroll-mt-32 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-content sm:text-2xl">
            Featured Programs
          </h2>
          <p className="text-xs text-content-muted sm:text-sm">
            Most popular airdrop programs with active point farming
          </p>
        </div>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="group flex items-center gap-1.5 text-xs font-semibold text-gold-400 transition-colors hover:text-gold-300"
          >
            View All Programs
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-active:translate-x-0.5" />
          </button>
        )}
      </div>

      {/* 5 Cards Grid */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
        {FEATURED_ITEMS.map((item) => {
          const prog = programs.find((p) => p.id === item.id);
          const isSelected = activeId === item.id;
          const logo = prog ? platformLogo({ links: prog.links, logo: prog.logo ?? undefined }) : null;

          return (
            <div
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={cn(
                "group relative flex flex-col justify-between rounded-2xl border p-4 text-left cursor-pointer transition-all duration-200",
                isSelected
                  ? "border-gold-500/60 bg-surface-2 shadow-lg shadow-gold-500/10 ring-1 ring-gold-500/40"
                  : "border-hairline bg-surface-2 hover:border-gold-500/30 hover:bg-base"
              )}
            >
              {/* Top Row: Logo, Name, Badge */}
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {logo ? (
                      <img src={logo} alt="" className="h-7 w-7 shrink-0 rounded-lg object-contain" />
                    ) : (
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/5 text-xs font-bold text-content">
                        {item.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <div>
                      <div className="font-display text-sm font-bold text-content group-hover:text-gold-200 transition-colors">
                        {item.name}
                      </div>
                    </div>
                  </div>

                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                      item.badge === "Official"
                        ? "border border-amber-500/30 bg-amber-500/10 text-amber-300"
                        : "border border-sky-500/30 bg-sky-500/10 text-sky-300"
                    )}
                  >
                    {item.badge}
                  </span>
                </div>

                {/* Farming Status Pill */}
                <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-content-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Farming Now</span>
                </div>

                {/* Numbers */}
                <div className="mt-3 space-y-0.5">
                  <div className="mono font-display text-base font-bold text-content">
                    {item.pointsLabel}
                  </div>
                  <div className="text-[11px] text-content-subtle">
                    {item.allocLabel}
                  </div>
                </div>

                {/* Category Tags */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-content-muted"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Bottom Calculate Action */}
              <div className="mt-4 pt-3 border-t border-hairline">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(item.id);
                  }}
                  className={cn(
                    "flex w-full items-center justify-center gap-1.5 rounded-xl border py-1.5 text-xs font-semibold transition-all",
                    isSelected
                      ? "border-gold-500/50 bg-gold-500/10 text-gold-300"
                      : "border-hairline bg-base text-content-muted group-hover:border-gold-500/30 group-hover:text-content"
                  )}
                >
                  Calculate
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
