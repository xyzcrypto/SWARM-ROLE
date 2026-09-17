"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Reveal } from "@/components/Reveal";
import { wakeIsDue } from "@/lib/useLiveData";
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
import { buildPrograms, scenarioFdv, sortPrograms, type ProgramView } from "@modules/points/lib/programs";
import { ProgramPanel } from "./ProgramPanel";
import { ProgramSection } from "./ProgramSection";
import { UpdatesFeed } from "./UpdatesFeed";
import { CompsEngine } from "./CompsEngine";
import { CostPanel } from "./CostPanel";
import { SensitivityGrid } from "./SensitivityGrid";

const STORE_KEY = "xyz.points.v2";

/**
 * One programme's inputs. All strings so a half-typed field is never coerced to
 * 0 mid-edit.
 *
 * ⚠️ Per programme, not global. A single shared set of inputs meant switching
 * from Sodex to RiseX silently reinterpreted your Sodex points against RiseX's
 * pool - and the two cannot be seen at once, which is the comparison anyone
 * farming both actually wants.
 */
type ProgState = {
  label: string;
  yourPoints: string;
  totalPoints: string;
  supply: string;
  allocPct: string;
  tgeUnlock: string;
  fdv: string;
  fdvLinked: boolean;
};

type Form = {
  progs: Record<string, Partial<ProgState>>;
  /** The comparables explorer's own target and window - independent of any
   *  programme, because it is a market tool rather than a position. */
  metric: CompMetric;
  targetSlug: string;
  /** Which programme the cost / outcome panels below are analysing. */
  analyseId: string;
  volumeUsd: string;
  feeRatePct: string;
  gasUsd: string;
  capitalUsd: string;
  days: string;
  aprPct: string;
};

const DEFAULTS: Form = {
  progs: {},
  metric: "volume30d",
  targetSlug: "",
  analyseId: "",
  volumeUsd: "5000000",
  feeRatePct: "0.04",
  gasUsd: "120",
  capitalUsd: "20000",
  days: "90",
  aprPct: "8",
};

/** The comps route's own `revalidate`/`s-maxage`. Refetching sooner than this
 *  can only ever return the same cached body. */
const COMPS_WINDOW_MS = 320_000;

const num = (s: string) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

/**
 * A programme's inputs, seeded from its own published scenario.
 *
 * Derived on every render rather than written into state by an effect: an
 * effect would render once with the previous programme's numbers before
 * correcting itself, which is the flicker this file has already been fixed for
 * once.
 */
function progStateOf(form: Form, p: ProgramView): ProgState {
  const saved = form.progs[p.id] ?? {};
  return {
    label: saved.label ?? "",
    yourPoints: saved.yourPoints ?? "940",
    totalPoints: saved.totalPoints ?? String(p.scenario.totalPoints),
    supply: saved.supply ?? String(p.scenario.totalSupply),
    allocPct: saved.allocPct ?? String(p.scenario.allocationPctOfSupply),
    tgeUnlock: saved.tgeUnlock ?? String(p.scenario.tgeUnlockPcts[0] ?? 25),
    fdv: saved.fdv ?? String(scenarioFdv(p) || 1_000_000_000),
    fdvLinked: saved.fdvLinked ?? true,
  };
}

export function PointsClient() {
  const [form, setForm] = useState<Form>(DEFAULTS);
  const [venues, setVenues] = useState<CompVenue[]>([]);
  const [windows, setWindows] = useState<Record<string, boolean>>({});
  const [state, setState] = useState<"loading" | "live" | "down">("loading");
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const fetchedAtRef = useRef(0);

  const set = useCallback(<K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => (f[k] === v ? f : { ...f, [k]: v }));
  }, []);

  const setProg = useCallback((id: string, k: keyof ProgState, v: string | boolean) => {
    setForm((f) => ({ ...f, progs: { ...f.progs, [id]: { ...(f.progs[id] ?? {}), [k]: v } } }));
  }, []);

  // Restore after mount, never during render. A value read from localStorage
  // while rendering is a client-only signal reaching the DOM, which is the
  // React #418 hydration trap documented in CLAUDE.md.
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
        setWindows(j.windows ?? {});
        setState("live");
        setFetchedAt(Date.now());
        fetchedAtRef.current = Date.now();
      } else {
        setState("down");
      }
    } catch {
      setState("down");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // A reader coming back to the tab after an hour should not be looking at an
  // hour-old number with no way to know it. Refetch on wake, and only once the
  // route's own cache window has elapsed - so returning three times in a minute
  // costs exactly one request, not three.
  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState === "hidden") return;
      if (wakeIsDue(Date.now(), fetchedAtRef.current, COMPS_WINDOW_MS)) void load();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("online", onWake);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("online", onWake);
    };
  }, [load]);

  const programs = useMemo(() => sortPrograms(buildPrograms(venues)), [venues]);

  // ⚠️ The chosen metric must be one the data can answer on. `volume30d` was
  // hard-coded, so a response without 30d volume produced an empty comparable
  // set on a page full of venues. Falls back to the widest window actually
  // present, which is 24h at minimum.
  const metric: CompMetric =
    windows[form.metric] === false
      ? ((["volume30d", "volume7d", "volume24h", "openInterest"] as CompMetric[]).find((m) => windows[m]) ??
        form.metric)
      : form.metric;

  // The explorer at the top is a MARKET tool, not a position: pick any venue,
  // see what its peers imply. Each programme section carries its own anchor
  // separately, so the two never fight over one target.
  const explorerTarget = useMemo(() => {
    const chosen = venues.find((v) => v.slug === form.targetSlug);
    if (chosen) return chosen;
    return venues.find((v) => v.fdv === null) ?? venues[0] ?? null;
  }, [venues, form.targetSlug]);

  const explorerComps = useMemo(
    () => (explorerTarget ? buildComparables(explorerTarget, venues, metric) : []),
    [explorerTarget, venues, metric]
  );
  const explorerRange = useMemo(() => compRange(explorerComps), [explorerComps]);

  /** Everything one programme section needs, including its own FDV anchor. */
  const views = useMemo(
    () =>
      programs.map((p) => {
        const st = progStateOf(form, p);
        const comps = p.venue ? buildComparables(p.venue, venues, metric) : [];
        const range = compRange(comps);
        const scenario = scenarioFdv(p);
        const anchor: "comps" | "program" | "none" =
          range.median > 0 ? "comps" : scenario > 0 ? "program" : "none";
        const anchorFdv = anchor === "comps" ? range.median : anchor === "program" ? scenario : 0;
        const fdv = st.fdvLinked && anchorFdv > 0 ? String(Math.round(anchorFdv)) : st.fdv;
        const inputs = {
          yourPoints: num(st.yourPoints),
          totalPoolPoints: num(st.totalPoints),
          allocationPctOfSupply: num(st.allocPct),
          totalSupply: num(st.supply),
          fdvUsd: num(fdv),
          tgeUnlockPct: num(st.tgeUnlock),
        };
        return { program: p, st: { ...st, fdv }, anchor, anchorFdv, inputs, value: projectValue(inputs) };
      }),
    [programs, form, venues, metric]
  );

  // ── the deep dive, on one chosen programme ────────────────────────────────
  const analysed = views.find((v) => v.program.id === form.analyseId) ?? views[0] ?? null;

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

  const be = useMemo(
    () => (analysed ? breakEven(analysed.inputs, cost) : null),
    [analysed, cost]
  );
  const eff = useMemo(
    () =>
      efficiency({
        points: analysed ? analysed.inputs.yourPoints : 0,
        cost,
        volumeUsd: num(form.volumeUsd),
      }),
    [analysed, cost, form.volumeUsd]
  );

  const fdvs = useMemo(() => fdvLadder(analysed?.inputs.fdvUsd || 1e9), [analysed]);
  const allocs = useMemo(() => [10, 20, 30, 40, 50], []);
  const grid = useMemo(
    () => (analysed ? sensitivityGrid(analysed.inputs, fdvs, allocs, cost.totalCostUsd) : []),
    [analysed, fdvs, allocs, cost.totalCostUsd]
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <Reveal>
        <UpdatesFeed />
      </Reveal>

      <Reveal delay={0.05}>
        <ProgramPanel programs={programs} />
      </Reveal>

      <Reveal delay={0.1}>
        <CompsEngine
          venues={venues}
          target={explorerTarget}
          metric={metric}
          comps={explorerComps}
          range={explorerRange}
          state={state}
          fetchedAt={fetchedAt}
          windows={windows}
          onRefresh={load}
          onTarget={(slug) => set("targetSlug", slug)}
          onMetric={(m) => set("metric", m)}
        />
      </Reveal>

      {/* One section per programme, each a complete calculation of its own. */}
      {views.map((v, i) => (
        <Reveal key={v.program.id} delay={0.15 + i * 0.05}>
          <ProgramSection
            program={v.program}
            form={v.st}
            set={(k: keyof ProgState, val: string | boolean) => setProg(v.program.id, k, val)}
            value={v.value}
            anchor={v.anchor}
            anchorFdv={v.anchorFdv}
            target={v.program.venue}
          />
        </Reveal>
      ))}

      {analysed && be && (
        <>
          <Reveal>
            <CostPanel
              form={form}
              set={set}
              cost={cost}
              be={be}
              eff={eff}
              value={analysed.value}
              programs={views.map((v) => ({ id: v.program.id, name: v.program.name }))}
              analyseId={analysed.program.id}
              onAnalyse={(id) => set("analyseId", id)}
            />
          </Reveal>

          <Reveal delay={0.05}>
            <SensitivityGrid
              grid={grid}
              fdvs={fdvs}
              allocs={allocs}
              currentFdv={analysed.inputs.fdvUsd}
              currentAlloc={analysed.inputs.allocationPctOfSupply}
              totalCostUsd={cost.totalCostUsd}
              programName={analysed.program.name}
            />
          </Reveal>
        </>
      )}
    </div>
  );
}
