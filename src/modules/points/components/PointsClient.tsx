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
  type CompMetric,
  type CompVenue,
} from "@modules/points/lib/points";
import { buildPrograms, scenarioFdv, sortPrograms, type ProgramView } from "@modules/points/lib/programs";
import { PointsNav, type NavSection } from "./PointsNav";
import { ProgramPanel } from "./ProgramPanel";
import { ProgramSection } from "./ProgramSection";
import { UpdatesFeed } from "./UpdatesFeed";
import { CompsEngine } from "./CompsEngine";
import { CostPanel } from "./CostPanel";
import { SensitivityGrid } from "./SensitivityGrid";
import { LiveWire } from "./LiveWire";

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
  /** Which programme section is expanded. One at a time, deliberately: the
   *  complaint this answers is "bahut scroll karna padta hai", and an accordion
   *  that can open everything is the same page again. */
  openId: string;
  /** Peer slugs the reader has switched OFF. A comparable set is a judgement,
   *  not a fact: a peer the reader considers a bad analogue should not silently
   *  keep dragging the median. Stored so the judgement survives a reload. */
  excludedPeers: string[];
  /**
   * 24h volume the reader supplied for a venue no feed reports, keyed by slug.
   *
   * ⚠️ The tracked programmes - Variational, Sodex, RiseX, Pacifica - are the
   * whole reason this page exists, and NOT ONE of them appears in DefiLlama's
   * derivatives overview or CoinGecko's exchange list. They are too new. So the
   * comparables engine, which needs the target's own volume to form a ratio,
   * could never price the venues the reader actually came to price.
   *
   * There is no honest way to invent that number, so the reader supplies it and
   * the engine does the rest against real peers. It is labelled as their input
   * everywhere it appears.
   */
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
  analyseId: "",
  openId: "",
  excludedPeers: [],
  manualVolume: {},
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

/**
 * How often the comparables refresh on their own.
 *
 * ⚠️ 300s against the route's 320s window, and both numbers are load-bearing.
 * Polling FASTER than the window means the window expires before each poll and
 * every tick from every open tab regenerates the route - ISR Writes and Fluid
 * Active CPU, trap 1 in the cost-check skill, which has already produced a real
 * incident on this project twice (`/news` at 560 writes against 166 reads).
 * Equal is not safe either: the window expires exactly as the poll lands and
 * jitter decides. 300/320 is the same margin `/api/markets/{dex,yields}` run.
 *
 * ⚠️ The route file used to say "NOT POLLED - if a poll is ever added, add it to
 * TARGETS in markets-poll-alignment.test.ts". This is that poll, and it is
 * registered there. Change this number and that test tells you what else moves.
 */
export const COMPS_POLL_MS = 300_000;

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
  // Shape mirrors the route's `diag`. `source` says which upstream actually
  // produced the venue list, which is the first question when a number looks off.
  const [diag, setDiag] = useState<any>(null);
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

  /**
   * `force` is passed by the Refresh BUTTON only.
   *
   * ⚠️ `cache: "no-store"` alone was not a refresh. It tells the browser not to
   * use its own HTTP cache and says nothing to the Vercel edge, which kept
   * serving the same body for the rest of its 320s window - so pressing Refresh
   * re-rendered identical numbers behind a spinner. A distinct URL is a distinct
   * edge key; `refreshUrl` mints one, throttled so the button cannot be held
   * down into a stream of origin hits.
   */
  const load = useCallback(async (force = false) => {
    setState((s) => (s === "live" ? s : "loading"));
    try {
      const res = await fetch(refreshUrl("/api/points/comps", force), { cache: "no-store" });
      const j = await res.json();
      // Kept whatever the outcome: the diagnosis matters most when the list is
      // empty, which is exactly when the success branch does not run.
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

  // The panel refreshes itself while you are reading it. Without this "live"
  // meant "live as of whenever the page loaded", which for a page people leave
  // open next to a terminal is not live at all.
  //
  // Hidden tabs are skipped: a backgrounded tab refreshing on a timer is pure
  // cost for something nobody is looking at, and the wake handler below covers
  // the moment it comes back.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, COMPS_POLL_MS);
    return () => clearInterval(t);
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

  /**
   * Every venue the explorer may target: the live feed, plus each tracked
   * programme the feed does not carry.
   *
   * A tracked programme enters with volume 0 and `fdv: null` - honest, and
   * enough to appear in the picker. Its volume arrives from the reader.
   */
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
    const chosen = targetable.find((v) => v.slug === form.targetSlug);
    const base = chosen ?? targetable.find((v) => v.fdv === null) ?? targetable[0] ?? null;
    if (!base) return null;
    // A reader-supplied volume overrides whatever the feed said (usually
    // nothing). Applied here, once, so every downstream calculation sees one
    // consistent target rather than each panel re-deciding.
    const manual = num(form.manualVolume?.[base.slug] ?? "");
    return manual > 0 ? { ...base, volume24h: manual } : base;
  }, [targetable, form.targetSlug, form.manualVolume]);

  // ⚠️ Per TARGET, not per response. `metric` above only knows whether ANY
  // venue populated a window; this knows whether THIS venue did, which is the
  // question `buildComparables` actually asks before returning an empty set.
  const explorerMetric = useMemo(() => pickMetricFor(explorerTarget, metric), [explorerTarget, metric]);

  const excluded = useMemo(() => new Set(form.excludedPeers ?? []), [form.excludedPeers]);

  /** Every peer the data supports, before the reader's own judgement is applied. */
  const explorerAllComps = useMemo(
    () => (explorerTarget ? buildComparables(explorerTarget, venues, explorerMetric) : []),
    [explorerTarget, venues, explorerMetric]
  );
  const explorerComps = useMemo(
    () => explorerAllComps.filter((c) => !excluded.has(c.peer.slug)),
    [explorerAllComps, excluded]
  );
  const explorerRange = useMemo(() => compRange(explorerComps), [explorerComps]);

  /** Everything one programme section needs, including its own FDV anchor. */
  const views = useMemo(
    () =>
      programs.map((p) => {
        const st = progStateOf(form, p);
        // Same per-target rule as the explorer: a tracked programme's venue is
        // usually the youngest one on the page, so it is the most likely to be
        // missing the widest window.
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
        // `range` travels with the view so the outcome grid can show the whole
        // band the market implies, not just its midpoint. The low and the high
        // are the disagreement between peers, and the width of that
        // disagreement is usually the finding.
        return { program: p, st: { ...st, fdv }, anchor, anchorFdv, range, inputs, value: projectValue(inputs) };
      }),
    [programs, form, venues, metric]
  );

  // Default to the first programme rather than nothing: a page of entirely
  // collapsed rows gives a reader no idea what opening one would show.
  const openId = form.openId || views[0]?.program.id || "";

  const navSections: NavSection[] = useMemo(
    () => [
      { id: "points-desk", label: "Desk" },
      { id: "points-tracked", label: "Tracked" },
      { id: "points-comparables", label: "Comparables" },
      ...views.map((v) => ({ id: `programme-${v.program.id}`, label: v.program.name })),
      { id: "points-cost", label: "Cost" },
      { id: "points-outcomes", label: "Outcomes" },
    ],
    [views]
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
  // The contour, not just the corners: what FDV each allocation needs to have
  // been worth doing. Recomputed with the live anchor, like everything else.
  const beLadder = useMemo(
    () => (analysed ? breakEvenLadder(analysed.inputs, allocs, cost) : []),
    [analysed, allocs, cost]
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ⚠️ ABOVE the nav, and outside the section list.
          "What changed today" is the question a returning farmer opens this page
          with, and it used to be answered in two places a full screen apart -
          the desk at the top, the press feed at the very bottom. One band, both
          lanes, before anything the reader has to navigate to. */}
      <LiveWire />

      <PointsNav sections={navSections} />

      <Reveal>
        <div id="points-desk" className="scroll-mt-32">
          <UpdatesFeed />
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <div id="points-tracked" className="scroll-mt-32">
          <ProgramPanel programs={programs} />
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <div id="points-comparables" className="scroll-mt-32">
        <CompsEngine
          venues={targetable}
          target={explorerTarget}
          metric={explorerMetric}
          // What the reader asked for, so the panel can say when it had to
          // widen out - a silently different window is how a number becomes
          // untrustworthy without ever looking wrong.
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
            open={openId === v.program.id}
            // Toggling closed leaves nothing open, which is a legitimate state:
            // a reader who has finished with all three wants the short page.
            onToggle={() => set("openId", openId === v.program.id ? "__none__" : v.program.id)}
          />
        </Reveal>
      ))}

      {analysed && be && (
        <>
          <Reveal>
            <div id="points-cost" className="scroll-mt-32">
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
            </div>
          </Reveal>

          <Reveal delay={0.05}>
            <div id="points-outcomes" className="scroll-mt-32">
            <SensitivityGrid
              grid={grid}
              fdvs={fdvs}
              allocs={allocs}
              currentFdv={analysed.inputs.fdvUsd}
              currentAlloc={analysed.inputs.allocationPctOfSupply}
              totalCostUsd={cost.totalCostUsd}
              programName={analysed.program.name}
              // What the grid is anchored to, and how fresh that is. `anchor`
              // is "comps" only when live comparables actually produced a
              // median, so an empty upstream shows no live marks at all rather
              // than dressing a fallback up as live.
              liveFdv={analysed.anchorFdv}
              liveLabel={analysed.anchor === "comps" ? "live peer median" : "published scenario"}
              // Only comps are live. A registry scenario wearing a "Live" chip
              // is the exact dishonesty this page exists to argue against.
              anchorIsLive={analysed.anchor === "comps"}
              // The band, only when it came from real comparables. A published
              // scenario has no low/high and must not be dressed in one.
              liveLow={analysed.anchor === "comps" ? analysed.range.low : 0}
              liveHigh={analysed.anchor === "comps" ? analysed.range.high : 0}
              livePeers={analysed.anchor === "comps" ? analysed.range.count : 0}
              fetchedAt={analysed.anchor === "comps" ? fetchedAt : null}
              breakEvenFdvs={beLadder}
              linked={Boolean(analysed.st.fdvLinked)}
              onRelink={() => setProg(analysed.program.id, "fdvLinked", true)}
              onPick={(fdv, alloc) => {
                // Clicking a cell adopts that scenario: the grid stops being a
                // table you read and becomes a control you steer with.
                setProg(analysed.program.id, "fdvLinked", false);
                setProg(analysed.program.id, "fdv", String(Math.round(fdv)));
                setProg(analysed.program.id, "allocPct", String(alloc));
              }}
            />
            </div>
          </Reveal>
        </>
      )}

    </div>
  );
}
