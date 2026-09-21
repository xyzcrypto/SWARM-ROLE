"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Reveal } from "@/components/Reveal";
import { wakeIsDue } from "@/lib/useLiveData";
import { refreshUrl } from "@/lib/refetch";
import {
  breakEven,
  breakEvenLadder,
  buildComparables,
  compRange,
  efficiency,
  fdvLadder,
  pickMetricFor,
  projectCost,
  projectValue,
  sensitivityGrid,
  usdCompact,
  type CompMetric,
  type CompVenue,
} from "@modules/points/lib/points";
import { buildPrograms, scenarioFdv, sortPrograms, type ProgramView } from "@modules/points/lib/programs";
import { PointsHero } from "./PointsHero";
import { FeaturedProgramsBar } from "./FeaturedProgramsBar";
import { PointsCalculatorCard } from "./PointsCalculatorCard";
import { FarmingEconomicsCard } from "./FarmingEconomicsCard";
import { FdvSimulatorCard } from "./FdvSimulatorCard";
import { ScenarioAnalysisCard } from "./ScenarioAnalysisCard";
import { MyAirdropsCard } from "./MyAirdropsCard";
import { HowItWorksCard } from "./HowItWorksCard";
import { OngoingAirdropsSection } from "./OngoingAirdropsSection";
import { CompsEngine } from "./CompsEngine";
import { ChevronDown, ChevronUp, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

const STORE_KEY = "xyz.points.v2";

type ProgState = {
  label: string;
  yourPoints: string;
  totalPoints: string;
  supply: string;
  allocPct: string;
  allocLinked?: boolean;
  tgeUnlock: string;
  fdv: string;
  fdvLinked: boolean;
};

type Form = {
  progs: Record<string, Partial<ProgState>>;
  metric: CompMetric;
  targetSlug: string;
  analyseId: string;
  openId: string;
  excludedPeers: string[];
  manualVolume: Record<string, string>;
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
  analyseId: "sodex",
  openId: "sodex",
  excludedPeers: [],
  manualVolume: {},
  volumeUsd: "5000000",
  feeRatePct: "0.04",
  gasUsd: "120",
  capitalUsd: "20000",
  days: "90",
  aprPct: "8",
};

const COMPS_WINDOW_MS = 320_000;
export const COMPS_POLL_MS = 300_000;

const num = (s: string) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

function progStateOf(form: Form, p: ProgramView): ProgState {
  const saved = form.progs[p.id] ?? {};

  return {
    label: saved.label ?? "",
    yourPoints: saved.yourPoints ?? "",
    totalPoints: saved.totalPoints ?? String(p.scenario.totalPoints),
    supply: saved.supply ?? String(p.scenario.totalSupply),
    allocPct: saved.allocPct ?? String(p.scenario.allocationPctOfSupply),
    allocLinked: saved.allocLinked ?? (saved.allocPct ? saved.allocPct === String(p.scenario.allocationPctOfSupply) : true),
    tgeUnlock: saved.tgeUnlock ?? String(p.scenario.tgeUnlockPcts[0] ?? 25),
    fdv: saved.fdv ?? String(scenarioFdv(p) || 500_000_000),
    fdvLinked: saved.fdvLinked ?? true,
  };
}

export function PointsClient() {
  const [form, setForm] = useState<Form>(DEFAULTS);
  const [venues, setVenues] = useState<CompVenue[]>([]);
  const [windows, setWindows] = useState<Record<string, boolean>>({});
  const [diag, setDiag] = useState<any>(null);
  const [state, setState] = useState<"loading" | "live" | "down">("loading");
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const fetchedAtRef = useRef(0);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const set = useCallback(<K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => (f[k] === v ? f : { ...f, [k]: v }));
  }, []);

  const setProg = useCallback((id: string, k: keyof ProgState, v: string | boolean) => {
    setForm((f) => ({ ...f, progs: { ...f.progs, [id]: { ...(f.progs[id] ?? {}), [k]: v } } }));
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Form>;
        if (parsed.progs) {
          for (const pid of Object.keys(parsed.progs)) {
            if (parsed.progs[pid]?.yourPoints === "250000") {
              parsed.progs[pid].yourPoints = "";
            }
          }
        }
        setForm((f) => ({ ...f, ...parsed }));
      }
    } catch {
      // safe fallback
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(form));
    } catch {
      // safe fallback
    }
  }, [form]);

  const load = useCallback(async (force = false) => {
    setState((s) => (s === "live" ? s : "loading"));
    try {
      const res = await fetch(refreshUrl("/api/points/comps", force), { cache: "no-store" });
      const j = await res.json();
      setDiag(j?.diag ?? null);
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

  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, COMPS_POLL_MS);
    return () => clearInterval(t);
  }, [load]);

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

  const targetable = useMemo<CompVenue[]>(() => {
    const seen = new Set(venues.map((v) => v.slug));
    const extra: CompVenue[] = programs
      .filter((p) => !p.venue && !seen.has(p.id))
      .map((p) => ({
        slug: p.id,
        name: p.name,
        logo: p.logo ?? null,
        volume24h: 0,
        volume7d: 0,
        volume30d: 0,
        openInterest: 0,
        fdv: null,
        coingeckoId: null,
      }));
    return [...venues, ...extra];
  }, [venues, programs]);

  const metric: CompMetric =
    windows[form.metric] === false
      ? ((["volume30d", "volume7d", "volume24h", "openInterest"] as CompMetric[]).find((m) => windows[m]) ??
        form.metric)
      : form.metric;

  const explorerTarget = useMemo(() => {
    const chosen = targetable.find((v) => v.slug === form.targetSlug);
    const base = chosen ?? targetable.find((v) => v.fdv === null) ?? targetable[0] ?? null;
    if (!base) return null;
    const manual = num(form.manualVolume?.[base.slug] ?? "");
    return manual > 0 ? { ...base, volume24h: manual } : base;
  }, [targetable, form.targetSlug, form.manualVolume]);

  const explorerMetric = useMemo(() => pickMetricFor(explorerTarget, metric), [explorerTarget, metric]);
  const excluded = useMemo(() => new Set(form.excludedPeers ?? []), [form.excludedPeers]);

  const explorerAllComps = useMemo(
    () => (explorerTarget ? buildComparables(explorerTarget, venues, explorerMetric) : []),
    [explorerTarget, venues, explorerMetric]
  );
  const explorerComps = useMemo(
    () => explorerAllComps.filter((c) => !excluded.has(c.peer.slug)),
    [explorerAllComps, excluded]
  );
  const explorerRange = useMemo(() => compRange(explorerComps), [explorerComps]);

  const views = useMemo(
    () =>
      programs.map((p) => {
        const st = progStateOf(form, p);
        const comps = p.venue ? buildComparables(p.venue, venues, pickMetricFor(p.venue, metric)) : [];
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
        return { program: p, st: { ...st, fdv }, anchor, anchorFdv, range, inputs, value: projectValue(inputs) };
      }),
    [programs, form, venues, metric]
  );

  const activeId = form.analyseId || views[0]?.program.id || "sodex";
  const analysed = views.find((v) => v.program.id === activeId) ?? views[0] ?? null;

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

  const fdvs = useMemo(() => fdvLadder(analysed?.inputs.fdvUsd || 500_000_000), [analysed]);
  const allocs = useMemo(() => [10, 20, 30, 40, 50], []);
  const grid = useMemo(
    () => (analysed ? sensitivityGrid(analysed.inputs, fdvs, allocs, cost.totalCostUsd) : []),
    [analysed, fdvs, allocs, cost.totalCostUsd]
  );
  const beLadder = useMemo(
    () => (analysed ? breakEvenLadder(analysed.inputs, allocs, cost) : []),
    [analysed, allocs, cost]
  );

  /**
   * The live "points analyzed" total. Lifted to here because the calculator
   * produces it and the hero displays it, and they are siblings - a DOM event
   * or a store would be indirection for a single number travelling one level.
   */
  const [analyzedTotal, setAnalyzedTotal] = useState<number | null>(null);

  const handleSelectProgram = (id: string) => {
    set("analyseId", id);
    set("openId", id);
    const el = document.getElementById("calculator-section");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* ── 1. Hero Section ── */}
      <Reveal>
        <PointsHero
          analyzedTotal={analyzedTotal}
          onExplore={() => {
            const el = document.getElementById("featured-programs");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
          onPortfolio={() => {
            const el = document.getElementById("my-airdrops");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
        />
      </Reveal>

      {/* ── 2. Featured Programs Bar ── */}
      {/* ⚠️ `delay` is an INDEX, not seconds. `Reveal` computes its delay as
          `delay * 0.07`, so the `0.05` / `0.1` / `0.15` values this file used
          throughout worked out to 3.5ms, 7ms and 10.5ms - a stagger nobody
          could see, on a page whose cards arrive in pairs. Integers give the
          ladder that was intended. */}
      <Reveal delay={1}>
        <FeaturedProgramsBar
          programs={programs}
          activeId={activeId}
          onSelect={handleSelectProgram}
          onViewAll={() => {
            const el = document.getElementById("my-airdrops");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
        />
      </Reveal>

      {/* ── 3. Main Section: Points Calculator & Farming Economics ── */}
      {/* ⚠️ `items-stretch` plus `h-full` all the way down, and all three links
          in that chain are needed. A grid item stretches by default, but
          `Reveal` inserts a `motion.div` between the column and the card, and
          that wrapper was sizing to its content - so the card inside it ended
          at its own natural height and the two columns finished at different
          places. Farming Economics stopped roughly 80px short of the
          calculator beside it, which is the ragged bottom edge this fixes. */}
      <div
        id="calculator-section"
        className="scroll-mt-32 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12"
      >
        {/* Left: Points Calculator (7 cols) */}
        {analysed && (
          <div className="lg:col-span-7">
            <Reveal delay={2} variant="pop" className="h-full">
              <PointsCalculatorCard
                program={analysed.program}
                programs={programs}
                onSelectProgram={handleSelectProgram}
                onAnalyzed={setAnalyzedTotal}
                yourPoints={analysed.st.yourPoints}
                onYourPointsChange={(v) => setProg(analysed.program.id, "yourPoints", v)}
                totalPoints={analysed.st.totalPoints}
                onTotalPointsChange={(v) => setProg(analysed.program.id, "totalPoints", v)}
                allocPct={analysed.st.allocPct}
                onAllocPctChange={(v) => setProg(analysed.program.id, "allocPct", v)}
                allocLinked={analysed.st.allocLinked}
                onToggleAllocLink={(isLinked) => {
                  setProg(analysed.program.id, "allocLinked", isLinked);
                  if (isLinked) {
                    setProg(analysed.program.id, "allocPct", String(analysed.program.scenario.allocationPctOfSupply));
                  }
                }}
                fdv={analysed.st.fdv}
                onFdvChange={(v) => {
                  setProg(analysed.program.id, "fdv", v);
                }}
                linked={analysed.st.fdvLinked}
                anchor={analysed.anchor}
                anchorFdv={analysed.anchorFdv}
                onToggleLink={(isLinked) => {
                  setProg(analysed.program.id, "fdvLinked", isLinked);
                  if (isLinked && analysed.anchorFdv > 0) {
                    setProg(analysed.program.id, "fdv", String(Math.round(analysed.anchorFdv)));
                  }
                }}
                value={analysed.value}
                range={analysed.range}
              />
            </Reveal>
          </div>
        )}

        {/* Right: Farming Economics (5 cols) */}
        {analysed && (
          <div className="lg:col-span-5">
            <Reveal delay={3} variant="pop" className="h-full">
              <FarmingEconomicsCard
                cost={cost}
                value={analysed.value}
                be={be}
              />
            </Reveal>
          </div>
        )}
      </div>

      {/* ── 4. Middle Section: FDV Simulator & Scenario Analysis ── */}
      {analysed && (
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
          {/* Left: FDV Simulator (6 cols) */}
          <div className="lg:col-span-6">
            <Reveal delay={2} variant="pop" className="h-full">
              <FdvSimulatorCard
                currentFdv={analysed.inputs.fdvUsd}
                onFdvChange={(val) => {
                  setProg(analysed.program.id, "fdvLinked", false);
                  setProg(analysed.program.id, "fdv", val);
                }}
                yourPoints={analysed.inputs.yourPoints}
                totalPoints={analysed.inputs.totalPoolPoints}
                allocationPct={analysed.inputs.allocationPctOfSupply}
                totalSupply={analysed.inputs.totalSupply}
                tgeUnlockPct={analysed.inputs.tgeUnlockPct}
              />
            </Reveal>
          </div>

          {/* Right: Scenario Analysis (6 cols) */}
          <div className="lg:col-span-6">
            <Reveal delay={3} variant="pop" className="h-full">
              <ScenarioAnalysisCard
                yourPoints={analysed.inputs.yourPoints}
                totalPoints={analysed.inputs.totalPoolPoints}
                currentAlloc={analysed.inputs.allocationPctOfSupply}
                currentFdv={analysed.inputs.fdvUsd}
                onSelectScenario={(fdvVal, allocVal) => {
                  setProg(analysed.program.id, "fdvLinked", false);
                  setProg(analysed.program.id, "fdv", String(fdvVal));
                  setProg(analysed.program.id, "allocLinked", false);
                  setProg(analysed.program.id, "allocPct", String(allocVal));
                }}
                programName={analysed.program.name}
              />
            </Reveal>
          </div>
        </div>
      )}

      {/* ── 5. Ongoing perp DEX airdrops ──
          The tracked list, restored. It lived in `ProgramPanel`, which this
          redesign stopped rendering - along with the link to the running
          channel list, which is this page's only pointer to the programmes
          that are NOT hand-tracked here. That link is the answer to "what
          should I farm right now", which is the question the page exists for. */}
      <Reveal delay={2} variant="up">
        <OngoingAirdropsSection
          programs={programs}
          activeId={activeId}
          onSelect={handleSelectProgram}
        />
      </Reveal>

      {/* ── 6. Lower Section: My Airdrops Portfolio & How It Works ── */}
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
        {/* Left: My Airdrops (6 cols) */}
        <div className="lg:col-span-6">
          <Reveal delay={2} variant="pop" className="h-full">
            <MyAirdropsCard
              programs={programs}
              activeId={activeId}
              onSelect={handleSelectProgram}
            />
          </Reveal>
        </div>

        {/* Right: How It Works & Newsletter (6 cols) */}
        <div className="lg:col-span-6">
          <Reveal delay={3} variant="pop" className="h-full">
            <HowItWorksCard />
          </Reveal>
        </div>
      </div>

      {/* ── 6. Advanced Market Intelligence Terminal (Collapsible) ── */}
      <div className="pt-4 border-t border-hairline">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex w-full items-center justify-between rounded-2xl border border-hairline bg-surface-2 p-4 text-left transition-colors hover:border-gold-500/30"
        >
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-gold-500/10 text-gold-300">
              <Terminal className="h-4 w-4" />
            </span>
            <div>
              <div className="font-display text-sm font-bold text-content">
                Live Comparables Terminal
              </div>
              <div className="text-xs text-content-subtle">
                Real-time peer tape, 24h volume benchmarks and market valuations
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-gold-400">
            <span>{showAdvanced ? "Hide Terminal" : "Open Terminal"}</span>
            {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </button>

        {showAdvanced && (
          <div className="mt-6 space-y-8">
            <div id="points-comparables" className="scroll-mt-32">
              <CompsEngine
                venues={targetable}
                target={explorerTarget}
                metric={explorerMetric}
                requestedMetric={form.metric}
                comps={explorerComps}
                range={explorerRange}
                state={state}
                fetchedAt={fetchedAt}
                windows={windows}
                diag={diag}
                onRefresh={() => void load(true)}
                onTarget={(slug) => set("targetSlug", slug)}
                onMetric={(m) => set("metric", m)}
                allComps={explorerAllComps}
                manualVolume={form.manualVolume?.[explorerTarget?.slug ?? ""] ?? ""}
                onManualVolume={(v: string) =>
                  set("manualVolume", { ...(form.manualVolume ?? {}), [explorerTarget?.slug ?? ""]: v })
                }
                excluded={form.excludedPeers ?? []}
                onTogglePeer={(slug: string) =>
                  set(
                    "excludedPeers",
                    (form.excludedPeers ?? []).includes(slug)
                      ? (form.excludedPeers ?? []).filter((s2) => s2 !== slug)
                      : [...(form.excludedPeers ?? []), slug]
                  )
                }
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
