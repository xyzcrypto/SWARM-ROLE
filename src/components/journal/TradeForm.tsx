"use client";

import { useState } from "react";
import { CalcField, CalcSegmented } from "@/components/tools/CalcField";
import { DEX_REGISTRY } from "@/lib/dex-registry";
import type { Side } from "@/lib/calculators";

export type NewTradeInput = {
  symbol: string;
  side: Side;
  type: "spot" | "futures" | "perp" | "custom";
  platformId?: string;
  leverage?: number;
  stopLoss?: number;
  takeProfit?: number;
  setup?: string;
  session?: string;
  timeframe?: string;
  tags: string[];
  notes?: string;
  fills: { kind: "entry"; price: number; size: number; fee: number }[];
};

const TYPES = [
  { value: "perp", label: "Perp" },
  { value: "futures", label: "Futures" },
  { value: "spot", label: "Spot" },
  { value: "custom", label: "Custom" },
] as const;

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 10);
}

// Trade creation form - one entry fill up front (multi-entry averaging and
// exits happen after creation via each trade row's "Add fill" action, so this
// stays focused instead of trying to model a whole position lifecycle at once).
export function TradeForm({ onSubmit, onCancel, busy }: { onSubmit: (t: NewTradeInput) => void; onCancel: () => void; busy: boolean }) {
  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState<Side>("long");
  const [type, setType] = useState<NewTradeInput["type"]>("perp");
  const [platformId, setPlatformId] = useState("");
  const [leverage, setLeverage] = useState("1");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [setup, setSetup] = useState("");
  const [session, setSession] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [notes, setNotes] = useState("");
  const [price, setPrice] = useState("");
  const [dollarAmount, setDollarAmount] = useState("");
  const [fee, setFee] = useState("0");

  // Users think in dollars, not raw asset units - size is still what's stored
  // (matches every P&L formula downstream), just computed here instead of typed.
  const sizeUnits = Number(price) > 0 ? (Number(dollarAmount) || 0) / Number(price) : 0;
  const valid = symbol.trim().length > 0 && Number(price) > 0 && sizeUnits > 0;

  function submit() {
    if (!valid) return;
    onSubmit({
      symbol: symbol.trim().toUpperCase(),
      side,
      type,
      platformId: platformId || undefined,
      leverage: Number(leverage) || 1,
      stopLoss: stopLoss ? Number(stopLoss) : undefined,
      takeProfit: takeProfit ? Number(takeProfit) : undefined,
      setup: setup || undefined,
      session: session || undefined,
      timeframe: timeframe || undefined,
      tags: parseTags(tagsRaw),
      notes: notes || undefined,
      fills: [{ kind: "entry", price: Number(price), size: sizeUnits, fee: Number(fee) || 0 }],
    });
  }

  return (
    <div className="surface space-y-5 rounded-3xl p-6 sm:p-7">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-zinc-50">Log a trade</h3>
        <CalcSegmented options={[{ value: "long", label: "Long" }, { value: "short", label: "Short" }]} value={side} onChange={setSide} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Symbol</span>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="BTC"
            className="w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as NewTradeInput["type"])}
            className="w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Platform</span>
          <select
            value={platformId}
            onChange={(e) => setPlatformId(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20"
          >
            <option value="">-</option>
            {DEX_REGISTRY.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <CalcField label="Entry price" value={price} onChange={setPrice} suffix="USD" />
        <CalcField
          label="Position size"
          value={dollarAmount}
          onChange={setDollarAmount}
          suffix="USD"
          hint={Number(price) > 0 && sizeUnits > 0 ? `≈ ${sizeUnits.toLocaleString(undefined, { maximumFractionDigits: 6 })} units` : "Enter entry price first"}
        />
        <CalcField label="Fee" value={fee} onChange={setFee} suffix="USD" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <CalcField label="Leverage" value={leverage} onChange={setLeverage} suffix="x" />
        <CalcField label="Stop loss" value={stopLoss} onChange={setStopLoss} suffix="USD" />
        <CalcField label="Take profit" value={takeProfit} onChange={setTakeProfit} suffix="USD" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Setup</span>
          <input value={setup} onChange={(e) => setSetup(e.target.value)} placeholder="Breakout" className="w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Session</span>
          <input value={session} onChange={(e) => setSession(e.target.value)} placeholder="New York" className="w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Timeframe</span>
          <input value={timeframe} onChange={(e) => setTimeframe(e.target.value)} placeholder="4H" className="w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20" />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Tags (comma separated)</span>
        <input value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder="breakout, high-conviction" className="w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20" />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20"
        />
      </label>

      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="btn-ghost">Cancel</button>
        <button onClick={submit} disabled={!valid || busy} className="btn-gold disabled:opacity-50">
          {busy ? "Saving…" : "Log trade"}
        </button>
      </div>
    </div>
  );
}
