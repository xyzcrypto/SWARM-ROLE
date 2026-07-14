"use client";

import { useEffect, useMemo, useState } from "react";
import { fundingFee, type Side } from "@/lib/calculators";
import { CalcField, CalcSegmented, ResultTile } from "./CalcField";

type PerpMarket = { coin: string; price: number; funding: number; openInterest: number };
type PerpResp = { markets: PerpMarket[]; live: boolean };

const PRESETS = [
  { label: "1h", hours: 1 },
  { label: "8h", hours: 8 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 24 * 7 },
] as const;

// Live funding-rate prefill reuses /api/markets/perp (Hyperliquid, already
// fetched for the Markets page) - no new data source, just a new consumer.
export function FundingFeeCalculator() {
  const [markets, setMarkets] = useState<PerpMarket[]>([]);
  const [live, setLive] = useState(false);
  const [coin, setCoin] = useState("");
  const [custom, setCustom] = useState(false);
  const [notional, setNotional] = useState("10000");
  const [rate, setRate] = useState("0.01"); // % per hour
  const [hours, setHours] = useState("8");
  const [side, setSide] = useState<Side>("long");

  useEffect(() => {
    let active = true;
    fetch("/api/markets/perp", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: PerpResp) => {
        if (!active) return;
        setMarkets(j.markets ?? []);
        setLive(Boolean(j.live));
        if (!coin && j.markets?.length) {
          setCoin(j.markets[0].coin);
          setRate((j.markets[0].funding * 100).toFixed(4));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPickCoin(id: string) {
    setCoin(id);
    const m = markets.find((x) => x.coin === id);
    if (m && !custom) setRate((m.funding * 100).toFixed(4));
  }

  const result = useMemo(
    () =>
      fundingFee({
        notionalUsd: Number(notional) || 0,
        hourlyRate: (Number(rate) || 0) / 100,
        holdingHours: Number(hours) || 0,
        side,
      }),
    [notional, rate, hours, side]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-zinc-50">Funding Fee Calculator</h3>
          <p className="mt-1 text-sm text-zinc-500">Estimate what you&apos;ll pay or receive holding a perp position.</p>
        </div>
        {markets.length > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-ink-950/50 px-2.5 py-1 text-[11px] text-zinc-500">
            <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-mint-400" : "bg-amber-400"}`} />
            {live ? "Live rates" : "Cached rates"}
          </span>
        )}
      </div>

      {markets.length > 0 && (
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Coin (prefills live rate)</span>
          <select
            value={coin}
            onChange={(e) => onPickCoin(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20"
          >
            {markets.map((m) => (
              <option key={m.coin} value={m.coin}>
                {m.coin} - {(m.funding * 100).toFixed(4)}%/hr
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <CalcField label="Position size" value={notional} onChange={setNotional} suffix="USD" />
        <CalcField
          label="Hourly funding rate"
          value={rate}
          onChange={(v) => {
            setCustom(true);
            setRate(v);
          }}
          suffix="% / hr"
          hint="Prefilled from the live rate above - edit freely."
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setHours(String(p.hours))}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-gold-500/40 hover:text-gold-200"
            >
              {p.label}
            </button>
          ))}
        </div>
        <CalcSegmented options={[{ value: "long", label: "Long" }, { value: "short", label: "Short" }]} value={side} onChange={setSide} />
      </div>
      <CalcField label="Holding period" value={hours} onChange={setHours} suffix="hours" />

      <ResultTile
        label={result >= 0 ? "You pay (estimated)" : "You receive (estimated)"}
        value={`$${Math.abs(result).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
        tone={result >= 0 ? "rose" : "mint"}
        hint="Positive funding = longs pay shorts. Funding changes every hour - this isn't a forecast."
      />
    </div>
  );
}
