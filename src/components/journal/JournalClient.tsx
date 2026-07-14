"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, ChevronDown, NotebookPen, BarChart3, ShieldAlert, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPlatform } from "@/lib/dex-registry";
import {
  computeStats,
  deriveStatus,
  equityCurve,
  realizedPnl,
  riskReward,
  weightedAvgPrice,
  type Fill,
} from "@/lib/journal";
import { EquityCurveChart } from "./EquityCurveChart";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { RiskPanel, type SerializedRiskProfile } from "./RiskPanel";
import { ChallengesPanel } from "./ChallengesPanel";
import { TradeForm, type NewTradeInput } from "./TradeForm";

export type SerializedFill = { id: string; kind: "entry" | "exit"; price: number; size: number; fee: number; executedAt: string };
export type SerializedTrade = {
  id: string;
  createdAt: string;
  symbol: string;
  side: string;
  type: string;
  status: string;
  platformId: string | null;
  leverage: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  setup: string | null;
  marketCondition: string | null;
  session: string | null;
  timeframe: string | null;
  assetCategory: string | null;
  tags: string[];
  emotions: string[];
  mistakes: string[];
  lessons: string | null;
  notes: string | null;
  screenshots: string[];
  visibility: string;
  fills: SerializedFill[];
};

function StatTile({ label, value, tone = "plain" }: { label: string; value: string; tone?: "plain" | "mint" | "gold" | "rose" }) {
  const num = tone === "mint" ? "text-mint-gradient" : tone === "gold" ? "text-gold-gradient" : tone === "rose" ? "text-rose-400" : "text-zinc-50";
  return (
    <div className="surface surface-hover lift rounded-2xl p-5">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={cn("mt-2 mono text-2xl font-semibold", num)}>{value}</p>
    </div>
  );
}

const TABS = [
  { id: "trades" as const, label: "Trades", icon: NotebookPen },
  { id: "analytics" as const, label: "Analytics", icon: BarChart3 },
  { id: "risk" as const, label: "Risk", icon: ShieldAlert },
  { id: "challenges" as const, label: "Challenges", icon: Trophy },
];

export function JournalClient({
  initialTrades,
  initialRiskProfile,
}: {
  initialTrades: SerializedTrade[];
  initialRiskProfile: SerializedRiskProfile;
}) {
  const [trades, setTrades] = useState(initialTrades);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("trades");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const stats = useMemo(() => computeStats(trades.map((t) => ({ side: t.side, fills: t.fills, stopLoss: t.stopLoss, takeProfit: t.takeProfit }))), [trades]);
  const curve = useMemo(
    () => equityCurve(trades.map((t) => ({ side: t.side, fills: t.fills.map((f) => ({ ...f, executedAt: f.executedAt })) }))),
    [trades]
  );

  async function createTrade(input: NewTradeInput) {
    setBusy(true);
    try {
      const res = await fetch("/api/journal/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const j = await res.json();
      if (res.ok) {
        setTrades((prev) => [j.trade, ...prev]);
        setShowForm(false);
      }
    } finally {
      setBusy(false);
    }
  }

  async function addFill(tradeId: string, fill: { kind: "entry" | "exit"; price: number; size: number; fee: number }) {
    const res = await fetch(`/api/journal/trades/${tradeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addFills: [fill] }),
    });
    const j = await res.json();
    if (res.ok) setTrades((prev) => prev.map((t) => (t.id === tradeId ? j.trade : t)));
  }

  async function deleteTrade(id: string) {
    setTrades((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/journal/trades/${id}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <div className="space-y-8 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-zinc-50 sm:text-3xl">
            Trading <span className="text-shine">Journal</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Log your trades and see your real performance, automatically calculated.</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="btn-gold inline-flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> Log trade
        </button>
      </div>

      {showForm && <TradeForm busy={busy} onSubmit={createTrade} onCancel={() => setShowForm(false)} />}

      <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-line bg-ink-950/50 p-1.5">
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

      {tab === "trades" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Win rate" value={`${stats.winRate.toFixed(1)}%`} tone="mint" />
            <StatTile label="Total P&L" value={`$${stats.totalPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} tone={stats.totalPnl >= 0 ? "mint" : "rose"} />
            <StatTile label="Total trades" value={String(stats.totalTrades)} />
            <StatTile label="Avg R" value={stats.avgR != null ? stats.avgR.toFixed(2) : "-"} tone="gold" />
          </div>

          <div className="surface rounded-3xl p-6 sm:p-7">
            <h2 className="mb-4 font-display text-base font-semibold text-zinc-200">Equity curve</h2>
            <EquityCurveChart points={curve} />
          </div>

          <div className="space-y-3">
            <h2 className="font-display text-base font-semibold text-zinc-200">Trades</h2>
            {trades.length === 0 && (
              <div className="surface rounded-2xl p-8 text-center text-sm text-zinc-500">
                No trades logged yet - click &ldquo;Log trade&rdquo; to start tracking your performance.
              </div>
            )}
            {trades.map((t) => (
              <TradeRow
                key={t.id}
                trade={t}
                expanded={expanded === t.id}
                onToggle={() => setExpanded((e) => (e === t.id ? null : t.id))}
                onAddFill={(fill) => addFill(t.id, fill)}
                onDelete={() => deleteTrade(t.id)}
              />
            ))}
          </div>
        </>
      ) : tab === "analytics" ? (
        <AnalyticsPanel trades={trades} />
      ) : tab === "risk" ? (
        <RiskPanel trades={trades} initialProfile={initialRiskProfile} />
      ) : (
        <ChallengesPanel />
      )}
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  open: "text-sky-300 bg-sky-500/10 ring-sky-500/25",
  partial: "text-amber-300 bg-amber-500/10 ring-amber-500/25",
  closed: "text-mint-300 bg-mint-500/10 ring-mint-500/25",
  canceled: "text-zinc-400 bg-white/5 ring-white/10",
  invalid: "text-rose-300 bg-rose-500/10 ring-rose-500/25",
};

function TradeRow({
  trade,
  expanded,
  onToggle,
  onAddFill,
  onDelete,
}: {
  trade: SerializedTrade;
  expanded: boolean;
  onToggle: () => void;
  onAddFill: (fill: { kind: "entry" | "exit"; price: number; size: number; fee: number }) => void;
  onDelete: () => void;
}) {
  const fills: Fill[] = trade.fills;
  const status = deriveStatus(fills);
  const avgEntry = weightedAvgPrice(fills, "entry");
  const pnl = realizedPnl(trade.side, fills);
  const rr = riskReward(trade);
  const platform = trade.platformId ? getPlatform(trade.platformId) : undefined;

  return (
    <div className="surface surface-hover rounded-2xl">
      <button onClick={onToggle} className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left">
        <div className="flex items-center gap-3">
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1", trade.side === "long" ? "bg-mint-500/10 text-mint-300 ring-mint-500/25" : "bg-rose-500/10 text-rose-300 ring-rose-500/25")}>
            {trade.side}
          </span>
          <span className="font-display text-sm font-semibold text-zinc-100">{trade.symbol}</span>
          <span className="text-xs text-zinc-500">{trade.type}</span>
          {platform && <span className="text-xs text-zinc-600">· {platform.name}</span>}
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1", STATUS_TONE[status] ?? STATUS_TONE.open)}>{status}</span>
        </div>
        <div className="flex items-center gap-4">
          {status !== "open" && (
            <span className={cn("mono text-sm font-semibold", pnl >= 0 ? "text-mint-300" : "text-rose-300")}>
              {pnl >= 0 ? "+" : ""}${pnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          )}
          <ChevronDown className={cn("h-4 w-4 text-zinc-500 transition-transform", expanded && "rotate-180")} />
        </div>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-line p-4">
          <div className="grid gap-3 text-xs text-zinc-400 sm:grid-cols-4">
            <div>Avg entry: <span className="mono text-zinc-200">${avgEntry.toFixed(4)}</span></div>
            <div>Leverage: <span className="mono text-zinc-200">{trade.leverage ?? 1}x</span></div>
            <div>R:R (planned): <span className="mono text-zinc-200">{rr != null ? rr.toFixed(2) : "-"}</span></div>
            <div>Fills: <span className="mono text-zinc-200">{fills.length}</span></div>
          </div>

          {(trade.setup || trade.session || trade.timeframe || trade.tags.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {trade.setup && <Tag>{trade.setup}</Tag>}
              {trade.session && <Tag>{trade.session}</Tag>}
              {trade.timeframe && <Tag>{trade.timeframe}</Tag>}
              {trade.tags.map((t) => <Tag key={t}>{t}</Tag>)}
            </div>
          )}
          {trade.notes && <p className="text-sm text-zinc-400">{trade.notes}</p>}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-zinc-600">
                  <th className="pb-1.5 pr-4 font-medium">Kind</th>
                  <th className="pb-1.5 pr-4 font-medium">Price</th>
                  <th className="pb-1.5 pr-4 font-medium">Size</th>
                  <th className="pb-1.5 font-medium">Fee</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {fills.map((f, i) => (
                  <tr key={i} className="border-t border-line/50">
                    <td className="py-1.5 pr-4 capitalize">{f.kind}</td>
                    <td className="py-1.5 pr-4 mono">${f.price}</td>
                    <td className="py-1.5 pr-4 mono">{f.size}</td>
                    <td className="py-1.5 mono">${f.fee}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <AddFillRow onAdd={onAddFill} />

          <div className="flex justify-end">
            <button onClick={onDelete} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-400 transition-colors hover:bg-rose-500/10">
              <Trash2 className="h-3.5 w-3.5" /> Delete trade
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400">{children}</span>;
}

function AddFillRow({ onAdd }: { onAdd: (fill: { kind: "entry" | "exit"; price: number; size: number; fee: number }) => void }) {
  const [kind, setKind] = useState<"entry" | "exit">("exit");
  const [price, setPrice] = useState("");
  const [size, setSize] = useState("");
  const [fee, setFee] = useState("0");

  function submit() {
    if (!(Number(price) > 0) || !(Number(size) > 0)) return;
    onAdd({ kind, price: Number(price), size: Number(size), fee: Number(fee) || 0 });
    setPrice("");
    setSize("");
    setFee("0");
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-white/10 bg-ink-950/40 p-3">
      <select value={kind} onChange={(e) => setKind(e.target.value as "entry" | "exit")} className="rounded-lg border border-white/10 bg-ink-700/60 px-2.5 py-2 text-xs text-zinc-100 outline-none">
        <option value="entry">Add entry</option>
        <option value="exit">Add exit</option>
      </select>
      <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price" type="number" className="w-24 rounded-lg border border-white/10 bg-ink-700/60 px-2.5 py-2 text-xs text-zinc-100 outline-none" />
      <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="Size" type="number" className="w-24 rounded-lg border border-white/10 bg-ink-700/60 px-2.5 py-2 text-xs text-zinc-100 outline-none" />
      <input value={fee} onChange={(e) => setFee(e.target.value)} placeholder="Fee" type="number" className="w-20 rounded-lg border border-white/10 bg-ink-700/60 px-2.5 py-2 text-xs text-zinc-100 outline-none" />
      <button onClick={submit} className="btn-secondary px-3 py-2 text-xs">Add fill</button>
    </div>
  );
}
