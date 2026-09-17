"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Reveal } from "@/components/Reveal";
import {
  breakEven,
  buildComparables,
  compRange,
  efficiency,
  fdvLadder,
  projectCost,
  projectValue,
  sensitivityGrid,
  type CompMetric,
  type CompVenue,
} from "@modules/points/lib/points";
import { CompsEngine } from "./CompsEngine";
import { ValuePanel } from "./ValuePanel";
import { CostPanel } from "./CostPanel";
import { SensitivityGrid } from "./SensitivityGrid";

const STORE_KEY = "xyz.points.v1";

/** Form state, all strings so a half-typed field is never coerced to 0 mid-edit. */
type Form = {
  targetSlug: string;
  metric: CompMetric;
  fdv: string;
  fdvLinked: boolean;
  yourPoints: string;
  totalPoints: string;
  supply: string;
  allocPct: string;
  tgeUnlock: string;
  volumeUsd: string;
  feeRatePct: string;
  gasUsd: string;
  capitalUsd: string;
  days: string;
  aprPct: string;
};

const DEFAULTS: Form = {
  targetSlug: "",
  metric: "volume30d",
  fdv: "1500000000",
  fdvLinked: true,
  yourPoints: "940",
  totalPoints: "9400000",
  supply: "1000000000",
  allocPct: "30",
  tgeUnlock: "25",
  volumeUsd: "5000000",
  feeRatePct: "0.04",
  gasUsd: "120",
  capitalUsd: "20000",
  days: "90",
  aprPct: "8",
};

const num = (s: string) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

export function PointsClient() {
  const [form, setForm] = useState<Form>(DEFAULTS);
  const [venues, setVenues] = useState<CompVenue[]>([]);
  const [state, setState] = useState<"loading" | "live" | "down">("loading");
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);

  const set = useCallback(<K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => (f[k] === v ? f : { ...f, [k]: v }));
  }, []);

  // Restore after mount, never during render. A value read from localStorage
  // while rendering is a client-only signal reaching the DOM, which is the
  // React #418 hydration trap documented in CLAUDE.md - the one that shipped a
  // blank page to every reduced-motion visitor.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) setForm((f) => ({ ...f, ...(JSON.parse(raw) as Partial<Form>) }));
    } catch {
      // Private window, blocked storage, corrupt JSON: the defaults are fine.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(form));
    } catch {
      // Never let a storage quota error break the calculator.
    }
  }, [form]);

  const load = useCallback(async () => {
    setState((s) => (s === "live" ? s : "loading"));
    try {
      const res = await fetch("/api/points/comps", { cache: "no-store" });
      const j = await res.json();
      if (res.ok && Array.isArray(j.venues) && j.venues.length) {
        setVenues(j.venues);
        setState("live");
        setFetchedAt(Date.now());
      } else {
        setState("down");
      }
    } catch {
      setState("down");
    }
  }, []);

  // Fetched once on mount, not polled: perp volumes move on a daily cadence and
  // a poll here would need an entry in markets-poll-alignment.test.ts plus a
  // window to match. The refresh control in the header covers the rest.
  useEffect(() => {
    void load();
  }, [load]);

  // ⚠️ Both of the values below are DERIVED during render rather than pushed
  // into state from an effect.
  //
  // The effect version worked, and was wrong in the way this codebase has been
  // bitten by before: it rendered once with the old value, then again with the
  // new one, so the FDV field visibly flickered through the previous venue's
  // number on every metric change. Deriving makes that impossible - there is no
  // intermediate render to see, and no second source of truth to fall out of
  // sync with.

  // Default to the largest venue with NO token, because that is the only case
  // this engine can say anything useful about. Falls back to the largest venue
  // overall so the page is never empty.
  const targetSlug =
    form.targetSlug || (venues.find((v) => v.fdv === null) ?? venues[0])?.slug || "";

  const target = useMemo(
    () => venues.find((v) => v.slug === targetSlug) ?? null,
    [venues, targetSlug]
  );

  const comps = useMemo(
    () => (target ? buildComparables(target, venues, form.metric) : []),
    [target, venues, form.metric]
  );
  const range = useMemo(() => compRange(comps), [comps]);

  // The link that makes this one tool instead of four. While linked, the FDV
  // every panel below IS the comparable median - change the metric and the
  // whole page moves. Typing in the FDV field breaks the link, visibly.
  const fdv = form.fdvLinked && range.median > 0 ? String(Math.round(range.median)) : form.fdv;

  const valueInputs = useMemo(
    () => ({
      yourPoints: num(form.yourPoints),
      totalPoolPoints: num(form.totalPoints),
      allocationPctOfSupply: num(form.allocPct),
      totalSupply: num(form.supply),
      fdvUsd: num(fdv),
      tgeUnlockPct: num(form.tgeUnlock),
    }),
    [form.yourPoints, form.totalPoints, form.allocPct, form.supply, fdv, form.tgeUnlock]
  );

  const value = useMemo(() => projectValue(valueInputs), [valueInputs]);

  const cost = useMemo(
    () =>
      projectCost({
        volumeUsd: num(form.volumeUsd),
        feeRatePct: num(form.feeRatePct),
        gasUsd: num(form.gasUsd),
        capitalUsd: num(form.capitalUsd),
        days: num(form.days),
        opportunityAprPct: num(form.aprPct),
      }),
    [form.volumeUsd, form.feeRatePct, form.gasUsd, form.capitalUsd, form.days, form.aprPct]
  );

  const be = useMemo(() => breakEven(valueInputs, cost), [valueInputs, cost]);
  const eff = useMemo(
    () => efficiency({ points: num(form.yourPoints), cost, volumeUsd: num(form.volumeUsd) }),
    [form.yourPoints, cost]
  );

  // The ladder is built around whatever FDV is in play, so the grid always
  // brackets the current assumption instead of a fixed set of round numbers
  // that may sit nowhere near it.
  const fdvs = useMemo(() => fdvLadder(num(fdv) || 1e9), [fdv]);
  const allocs = useMemo(() => [10, 20, 30, 40, 50], []);
  const grid = useMemo(
    () => sensitivityGrid(valueInputs, fdvs, allocs, cost.totalCostUsd),
    [valueInputs, fdvs, allocs, cost.totalCostUsd]
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <Reveal>
        <CompsEngine
          venues={venues}
          target={target}
          metric={form.metric}
          comps={comps}
          range={range}
          state={state}
          fetchedAt={fetchedAt}
          linked={form.fdvLinked}
          onRefresh={load}
          onTarget={(slug) => set("targetSlug", slug)}
          onMetric={(m) => set("metric", m)}
          onUseMedian={() => set("fdvLinked", true)}
        />
      </Reveal>

      <Reveal delay={0.05}>
        <ValuePanel
          form={{ ...form, fdv }}
          set={set}
          value={value}
          target={target}
          linked={form.fdvLinked}
          medianFdv={range.median}
        />
      </Reveal>

      <Reveal delay={0.1}>
        <CostPanel form={form} set={set} cost={cost} be={be} eff={eff} value={value} />
      </Reveal>

      <Reveal delay={0.15}>
        {/* `fdv`, not `form.fdv`. While the comparables link is on, `form.fdv`
            still holds whatever was typed before linking - so passing it here
            outlined a cell one column away from the one every other panel was
            using, with nothing on screen to explain the disagreement. */}
        <SensitivityGrid
          grid={grid}
          fdvs={fdvs}
          allocs={allocs}
          currentFdv={num(fdv)}
          currentAlloc={num(form.allocPct)}
        />
      </Reveal>
    </div>
  );
}
