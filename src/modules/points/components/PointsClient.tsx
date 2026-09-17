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
import { buildPrograms, hasLiveComps, scenarioFdv, sortPrograms, type ProgramView } from "@modules/points/lib/programs";
import { ProgramPanel } from "./ProgramPanel";
import { CompsEngine } from "./CompsEngine";
import { ValuePanel } from "./ValuePanel";
import { CostPanel } from "./CostPanel";
import { SensitivityGrid } from "./SensitivityGrid";

const STORE_KEY = "xyz.points.v1";

/** Form state, all strings so a half-typed field is never coerced to 0 mid-edit. */
type Form = {
  programId: string;
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
  programId: "variational",
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

  // The curated programmes are always present, with or without live data -
  // see programs.ts for why that ordering matters.
  const programs = useMemo(() => sortPrograms(buildPrograms(venues)), [venues]);
  const program = useMemo(
    () => programs.find((p) => p.id === form.programId) ?? programs[0] ?? null,
    [programs, form.programId]
  );

  // A selected programme drives the comparables target when the market has a
  // row for it, and the venue picker is then read-only: two controls for one
  // value is a control that does nothing, and the one that does nothing is
  // always the one a reader tries first.
  //
  // ⚠️ When the programme has NO market row - Sodex and RiseX have none - this
  // deliberately resolves to NOTHING rather than to the largest unlisted venue.
  // An earlier version fell back that way and it was quietly wrong: choosing
  // Sodex showed Variational's peers, Variational's implied FDV, and no
  // indication that the numbers had nothing to do with Sodex. A reader can opt
  // into a proxy venue explicitly; the page will not pick one for them.
  const targetLocked = Boolean(program && hasLiveComps(program));
  const targetSlug = targetLocked ? program!.venue!.slug : form.targetSlug;

  const target = useMemo(
    () => venues.find((v) => v.slug === targetSlug) ?? null,
    [venues, targetSlug]
  );

  const comps = useMemo(
    () => (target ? buildComparables(target, venues, form.metric) : []),
    [target, venues, form.metric]
  );
  const range = useMemo(() => compRange(comps), [comps]);

  // The link that makes this one tool instead of five. While linked, the FDV
  // every panel below follows the best anchor available:
  //
  //   1. live peer comparables, when the programme's venue is tracked
  //   2. otherwise the programme's own scenario ladder
  //
  // Two anchors rather than one because most programmes worth farming are not
  // tracked by any market-data feed, and a "linked" toggle that silently does
  // nothing for two of the three programmes on this page would be worse than
  // no toggle. Typing in the FDV field breaks the link, visibly.
  const programFdv = program ? scenarioFdv(program) : 0;
  const anchor: "comps" | "program" | "none" =
    range.median > 0 ? "comps" : programFdv > 0 ? "program" : "none";
  const anchorFdv = anchor === "comps" ? range.median : anchor === "program" ? programFdv : 0;
  const fdv = form.fdvLinked && anchorFdv > 0 ? String(Math.round(anchorFdv)) : form.fdv;

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
        <ProgramPanel
          programs={programs}
          selectedId={program?.id ?? ""}
          onSelect={(p: ProgramView) => {
            // A click, not an effect: applying a preset is a user action, so
            // setting state here cannot cascade the way a derived-state effect
            // would. The scenario overwrites the supply-side fields only -
            // points, cost and volume are the reader's own and are never
            // clobbered by switching programmes.
            setForm((f) => ({
              ...f,
              programId: p.id,
              targetSlug: "",
              fdvLinked: true,
              totalPoints: String(p.scenario.totalPoints),
              supply: String(p.scenario.totalSupply),
              allocPct: String(p.scenario.allocationPctOfSupply),
              tgeUnlock: p.scenario.tgeUnlockPcts.length ? String(p.scenario.tgeUnlockPcts[0]) : f.tgeUnlock,
            }));
          }}
        />
      </Reveal>

      <Reveal delay={0.05}>
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
          locked={targetLocked}
          programName={program?.name ?? null}
          onTarget={(slug) => set("targetSlug", slug)}
          onMetric={(m) => set("metric", m)}
          onUseMedian={() => set("fdvLinked", true)}
        />
      </Reveal>

      <Reveal delay={0.1}>
        <ValuePanel
          form={{ ...form, fdv }}
          set={set}
          value={value}
          target={target}
          linked={form.fdvLinked}
          anchor={anchor}
          anchorFdv={anchorFdv}
          programName={program?.name ?? null}
        />
      </Reveal>

      <Reveal delay={0.15}>
        <CostPanel form={form} set={set} cost={cost} be={be} eff={eff} value={value} />
      </Reveal>

      <Reveal delay={0.2}>
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
