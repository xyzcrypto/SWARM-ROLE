"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { ArrowRight, ArrowUpRight, BarChart2, Loader2, Pencil, Plus, Radio, RefreshCw, Trash2, X } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import { cn, formatDateTime } from "@/lib/utils";
import { refreshUrl } from "@/lib/refetch";
import { wakeIsDue } from "@/lib/useLiveData";
import { RobotIcon } from "@/components/RobotIcon";
import type { RadarItem } from "@modules/points/lib/airdrop-radar";
import { Composer } from "./UpdatesFeed";
import { useRealtime } from "@/lib/useRealtime";
import { CH_POINTS } from "@/lib/realtime-channels";
import { sortUpdates, type PointsUpdateDto } from "@modules/points/lib/points-updates";
import { AirdropBriefModal } from "./AirdropBriefModal";

const RADAR_WINDOW_MS = 120_000;

/**
 * 90s against the route's 120s edge window - shorter, never equal, so jitter
 * cannot decide whether a poll regenerates the route (cost-check, trap 1).
 * Registered in `TARGETS` in `markets-poll-alignment.test.ts`.
 */
export const RADAR_POLL_MS = 90_000;

/** How long each story holds the card before the next one slides in. */
const STORY_ROTATE_MS = 7_000;

/** Stories in the rotation. The rest live behind "View All Updates". */
const MAX_STORIES = 5;

/**
 * One row of the card, from either lane.
 *
 * ⚠️ The desk lane was not here at all, and that is the whole "+ post karta hu
 * lekin card pe show nahi karta" bug. The composer writes to `PointsUpdate` via
 * `/api/points/updates`; this card only ever fetched `/api/points/radar`, the
 * PRESS lane. So a post saved correctly, broadcast correctly, and had nowhere
 * on the page to appear - the redesign had dropped `UpdatesFeed`, which was the
 * only thing that rendered it.
 *
 * `lane` is kept explicit because the two carry different authority: the desk's
 * own word versus an outlet's report. A reader acts on them differently, so it
 * is never left to be inferred from the wording of a headline.
 */
type CardItem = RadarItem & {
  lane: "desk" | "press";
  /** Present on desk rows, so a manager can edit or delete this exact post. */
  post?: PointsUpdateDto;
  pinned?: boolean;
};

/** Desk post -> card row. */
function deskToCard(u: PointsUpdateDto): CardItem {
  return {
    id: `desk-${u.id}`,
    title: u.title,
    url: u.url ?? "",
    summary: u.body,
    source: "XYZ Desk",
    sourceIcon: null,
    publishedAt: new Date(u.createdAt).getTime(),
    category: u.kind,
    image: u.image ?? null,
    venues: u.program ? [u.program] : [],
    lane: "desk",
    post: u,
    pinned: Boolean(u.pinned),
  };
}

interface PointsHeroProps {
  onExplore?: () => void;
  onPortfolio?: () => void;
  /**
   * The live "points analyzed" total, pushed up from the calculator.
   *
   * ⚠️ The hero fetched this once on mount and then never again, so a reader
   * could run calculation after calculation and watch the number sit still -
   * which is most of why it read as invented rather than measured. When this
   * is set it wins, because it is newer than the mount-time fetch.
   */
  analyzedTotal?: number | null;
}

/** Standalone hero news card — matches the right-side of the mockup exactly. */
function HeroNewsCard() {
  const { data: session } = useSession();
  const canManage = hasPermission(session?.user as never, "points:manage");

  const [items, setItems] = useState<RadarItem[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "down">("loading");
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  /** What the route saw upstream, so an empty band can say WHY it is empty. */
  const [diag, setDiag] = useState<{ pool: number; matched: number } | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [composing, setComposing] = useState(false);
  const [viewAll, setViewAll] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [brief, setBrief] = useState<{
    loading: boolean;
    /** Still receiving deltas. Distinct from `loading`, which ends at the first word. */
    streaming: boolean;
    text: string | null;
    err: string | null;
    at: number | null;
  }>({ loading: false, streaming: false, text: null, err: null, at: null });
  const [desk, setDesk] = useState<PointsUpdateDto[]>([]);
  const [editing, setEditing] = useState<PointsUpdateDto | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fetchedAtRef = useRef(0);

  /** The desk lane. Staff also ask for drafts; the route ignores the flag
   *  without the permission rather than 403-ing. */
  const loadDesk = useCallback(async () => {
    try {
      const res = await fetch(`/api/points/updates${canManage ? "?all=1" : ""}`, { cache: "no-store" });
      const j = await res.json();
      if (res.ok && Array.isArray(j.updates)) setDesk(sortUpdates(j.updates));
    } catch {
      // The press lane still renders; a desk outage is not the card's outage.
    }
  }, [canManage]);

  const load = useCallback(async (force = false) => {
    try {
      const res = await fetch(refreshUrl("/api/points/radar", force), { cache: "no-store" });
      const j = await res.json();
      if (res.ok && Array.isArray(j.items)) {
        setItems(j.items);
        /**
         * ⚠️ `live` and `diag` decide the state, not just the array.
         *
         * This used to set "ready" on ANY well-formed response, so an upstream
         * outage - which the route reports as `live: false` with an empty
         * array - rendered identically to a genuinely quiet window. "Nothing
         * happened" and "we could not find out" are different statements, and
         * collapsing them is a lie in the reader's favour. The route already
         * said which it was; this line was throwing that away.
         */
        setDiag(j.diag ?? null);
        setState(j.live === false && !j.items.length ? "down" : "ready");
        const now = Date.now();
        fetchedAtRef.current = now;
        setFetchedAt(now);
      } else {
        setState("down");
      }
    } catch {
      setState("down");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDesk();
  }, [loadDesk]);

  /**
   * A new post appears without a reload. The POST broadcasts on `CH_POINTS`;
   * `useRealtime` subscribes, falls back to a 60s poll only while the channel
   * is DOWN, retries with backoff and refetches on wake - all of which this
   * surface would otherwise have to get right itself.
   */
  useRealtime({ channel: CH_POINTS, event: "points_update", onMessage: () => void loadDesk() });

  /**
   * ⚠️ THE POLL. Its absence is the other half of "stuck".
   *
   * This card fetched once on mount and then only on wake. A reader who left the
   * tab open - which is exactly what someone watching a live feed does - saw the
   * same five stories for as long as the tab stayed focused, however much moved
   * upstream. Nothing was broken; nothing was asking.
   *
   * 90s against the route's 120s edge window, and deliberately NOT equal: equal
   * lets jitter decide whether a poll regenerates the route (cost-check, trap 1).
   * It is the same margin `/api/news` has run since #236, and it costs no
   * upstream traffic - the radar re-reads a cache `/news` already pays for.
   *
   * `document.hidden` short-circuits, so a background tab polls nothing.
   */
  useEffect(() => {
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      void load();
    };
    const id = setInterval(tick, RADAR_POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // Wake refetch when tab comes back into focus
  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState === "hidden") return;
      if (wakeIsDue(Date.now(), fetchedAtRef.current, RADAR_WINDOW_MS)) void load();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [load]);

  /**
   * The carousel advances on its own, which is what makes the card LOOK live
   * between polls. Paused while the briefing or a modal is open, and while
   * there is nothing to rotate.
   */
  const carouselLength = Math.min(desk.length + items.length, MAX_STORIES);
  useEffect(() => {
    if (carouselLength < 2) return;
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      setActiveIdx((i) => (i + 1) % carouselLength);
    }, STORY_ROTATE_MS);
    return () => clearInterval(id);
  }, [carouselLength]);

  const generateBrief = useCallback(async () => {
    const top = items.slice(0, 8);
    if (!top.length || brief.loading) return;
    // Open FIRST, then fetch. The briefing runs on the quality model and can
    // take several seconds; opening on arrival would leave the reader pressing
    // a button that appears to do nothing, which is how the earlier version got
    // reported as broken when it was merely slow.
    setBriefOpen(true);
    setBrief({ loading: true, streaming: true, text: null, err: null, at: null });
    try {
      const res = await fetch("/api/ai/why-matters", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Airdrop & perp DEX roundup",
          summary: top.map((i, n) => `${n + 1}. [${i.source}] ${i.title}${i.summary ? ` — ${i.summary}` : ""}`).join("\n").slice(0, 3800),
          mode: "roundup",
          // ⚠️ Streamed. See the route - "slow" and "incomplete" were one
          // problem, and this is the change that separates them.
          stream: true,
        }),
      });

      // An error still comes back as JSON (the route fails before it streams),
      // so the content type is what says which shape arrived. Guessing from the
      // status alone would try to read an error body as a stream.
      if (!res.ok || !res.body || res.headers.get("content-type")?.includes("application/json")) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Could not generate the briefing.");
      }

      /**
       * Append deltas as they arrive. The panel is readable from the first
       * chunk, which is the whole point - a reader is reading while the rest is
       * still being written, instead of watching a spinner for half a minute.
       *
       * `loading` flips false on the FIRST chunk, not at the end: the spinner's
       * job is over once there are words on screen.
       */
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setBrief({ loading: false, streaming: true, text: acc, err: null, at: Date.now() });
      }
      acc += decoder.decode();

      // An empty stream is a failure that would otherwise render as a blank
      // panel with no explanation.
      if (!acc.trim()) throw new Error("The briefing came back empty. Please try again.");
      setBrief({ loading: false, streaming: false, text: acc, err: null, at: Date.now() });
    } catch (e) {
      setBrief({ loading: false, streaming: false, text: null, err: (e as Error).message, at: null });
    }
  }, [items, brief.loading]);

  /**
   * ⚠️ There is no placeholder story any more, and removing it was the fix.
   *
   * This card used to fall back to a HARD-CODED item titled "Crypto ETF flows:
   * Ether loses $141M as Solana gains $61M" whenever the feed was empty. Three
   * things were wrong with it at once:
   *
   *  - **It was not a perp DEX or airdrop story.** ETF flows are general crypto
   *    news, on a card that promises neither.
   *  - **It carried false metadata to get past the filter**: `category:
   *    "Airdrops"` and `venues: ["Hyperliquid"]` on a story about neither.
   *  - **It was frozen.** `publishedAt` was a fixed epoch, so it always read the
   *    same date no matter when you looked.
   *
   * That is the whole "stuck, and not perp DEX" report: a reader who arrived
   * before the fetch resolved, or whenever it failed, met an invented story that
   * never changed. An empty feed now says it is empty.
   */
  /**
   * Both lanes, in one list. A pinned desk post outranks everything - pinning
   * is the desk saying "this is the thing" - then it is simply newest first,
   * and the desk wins a tie because it is the reviewed lane.
   */
  const merged = useMemo<CardItem[]>(() => {
    const d = desk.map(deskToCard);
    const p: CardItem[] = items.map((i) => ({ ...i, lane: "press" }));
    return [...d, ...p].sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      if (b.publishedAt !== a.publishedAt) return b.publishedAt - a.publishedAt;
      return a.lane === "desk" ? -1 : 1;
    });
  }, [desk, items]);

  const carousel = useMemo(() => merged.slice(0, MAX_STORIES), [merged]);
  const active = carousel[activeIdx % Math.max(carousel.length, 1)] ?? null;
  const rest = merged.slice(1);

  /** Remove a desk post. Confirmed, because it cannot be undone. */
  const removePost = useCallback(async (id: string) => {
    if (busyId) return;
    if (!window.confirm("Delete this update? This cannot be undone.")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/points/updates/${id}`, { method: "DELETE" });
      if (res.ok) await loadDesk();
    } catch {
      // Left in place; the next poll or broadcast reconciles.
    } finally {
      setBusyId(null);
    }
  }, [busyId, loadDesk]);
  const isLive = state === "ready";

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-surface-2 shadow-elevate">
      {/* ── Header row ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-2.5">
        {/* Left: label + freshness */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Radio
            className={`h-3.5 w-3.5 shrink-0 ${isLive ? "text-mint-400" : "text-data-down"}`}
            strokeWidth={2.5}
          />
          <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-mint-400">
            LATEST UPDATES
          </span>
          {/* ⚠️ Both halves were lying. `items.length || 1` printed "1 tracked"
              when the feed was EMPTY, and the timestamp fell back to the string
              "Sep 19, 9:20 AM" - a date hard-coded into the markup, so a card
              that had never successfully fetched anything still claimed to have
              checked at a specific time. That is the single most misleading
              thing a live feed can do, and it is most of why this looked stuck.
              It now says what is true, including "checking…". */}
          <span className="truncate text-[11px] text-content-subtle">
            {desk.length + items.length} tracked · {fetchedAt ? `checked ${formatDateTime(new Date(fetchedAt))}` : "checking…"}
          </span>
        </div>

        {/* Right: action buttons.
            ⚠️ Icon-only, and that is a space decision rather than a style one.
            Three labelled pills ("Post", "AI brief", "Refresh") plus the
            freshness line did not fit this card's header at 393px - the
            "N tracked · checked …" text was being truncated to nothing to make
            room for chrome. Each button keeps `aria-label` and `title`, so the
            name is still there for a screen reader and on hover; only the
            printed word is gone. */}
        <div className="flex shrink-0 items-center gap-1">
          {canManage && (
            <button
              type="button"
              onClick={() => setComposing(true)}
              aria-label="Post an update to the desk"
              title="Post an update"
              className="grid h-7 w-7 place-items-center rounded-lg border border-gold-500/30 bg-gold-500/10 text-gold-300 transition-all duration-200 hover:scale-110 hover:bg-gold-500/20 active:scale-110"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
            </button>
          )}
          <button
            type="button"
            onClick={() => void generateBrief()}
            disabled={brief.loading || items.length === 0}
            aria-label="Generate an AI briefing of these updates"
            title="AI brief"
            className="grid h-7 w-7 place-items-center rounded-lg border border-hairline bg-surface-2 text-content transition-all duration-200 hover:scale-110 hover:border-mint-500/30 active:scale-110 disabled:opacity-40 disabled:hover:scale-100"
          >
            {brief.loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-mint-300" />
            ) : (
              <RobotIcon className="h-4 w-4 text-mint-300" />
            )}
          </button>
          <button
            type="button"
            onClick={() => { void load(true); }}
            aria-label="Refresh the latest updates"
            title="Refresh"
            className="grid h-7 w-7 place-items-center rounded-lg border border-hairline bg-surface-2 text-content transition-all duration-200 hover:scale-110 hover:border-gold-500/30 active:scale-110"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${state === "loading" ? "animate-spin" : ""}`}
              strokeWidth={2}
            />
          </button>
        </div>
      </div>

      {/* ⚠️ The briefing used to render HERE, as a strip capped at `max-h-36`
          with its own scrollbar - about six lines. The model is asked for what
          changed, what it means for farmers, dates to watch and what is still
          unknown; four sections do not fit in six lines, so a complete answer
          met a scroll region nested inside a card inside the hero. It now takes
          the foreground instead. See `AirdropBriefModal`.

          A one-line trace stays behind so the card still shows that a briefing
          exists once it has been generated - reopening it should not mean
          paying for it twice. */}
      {(brief.text || brief.err) && !briefOpen && (
        <button
          type="button"
          onClick={() => setBriefOpen(true)}
          className="flex w-full items-center gap-2 border-b border-hairline bg-mint-500/[0.05] px-4 py-2 text-left transition-colors hover:bg-mint-500/[0.09]"
        >
          <RobotIcon className="h-3.5 w-3.5 shrink-0 text-mint-300" />
          <span className="truncate text-[11px] font-medium text-content">
            {brief.err ? "The briefing did not finish" : "Your AI briefing is ready"}
          </span>
          <span className="ml-auto shrink-0 text-[11px] font-semibold text-gold-300">Open</span>
        </button>
      )}

      {/* ── Nothing to show ─────────────────────────────────────────────
          An honest state, which is what replaced the invented story. Loading
          and empty and unreachable are three different things and each says so
          - collapsing them is what let a broken feed look like a quiet one. */}
      {!active && (
        <div className="px-4 py-10 text-center">
          {state === "loading" ? (
            <>
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-content-subtle" strokeWidth={1.7} />
              <p className="mt-2.5 text-xs text-content-muted">Checking the perp DEX and airdrop feeds…</p>
            </>
          ) : state === "down" ? (
            <>
              <p className="text-xs leading-relaxed text-amber-200">
                Could not reach the updates feed just now.
              </p>
              <button
                type="button"
                onClick={() => void load(true)}
                className="btn-secondary mt-3 inline-flex min-h-9 items-center text-xs"
              >
                Try again
              </button>
            </>
          ) : (
            <>
              <Radio className="mx-auto h-5 w-5 text-content-subtle" strokeWidth={1.7} />
              <p className="mt-2.5 text-xs text-content-muted">
                No perp DEX or airdrop news in the last window.
              </p>
              <p className="mt-1 text-[11px] text-content-subtle">
                Snapshots, TGE dates and new programmes land here the moment they are reported.
              </p>
              {/* ⚠️ Says what it looked at. "Nothing matched out of 0 stories"
                  is an outage; "nothing matched out of 340" is a quiet hour.
                  Those needed telling apart from the page itself, because the
                  last two bugs here were both diagnosed only once production
                  could state its own case. */}
              {diag && (
                <p className="mono mt-2 text-[10px] text-content-subtle">
                  checked {diag.pool.toLocaleString("en-US")} stories
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Story card body ─────────────────────────────────────────────── */}
      {active && (
      <div className="p-4">
        {/* Source row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {/* Source icon / fallback circle */}
            {active.sourceIcon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={active.sourceIcon}
                alt={active.source}
                className="h-4 w-4 shrink-0 rounded-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-sky-400/30 bg-sky-500/20 text-[9px] font-bold text-sky-400">
                C
              </span>
            )}
            <span className="truncate text-xs font-semibold text-content-muted">
              {active.source}
            </span>
            {/* Venue pill */}
            {/* ⚠️ The lane is always visible. The desk's own word and an
                outlet's report are different claims and a reader acts on them
                differently, so it is never left to be inferred. */}
            {active.lane === "desk" && (
              <span className="shrink-0 rounded-full border border-mint-500/40 bg-mint-500/10 px-2 py-0.5 text-[10px] font-semibold text-mint-200">
                Desk
              </span>
            )}
            <span className="shrink-0 rounded-full border border-gold-500/40 bg-gold-500/10 px-2 py-0.5 text-[10px] font-semibold text-gold-200">
              {active.venues[0] ?? active.category}
            </span>
          </div>
          <span className="shrink-0 text-[11px] text-content-subtle">
            {formatDateTime(new Date(active.publishedAt))}
          </span>
        </div>

        {/* Title */}
        <h3 className="mt-1.5 line-clamp-2 text-sm font-bold leading-snug text-content sm:text-[15px]">
          {active.title}
        </h3>

        {/* Banner image — 110px fixed height, arrow on the right */}
        {/* Parent is position:relative with fixed height; img is absolute-inset so it can never push the parent taller */}
        <div
          className="group/img relative mt-2.5 w-full overflow-hidden rounded-xl border border-hairline bg-ink-950/40"
          style={{ height: 110 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={active.image ?? "/images/crypto-banner.png"}
            alt={active.title}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/images/crypto-banner.png";
            }}
          />
          {/* Right-side next-story arrow — matches mockup */}
          <button
            type="button"
            onClick={() => setActiveIdx((prev) => (prev + 1) % carousel.length)}
            aria-label="Next story"
            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", zIndex: 10 }}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-black/70 text-white shadow-xl backdrop-blur-md transition-all hover:scale-105 active:scale-105 hover:bg-black/90 active:bg-black/90"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Body snippet */}
        <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-content-muted">
          {active.summary}
        </p>

        {/* Attribution */}
        <p className="mt-1 text-[11px] text-content-subtle">
          Reported by {active.source} · {active.source}
        </p>

        {/* ── Action bar ──────────────────────────────────────────────────── */}
        <div className="mt-3 flex items-center justify-between gap-2">
          {/* Read link */}
          {active.url ? (
            <a
              href={`/news/read?u=${encodeURIComponent(active.url)}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/[0.08] px-3.5 py-1.5 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/20"
            >
              Read the full story here
              <ArrowRight className="h-3 w-3" />
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/[0.08] px-3.5 py-1.5 text-xs font-semibold text-amber-300">
              Read the full story here
              <ArrowRight className="h-3 w-3" />
            </span>
          )}

          {/* ⚠️ One dot per story, not a fixed five. Hard-coded [0..4] drew
              five dots over two stories, and clicking a dot with no story
              behind it moved nothing - a control that visibly does nothing. */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: carouselLength }, (_, i) => i).map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveIdx(i)}
                aria-label={`Story ${i + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${activeIdx === i ? "w-5 bg-gold-400" : "w-2 bg-ink-500 hover:bg-ink-600"
                  }`}
              />
            ))}
          </div>

          {/* ⚠️ Edit and delete live on the row itself, not in a separate admin
              screen. The ask was "post karne ke baad edit or delete kar saku" -
              after posting - and the moment you notice a typo is while you are
              looking at the post, not after navigating somewhere else. */}
          {canManage && active.lane === "desk" && active.post && (
            <span className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setEditing(active.post!)}
                aria-label="Edit this update"
                title="Edit"
                className="grid h-7 w-7 place-items-center rounded-lg border border-hairline text-content-subtle transition-all hover:scale-110 hover:border-gold-500/30 hover:text-content active:scale-110"
              >
                <Pencil className="h-3 w-3" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => void removePost(active.post!.id)}
                disabled={busyId === active.post.id}
                aria-label="Delete this update"
                title="Delete"
                className="grid h-7 w-7 place-items-center rounded-lg border border-hairline text-content-subtle transition-all hover:scale-110 hover:border-data-down hover:text-data-down active:scale-110 disabled:opacity-50"
              >
                {busyId === active.post.id
                  ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
                  : <Trash2 className="h-3 w-3" strokeWidth={2} />}
              </button>
            </span>
          )}

          {/* View All Updates */}
          <button
            type="button"
            onClick={() => setViewAll(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 transition-colors hover:text-amber-300"
          >
            View All Updates
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

      </div>
      )}

      {/* ── View All modal ──────────────────────────────────────────────── */}
      {viewAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="animate-rise-in glass flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-gold-500/20 shadow-elevate">
            <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
              <div>
                <h3 className="font-display text-base font-bold text-content">All updates &amp; <span className="text-shine">signals</span></h3>
                {rest.length > 0 && (
                  <p className="mt-0.5 text-xs text-content-subtle">{rest.length} more updates</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setViewAll(false)}
                className="grid h-9 w-9 place-items-center rounded-xl border border-hairline text-content-subtle transition-all hover:scale-105 hover:border-gold-500/30 hover:text-content active:scale-105"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 divide-y divide-hairline overflow-y-auto">
              {items.map((item) => (
                <a
                  key={item.id}
                  href={`/news/read?u=${encodeURIComponent(item.url)}`}
                  className="flex gap-3 p-4 transition-colors hover:bg-white/[0.04]"
                >
                  {item.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image}
                      alt=""
                      className="h-12 w-16 shrink-0 rounded-lg object-cover"
                      loading="lazy"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-xs font-semibold leading-snug text-content">
                      {item.title}
                    </p>
                    <p className="mt-1 text-[11px] text-content-subtle">
                      {item.source} · {formatDateTime(new Date(item.publishedAt))}
                    </p>
                  </div>
                </a>
              ))}
              {items.length === 0 && (
                <p className="p-6 text-center text-sm text-content-subtle">
                  {state === "loading" ? "Loading…" : "No updates right now."}
                </p>
              )}
            </div>
            <div className="flex justify-end border-t border-hairline px-5 py-3">
              <button
                type="button"
                onClick={() => setViewAll(false)}
                className="btn-secondary inline-flex min-h-9 items-center text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI briefing, full foreground ────────────────────────────────── */}
      <AirdropBriefModal
        open={briefOpen}
        onClose={() => setBriefOpen(false)}
        loading={brief.loading}
        streaming={brief.streaming}
        text={brief.text}
        error={brief.err}
        sources={items.slice(0, 8)}
        generatedAt={brief.at}
        onRetry={() => void generateBrief()}
      />

      {/* ── Admin Composer modal ────────────────────────────────────────── */}
      {canManage && (composing || editing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="animate-rise-in glass max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-gold-500/20 shadow-elevate">
            <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
              <h3 className="font-display text-base font-bold text-content">
                {editing ? "Edit this " : "Post to the "}<span className="text-shine">desk wire</span>
              </h3>
              <button
                type="button"
                onClick={() => { setComposing(false); setEditing(null); }}
                className="grid h-9 w-9 place-items-center rounded-xl border border-hairline text-content-subtle transition-all hover:scale-105 hover:border-gold-500/30 hover:text-content active:scale-105"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              <Composer
                // `key` forces a fresh form per post: the fields are seeded
                // once on mount, so without it, editing a second post would
                // keep the first one's text.
                key={editing?.id ?? "new"}
                edit={editing ?? undefined}
                onPosted={() => {
                  setComposing(false);
                  setEditing(null);
                  void loadDesk();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PointsHero({ onExplore, onPortfolio, analyzedTotal }: PointsHeroProps) {
  const [isDark, setIsDark] = useState(false);
  const [stats, setStats] = useState<{
    trackedProtocols: number;
    pointsAnalyzed: number;
    activeUsers: number;
  }>({
    trackedProtocols: 3,
    pointsAnalyzed: 12400000,
    activeUsers: 1,
  });

  useEffect(() => {
    // This project uses class-based dark mode: `dark` class on <html>
    const html = document.documentElement;
    setIsDark(html.classList.contains("dark"));

    const observer = new MutationObserver(() => {
      setIsDark(html.classList.contains("dark"));
    });
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });

    // Fetch live platform metrics
    let unmounted = false;
    fetch("/api/points/stats")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!unmounted && data) {
          setStats({
            trackedProtocols: data.trackedProtocols ?? 3,
            pointsAnalyzed: data.pointsAnalyzed ?? 12400000,
            activeUsers: data.activeUsers ?? 1,
          });
        }
      })
      .catch(() => {});

    return () => {
      unmounted = true;
      observer.disconnect();
    };
  }, []);

  /**
   * ⚠️ No `$`. This counts POINTS, not dollars - the label right under it says
   * "Points Analyzed" - and it was rendering "$12.4M+", which reads as a sum of
   * money and sat beside "Active Users" and "Tracked Protocols" as though all
   * three were the same kind of measurement. A currency symbol on a unit that
   * is not currency is a wrong number even when the digits are right.
   *
   * `+` only once there is enough to round, because "0+" is nonsense, and a
   * fresh counter legitimately starts at zero now that the fabricated seed is
   * gone. `en-US` is pinned: `en-IN` groups digits differently from 10,000 up,
   * and an unpinned locale is a hydration mismatch waiting to happen.
   */
  const formatPointsAnalyzed = (num: number) => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B+`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M+`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}k+`;
    return num.toLocaleString("en-US");
  };

  const formatUsers = (num: number) => {
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M+`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(0)}K+`;
    return `${num}+`;
  };

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-hairline bg-gradient-to-b from-surface-2 via-surface-2 to-base p-6 sm:p-8 lg:p-10">
      {/* Background ambient radial glows. ⚠️ Two, not a stack - the design
          system's warning is that this palette drifts from restrained to cheap
          through piled-up blur orbs, so the depth below comes from the
          medallion and the motion rather than more light. */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-gold-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-1/4 h-80 w-80 rounded-full bg-gold-400/5 blur-3xl" />

      <div className="relative grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-10">
        {/* Left Column: Headline & Action.
            ⚠️ `space-y-5`, down from 6. Six steps of 24px between eyebrow,
            heading, copy, buttons and the stat rail added up to more vertical
            air than the content, which is the "gap" that made this look
            unfinished on a 393px screen. */}
        <div className="lg:col-span-7 space-y-5">
          {/* ── Eyebrow rail + the 3D mark ────────────────────────────────
              ⚠️ The medallion lives HERE, on the eyebrow's row, and that is
              the gap fix rather than a decoration bolted on.

              At 393px this row held one short badge and roughly 240px of empty
              gradient to its right - the single largest piece of dead space in
              the hero, and what made the block read as loose rather than
              composed. An absolutely-positioned mark in the corner would have
              filled it too, but it would have sat UNDER the headline's second
              line at some widths, and a decoration that collides with the
              title is worse than the gap.

              On the row, it is laid out: nothing overlaps, nothing reflows
              unexpectedly, and the row now has weight at both ends. */}
          <div className="flex items-center justify-between gap-4">
          <span className="eyebrow eyebrow-glass inline-flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-400/80" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint-400" />
            </span>
            <span className="mono font-mono text-[10px] font-semibold uppercase tracking-[0.16em] sm:text-[11px]">
              <span className="text-[#fdf7e7]">Airdrop</span>{" "}
              <span className="text-shine">Farming</span>
            </span>
          </span>

          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h1 className="font-display text-4xl font-bold tracking-tight text-content sm:text-5xl lg:text-6xl">
              Points <span className="text-shine">Intelligence</span>
            </h1>
            <p
              className="max-w-xl text-sm leading-relaxed sm:text-base"
              style={{ color: isDark ? "#e5e7eb" : "#111827", textDecoration: "none" }}
            >
              Track points, estimate value, calculate farming costs and make smarter decisions across all major airdrop programs.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => (onExplore ? onExplore() : scrollTo("featured-programs"))}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-gold-400 via-gold-500 to-amber-500 px-6 py-2.5 text-xs font-bold text-black shadow-lg shadow-gold-500/20 transition-all hover:scale-[1.02] hover:shadow-gold-500/30 active:scale-[0.98]"
            >
              Explore Programs
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => (onPortfolio ? onPortfolio() : scrollTo("my-airdrops"))}
              className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-2 px-5 py-2.5 text-xs font-semibold text-content transition-all hover:border-gold-500/30 hover:bg-white/5 active:scale-[0.98]"
            >
              <BarChart2 className="h-3.5 w-3.5 text-gold-400" />
              My Portfolio
            </button>
          </div>

          {/* ── The stat row ──────────────────────────────────────────────
              ⚠️ Rebuilt as CARDS on a divided rail rather than four bare
              numbers on a 2x2 grid. At 393px the old version left a column of
              loose figures floating over the hero's gradient with nothing
              holding them together, and the eye read them as four unrelated
              items rather than one summary. Each one now has a surface, the
              numbers keep the mono ramp they should have had, and they land in
              sequence so the row assembles rather than appearing. */}
          <div className="grid grid-cols-2 gap-2.5 border-t border-hairline pt-4 sm:grid-cols-4 sm:gap-3">
            {[
              { v: String(stats.trackedProtocols), l: "Tracked Protocols", mono: false, dot: false },
              { v: formatPointsAnalyzed(analyzedTotal ?? stats.pointsAnalyzed), l: "Points Analyzed", mono: true, dot: false },
              { v: formatUsers(stats.activeUsers), l: "Active Users", mono: true, dot: false },
              { v: "Real-time", l: "Data Updates", mono: false, dot: true },
            ].map((s, n) => (
              <div
                key={s.l}
                style={{ animationDelay: `${n * 70}ms` }}
                className="animate-rise-in rounded-xl border border-hairline bg-base px-3 py-2.5 transition-colors hover:border-gold-500/25"
              >
                <div
                  className={cn(
                    "flex items-center gap-1.5 text-xl font-bold tracking-tight text-content sm:text-2xl",
                    s.mono ? "mono" : "font-display"
                  )}
                >
                  {s.dot && (
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-400/70" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-mint-400" />
                    </span>
                  )}
                  <span className="truncate">{s.v}</span>
                </div>
                <div className="mt-0.5 text-[11px] text-content-subtle">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Live News Card */}
        <div className="lg:col-span-5">
          <HeroNewsCard />
        </div>
      </div>
    </div>
  );
}
