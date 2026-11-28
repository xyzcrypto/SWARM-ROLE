"use client";

import { useEffect, useMemo, useState } from "react";
import { fundingFee, type Side } from "@/lib/calculators";
import { DEX_REGISTRY, getPlatform } from "@/lib/dex-registry";
import { AssumptionBanner, CalcField, CalcSegmented, ResultTile } from "./CalcField";
import { cn } from "@/lib/utils";

type PerpMarket = { coin: string; price: number; funding: number; openInterest: number };
type PerpResp = { markets: PerpMarket[]; live: boolean };

const PRESETS = [
  { label: "1h", hours: 1 },
  { label: "8h", hours: 8 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 24 * 7 },
] as const;

const DEFAULT_PLATFORM = DEX_REGISTRY.find((p) => p.hasLiveFunding)?.id ?? DEX_REGISTRY[0]?.id ?? "";

// Estimate funding for any perp DEX in the registry (src/lib/dex-registry.ts),
// so it's always clear WHICH exchange a rate belongs to. Live prefill only
// exists for platforms with `hasLiveFunding` (Hyperliquid today, via
// /api/markets/perp) - every other platform still works via manual entry,
// clearly labeled with that platform's real name.
export function FundingFeeCalculator() {
  const [platformId, setPlatformId] = useState(DEFAULT_PLATFORM);
  const platform = getPlatform(platformId);

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

  function onPickPlatform(id: string) {
    setPlatformId(id);
    setCustom(false);
    const p = getPlatform(id);
    if (p?.hasLiveFunding && markets.length) {
      setCoin(markets[0].coin);
      setRate((markets[0].funding * 100).toFixed(4));
    }
  }

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

  const showLive = platform?.hasLiveFunding && markets.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-lg font-semibold text-zinc-50">Funding Fee Calculator</h3>
        <p className="mt-1 text-sm text-zinc-500">Estimate what you&apos;ll pay or receive holding a perp position.</p>
      </div>

      <div>
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Perp DEX</span>
        <div className="flex flex-wrap gap-1.5">
          {DEX_REGISTRY.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPickPlatform(p.id)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                platformId === p.id
                  ? "border-gold-500/40 bg-gold-500/15 text-gold-100"
                  : "border-white/10 text-zinc-400 hover:border-gold-500/40 hover:text-gold-200"
              )}
            >
              {p.name}
              {p.hasLiveFunding && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-mint-400 align-middle" />}
            </button>
          ))}
        </div>
      </div>

      {showLive ? (
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Coin on {platform?.name} (prefills live rate)
            <span className={cn("h-1.5 w-1.5 rounded-full", live ? "bg-mint-400" : "bg-amber-400")} />
          </span>
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
      ) : (
        <AssumptionBanner>
          No live feed wired in yet for {platform?.name} - enter their published funding rate manually below.
          {platform?.links.website && (
            <>
              {" "}
              <a href={platform.links.website} target="_blank" rel="noopener noreferrer" className="underline decoration-amber-400/40 underline-offset-2 hover:text-amber-100">
                {platform.name} docs ↗
              </a>
            </>
          )}
        </AssumptionBanner>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CalcField label="Position size" value={notional} onChange={setNotional} suffix="USD" />
        <CalcField
          label="Hourly funding rate"
          value={rate}
          onChange={(v) => {
            setCustom(true);
            setRate(v);
          }}
          suffix="% / hr"
          hint={showLive ? "Prefilled from the live rate above - edit freely." : `Enter ${platform?.name ?? "this platform"}'s published rate.`}
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
        label={`${result >= 0 ? "You pay" : "You receive"} (estimated) - ${platform?.name ?? ""}`}
        value={`$${Math.abs(result).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
        tone={result >= 0 ? "rose" : "mint"}
        hint="Positive funding = longs pay shorts. Funding changes frequently - this isn't a forecast."
      />
    </div>
  );
}
