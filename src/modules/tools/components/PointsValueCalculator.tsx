"use client";

import { useMemo, useState } from "react";
import { Share2, Loader2 } from "lucide-react";
import { airdropValue, priceFromFdv } from "@/lib/calculators";
import { DEX_REGISTRY, platformDomain, platformLogo, platformsWithPointValue } from "@/lib/dex-registry";
import { AssumptionBanner, CalcField, ResultTile } from "./CalcField";
import { cn } from "@/lib/utils";

const PRESETS = platformsWithPointValue();

// Points/airdrop value estimator. No perp DEX publishes real-time points-to-
// token conversion data, so every number here is a user-editable assumption -
// picking a platform below just prefills known public scenario numbers
// (see src/lib/dex-registry.ts) rather than pulling live figures.
export function PointsValueCalculator() {
  const [platformId, setPlatformId] = useState(PRESETS[0]?.id ?? "");
  const platform = DEX_REGISTRY.find((p) => p.id === platformId);
  const scenario = platform?.pointValueScenario;

  const [yourPoints, setYourPoints] = useState("940");
  const [totalPoints, setTotalPoints] = useState(String(scenario?.totalPoints ?? 9_400_000));
  const [supply, setSupply] = useState(String(scenario?.totalSupply ?? 1_000_000_000));
  const [allocPct, setAllocPct] = useState(String(scenario?.allocationPctOfSupply ?? 30));
  const [fdv, setFdv] = useState(String(scenario?.fdvScenariosUsd?.[1] ?? 1_500_000_000));

  function applyPreset(id: string) {
    setPlatformId(id);
    const p = DEX_REGISTRY.find((x) => x.id === id)?.pointValueScenario;
    if (p) {
      setTotalPoints(String(p.totalPoints));
      setSupply(String(p.totalSupply));
      setAllocPct(String(p.allocationPctOfSupply));
      setFdv(String(p.fdvScenariosUsd[Math.floor(p.fdvScenariosUsd.length / 2)]));
    }
  }

  const price = useMemo(() => priceFromFdv(Number(fdv) || 0, Number(supply) || 0), [fdv, supply]);
  const result = useMemo(
    () =>
      airdropValue({
        yourPoints: Number(yourPoints) || 0,
        totalPoolPoints: Number(totalPoints) || 0,
        allocationPctOfSupply: Number(allocPct) || 0,
        totalSupply: Number(supply) || 0,
        priceUsd: price,
      }),
    [yourPoints, totalPoints, allocPct, supply, price]
  );

  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  async function share() {
    if (sharing) return;
    setSharing(true);
    setShareError(null);
    // Open the tab synchronously, in the same call stack as the click - most
    // browsers (Safari especially) only let window.open() bypass the popup
    // blocker when it's called directly from a user gesture, not after an
    // awaited fetch. We navigate this pre-opened tab once the id comes back.
    const win = window.open("", "_blank", "noopener,noreferrer");
    try {
      const res = await fetch("/api/tools/share/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "points-value",
          data: {
            platform: platform?.name ?? "Perp DEX",
            domain: platformDomain(platform ?? { links: {} }) ?? "",
            sharePct: result.sharePct,
            tokens: result.tokens,
            usd: result.usd,
            fdv: Number(fdv) || 0,
          },
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.id) {
        const url = `/tools/share/points-value/${j.id}`;
        if (win) win.location.href = url;
        else window.location.href = url; // popup fully blocked - fall back to same-tab
      } else {
        win?.close();
        setShareError("Couldn't create the share link. Please try again.");
      }
    } catch {
      win?.close();
      setShareError("Couldn't create the share link. Please try again.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-lg font-semibold text-zinc-50">Points / Airdrop Value Calculator</h3>
        <p className="mt-1 text-sm text-zinc-500">Estimate what your points could be worth under different scenarios.</p>
      </div>

      <AssumptionBanner>
        Estimate only, based on your assumptions - not live protocol data. No perp DEX publishes real-time
        points-to-token figures. Every number below is editable.
      </AssumptionBanner>

      {PRESETS.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => {
            const logo = platformLogo(p);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  platformId === p.id
                    ? "border-gold-500/40 bg-gold-500/15 text-gold-100"
                    : "border-white/10 text-zinc-400 hover:border-gold-500/40 hover:text-gold-200"
                )}
              >
                {logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt="" width={14} height={14} className="h-3.5 w-3.5 rounded-sm" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
                )}
                {p.name}
              </button>
            );
          })}
        </div>
      )}
      {platform?.notes && <p className="text-xs text-zinc-600">{platform.notes}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <CalcField label="Your points" value={yourPoints} onChange={setYourPoints} />
        <CalcField label="Total points pool" value={totalPoints} onChange={setTotalPoints} hint="Your points ÷ total pool = your share." />
        <CalcField label="Allocation of supply" value={allocPct} onChange={setAllocPct} suffix="%" />
        <CalcField label="Total token supply" value={supply} onChange={setSupply} />
        <CalcField label="FDV scenario" value={fdv} onChange={setFdv} suffix="USD" hint={`Implied price: $${price.toLocaleString(undefined, { maximumFractionDigits: 6 })}`} />
      </div>

      {scenario?.allocationScenarios && (
        <div className="flex flex-wrap gap-1.5">
          {scenario.allocationScenarios.map((s) => (
            <button
              key={s.pct}
              type="button"
              onClick={() => setAllocPct(String(s.pct))}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors",
                Number(allocPct) === s.pct
                  ? "border-gold-500/40 bg-gold-500/15 text-gold-100"
                  : "border-white/10 text-zinc-400 hover:border-gold-500/40 hover:text-gold-200"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {scenario && (
        <div className="flex flex-wrap gap-1.5">
          {scenario.fdvScenariosUsd.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setFdv(String(v))}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition-colors hover:border-gold-500/40 hover:text-gold-200"
            >
              ${(v / 1_000_000_000).toFixed(v >= 1_000_000_000 ? 1 : 2)}B FDV
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <ResultTile label="Your share" value={`${result.sharePct.toFixed(4)}%`} />
        <ResultTile label="Estimated tokens" value={result.tokens.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
        <ResultTile label="Estimated value" value={`$${result.usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} tone="gold" />
      </div>

      <div className="flex flex-col items-end gap-1.5">
        <button
          type="button"
          onClick={share}
          disabled={sharing}
          className="btn-secondary inline-flex items-center gap-1.5 text-xs disabled:opacity-60"
        >
          {sharing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
          {sharing ? "Creating link…" : "Share result"}
        </button>
        {shareError && <p className="text-xs text-rose-400">{shareError}</p>}
      </div>
    </div>
  );
}
