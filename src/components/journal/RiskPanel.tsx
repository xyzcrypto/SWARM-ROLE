"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { deriveStatus } from "@/lib/journal";
import {
  plannedRiskPct,
  plannedRiskUsd,
  ruleAdherenceScore,
  safeModeActive,
  scanBreaches,
  type RiskProfile,
} from "@/lib/risk";
import { CalcField } from "@/components/tools/CalcField";
import type { SerializedTrade } from "./JournalClient";

export type SerializedRiskProfile = RiskProfile | null;

const FIELDS: { key: keyof RiskProfile; label: string; suffix: string }[] = [
  { key: "accountEquity", label: "Account equity", suffix: "USD" },
  { key: "maxRiskPerTradePct", label: "Max risk per trade", suffix: "%" },
  { key: "maxDailyLossPct", label: "Max daily loss", suffix: "%" },
  { key: "maxWeeklyDrawdownPct", label: "Max weekly drawdown", suffix: "%" },
  { key: "maxOpenRiskPct", label: "Max total open risk", suffix: "%" },
  { key: "maxLeverage", label: "Max leverage warning", suffix: "x" },
  { key: "maxTradesPerDay", label: "Max trades per day", suffix: "" },
  { key: "revengeCooldownMinutes", label: "Revenge-trade cooldown", suffix: "min" },
];

function toFormState(p: SerializedRiskProfile): Record<string, string> {
  const state: Record<string, string> = {};
  for (const f of FIELDS) state[f.key] = p?.[f.key] != null ? String(p[f.key]) : "";
  return state;
}

export function RiskPanel({ trades, initialProfile }: { trades: SerializedTrade[]; initialProfile: SerializedRiskProfile }) {
  const [profile, setProfile] = useState(initialProfile);
  const [form, setForm] = useState(() => toFormState(initialProfile));
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(!initialProfile);

  const riskTrades = useMemo(
    () => trades.map((t) => ({ id: t.id, side: t.side, symbol: t.symbol, leverage: t.leverage, stopLoss: t.stopLoss, fills: t.fills })),
    [trades]
  );
  const now = useMemo(() => new Date(), []);
  const breaches = useMemo(() => (profile ? scanBreaches(riskTrades, profile, now) : []), [riskTrades, profile, now]);
  const score = useMemo(() => ruleAdherenceScore(breaches), [breaches]);
  const inSafeMode = useMemo(() => safeModeActive(riskTrades), [riskTrades]);
  const openTrades = useMemo(() => trades.filter((t) => deriveStatus(t.fills) === "open"), [trades]);

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, number | null> = {};
      for (const f of FIELDS) {
        const raw = form[f.key];
        body[f.key] = raw === "" ? null : Number(raw);
      }
      const res = await fetch("/api/journal/risk-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (res.ok) {
        setProfile(j.profile);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      {inSafeMode && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/[0.06] px-5 py-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
          <div>
            <p className="text-sm font-semibold text-rose-200">Safe mode - 3+ losses in a row</p>
            <p className="mt-1 text-xs text-rose-300/80">Consider sizing down or stepping away until you&apos;ve reviewed what happened.</p>
          </div>
        </div>
      )}

      {profile && !editing ? (
        <div className="surface rounded-3xl p-6 sm:p-7">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-zinc-200">Rule adherence</h2>
            <button onClick={() => setEditing(true)} className="text-xs font-medium text-gold-300 hover:text-gold-200">
              Edit limits
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className={cn("flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-semibold mono", score >= 80 ? "bg-mint-500/10 text-mint-300" : score >= 50 ? "bg-amber-500/10 text-amber-300" : "bg-rose-500/10 text-rose-300")}>
              {score}
            </div>
            <div className="flex-1">
              {breaches.length === 0 ? (
                <p className="flex items-center gap-1.5 text-sm text-mint-300">
                  <ShieldCheck className="h-4 w-4" /> No active rule breaches.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {breaches.map((b, i) => (
                    <li key={i} className={cn("flex items-start gap-1.5 text-xs", b.severity === "critical" ? "text-rose-300" : "text-amber-300")}>
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      {b.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="surface space-y-5 rounded-3xl p-6 sm:p-7">
          <h2 className="font-display text-base font-semibold text-zinc-200">Set your risk limits</h2>
          <p className="text-xs text-zinc-500">All optional - only configured limits are checked. Leave a field blank to skip that rule.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <CalcField key={f.key} label={f.label} value={form[f.key]} onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))} suffix={f.suffix || undefined} />
            ))}
          </div>
          <div className="flex justify-end gap-2">
            {profile && (
              <button onClick={() => setEditing(false)} className="btn-ghost">
                Cancel
              </button>
            )}
            <button onClick={save} disabled={saving} className="btn-gold disabled:opacity-50">
              {saving ? "Saving…" : "Save limits"}
            </button>
          </div>
        </div>
      )}

      {openTrades.length > 0 && (
        <div className="surface rounded-3xl p-6 sm:p-7">
          <h2 className="mb-4 font-display text-base font-semibold text-zinc-200">Planned risk on open trades</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-zinc-600">
                  <th className="pb-1.5 pr-4 font-medium">Trade</th>
                  <th className="pb-1.5 pr-4 font-medium">Risk (USD)</th>
                  <th className="pb-1.5 font-medium">Risk (% equity)</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {openTrades.map((t) => {
                  const usd = plannedRiskUsd({ id: t.id, side: t.side, symbol: t.symbol, leverage: t.leverage, stopLoss: t.stopLoss, fills: t.fills });
                  const pct = plannedRiskPct({ id: t.id, side: t.side, symbol: t.symbol, leverage: t.leverage, stopLoss: t.stopLoss, fills: t.fills }, profile?.accountEquity);
                  const overLimit = profile?.maxRiskPerTradePct != null && pct != null && pct > profile.maxRiskPerTradePct;
                  return (
                    <tr key={t.id} className="border-t border-line/50">
                      <td className="py-1.5 pr-4">{t.symbol} · {t.side}</td>
                      <td className="py-1.5 pr-4 mono">${usd.toFixed(2)}</td>
                      <td className={cn("py-1.5 mono", overLimit ? "text-rose-300" : "text-zinc-300")}>{pct != null ? `${pct.toFixed(2)}%` : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
