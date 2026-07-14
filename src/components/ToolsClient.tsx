"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Percent, Gift, AlertTriangle, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { FundingFeeCalculator } from "./tools/FundingFeeCalculator";
import { PointsValueCalculator } from "./tools/PointsValueCalculator";
import { LiquidationCalculator } from "./tools/LiquidationCalculator";
import { PositionSizeCalculator } from "./tools/PositionSizeCalculator";
import { PnlCalculator } from "./tools/PnlCalculator";

const TABS = [
  { id: "funding", label: "Funding Fee", icon: Percent, Panel: FundingFeeCalculator },
  { id: "points", label: "Points Value", icon: Gift, Panel: PointsValueCalculator },
  { id: "liquidation", label: "Liquidation", icon: AlertTriangle, Panel: LiquidationCalculator },
  { id: "size", label: "Position Size", icon: Shield, Panel: PositionSizeCalculator },
  { id: "pnl", label: "PnL", icon: Percent, Panel: PnlCalculator },
] as const;

export function ToolsClient() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("funding");
  const { data: session } = useSession();
  const Active = TABS.find((t) => t.id === tab)?.Panel ?? FundingFeeCalculator;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-line bg-ink-950/50 p-1.5">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors",
                active ? "bg-gold-500/15 text-gold-100 ring-1 ring-gold-500/30" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
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
