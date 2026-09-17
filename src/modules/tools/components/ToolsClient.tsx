"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Percent, Gift, AlertTriangle, Shield, TrendingUp, Sigma, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { FundingFeeCalculator } from "@/components/tools/FundingFeeCalculator";
import { LiquidationCalculator } from "@/components/tools/LiquidationCalculator";
import { PositionSizeCalculator } from "@/components/tools/PositionSizeCalculator";
import { PnlCalculator } from "@/components/tools/PnlCalculator";
import { BreakEvenCalculator } from "@/components/tools/BreakEvenCalculator";
import { CompoundingCalculator } from "@/components/tools/CompoundingCalculator";
import { DrawdownRecoveryCalculator } from "@/components/tools/DrawdownRecoveryCalculator";
import { AwardXpOnView } from "@/components/AwardXpOnView";

const TABS = [
  { id: "funding", label: "Funding Fee", icon: Percent, Panel: FundingFeeCalculator },
  { id: "liquidation", label: "Liquidation", icon: AlertTriangle, Panel: LiquidationCalculator },
  { id: "size", label: "Position Size", icon: Shield, Panel: PositionSizeCalculator },
  { id: "pnl", label: "PnL", icon: Percent, Panel: PnlCalculator },
  { id: "breakeven", label: "Break-Even", icon: Sigma, Panel: BreakEvenCalculator },
  { id: "compounding", label: "Compounding", icon: TrendingUp, Panel: CompoundingCalculator },
  { id: "recovery", label: "Drawdown Recovery", icon: ArrowDownRight, Panel: DrawdownRecoveryCalculator },
] as const;

const LAST_TAB_KEY = "xyz-tools-last-tab";

export function ToolsClient() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("funding");
  const { data: session } = useSession();
  const Active = TABS.find((t) => t.id === tab)?.Panel ?? FundingFeeCalculator;

  // Remember the last calculator used - a quick tab switch beats re-clicking
  // through the bar every visit, and there's no server round-trip involved.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_TAB_KEY);
      if (saved && TABS.some((t) => t.id === saved)) setTab(saved as (typeof TABS)[number]["id"]);
    } catch {
      /* ignore */
    }
  }, []);

  function pick(id: (typeof TABS)[number]["id"]) {
    setTab(id);
    try {
      localStorage.setItem(LAST_TAB_KEY, id);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-8">
      <AwardXpOnView action="tool_use" />
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="mx-auto flex w-max items-center gap-1.5 rounded-2xl border border-line bg-ink-950/50 p-1.5 sm:w-full sm:flex-wrap sm:justify-center">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => pick(t.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors",
                  active ? "bg-gold-500/15 text-gold-100 ring-1 ring-gold-500/30" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="surface rounded-4xl p-6 sm:p-8">
        <Active />
      </div>

      {/* The Points Value calculator used to be a tab here. It outgrew a tab -
          it now has live comparables, a cost basis and a sensitivity grid - so
          it lives at /points. This signpost stays permanently: anyone who
          learned where it was will come back looking for it here. */}
      <Link
        href="/points"
        className="surface surface-hover lift group flex flex-col items-center gap-3 rounded-3xl p-7 text-center sm:flex-row sm:justify-between sm:text-left"
      >
        <div className="flex items-start gap-3.5">
          <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-500/10 text-gold-200 transition-transform group-hover:scale-105 group-active:scale-105">
            <Gift className="h-5 w-5" strokeWidth={1.7} />
          </span>
          <div>
            <h3 className="font-display text-lg font-semibold text-zinc-50">Points and airdrop value</h3>
            <p className="mt-1 text-sm text-zinc-400">
              Moved to its own section, with live peer comparables, cost basis and break-even.
            </p>
          </div>
        </div>
        <span className="btn-secondary shrink-0">Open Points</span>
      </Link>

      <div className="surface surface-hover lift flex flex-col items-center gap-3 rounded-3xl p-7 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <h3 className="font-display text-lg font-semibold text-zinc-50">Want to track every trade?</h3>
          <p className="mt-1 text-sm text-zinc-400">The Trading Journal logs your trades and calculates your real performance automatically.</p>
        </div>
        <Link href={session ? "/journal" : "/login?callbackUrl=/journal"} className="btn-gold shrink-0">
          {session ? "Open Journal" : "Log in to track your trades"}
        </Link>
      </div>
    </div>
  );
}
