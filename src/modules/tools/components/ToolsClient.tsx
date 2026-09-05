"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Percent, Gift, AlertTriangle, Shield, TrendingUp, Sigma, ArrowDownRight } from "lucide-react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { AwardXpOnView } from "@/components/AwardXpOnView";

const FallbackPanel = () => <div className="h-64 animate-pulse rounded-2xl bg-white/[0.02]" />;

const FundingFeeCalculator = dynamic(() => import("@/components/tools/FundingFeeCalculator").then((m) => m.FundingFeeCalculator), { ssr: false, loading: FallbackPanel });
const PointsValueCalculator = dynamic(() => import("@/components/tools/PointsValueCalculator").then((m) => m.PointsValueCalculator), { ssr: false, loading: FallbackPanel });
const LiquidationCalculator = dynamic(() => import("@/components/tools/LiquidationCalculator").then((m) => m.LiquidationCalculator), { ssr: false, loading: FallbackPanel });
const PositionSizeCalculator = dynamic(() => import("@/components/tools/PositionSizeCalculator").then((m) => m.PositionSizeCalculator), { ssr: false, loading: FallbackPanel });
const PnlCalculator = dynamic(() => import("@/components/tools/PnlCalculator").then((m) => m.PnlCalculator), { ssr: false, loading: FallbackPanel });
const BreakEvenCalculator = dynamic(() => import("@/components/tools/BreakEvenCalculator").then((m) => m.BreakEvenCalculator), { ssr: false, loading: FallbackPanel });
const CompoundingCalculator = dynamic(() => import("@/components/tools/CompoundingCalculator").then((m) => m.CompoundingCalculator), { ssr: false, loading: FallbackPanel });
const DrawdownRecoveryCalculator = dynamic(() => import("@/components/tools/DrawdownRecoveryCalculator").then((m) => m.DrawdownRecoveryCalculator), { ssr: false, loading: FallbackPanel });

const TABS = [
  { id: "funding", label: "Funding Fee", icon: Percent, Panel: FundingFeeCalculator },
  { id: "points", label: "Points Value", icon: Gift, Panel: PointsValueCalculator },
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
