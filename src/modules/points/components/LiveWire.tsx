"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { ChevronDown, ExternalLink, Loader2, Pin, Radio, RefreshCw, X } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";
import { useRealtime } from "@/lib/useRealtime";
import { CH_POINTS } from "@/lib/realtime-channels";
import { wakeIsDue } from "@/lib/useLiveData";
import { refreshUrl } from "@/lib/refetch";
import { MarkdownLite } from "@/components/MarkdownLite";
import { RobotIcon } from "@/components/RobotIcon";
import { KIND_LABEL, KIND_TONE, sortUpdates, type PointsUpdateDto } from "@modules/points/lib/points-updates";
import type { RadarItem } from "@modules/points/lib/airdrop-radar";

const RADAR_WINDOW_MS = 120_000;

/**
 * How often the press lane refreshes on its own.
 *
 * ⚠️ 90s against the route's 120s window, which is the SAME margin `/api/news`
 * has run in production since #236. Polling faster than the window means the
 * window expires before every poll and each tick from each open tab regenerates
 * the route - trap 1 in the cost-check skill, and the shape that produced this
 * project's worst write ratio (`/news` at 560 writes against 166 reads) when it
 * was briefly set equal.
 *
 * ⚠️ Registered in `TARGETS` in markets-poll-alignment.test.ts. The desk lane
 * needs no poll: it broadcasts on write and `useRealtime` already carries a
 * fallback. This is the lane that had no live path at all.
 */
export const RADAR_POLL_MS = 90_000;
const STORE_KEY = "xyz.points.wire.open";

/**
 * The wire: one live band at the top of the page, two lanes inside it.
 *
 * ## Why it is one component and not two panels
 *
 * The desk's own posts sat at the top of the page and the press feed sat at the
 * bottom, and both were full-height panels. A reader looking for "what changed
 * today" had to check two places a screen apart, and on a phone the second one
 * was past six other sections. They answer the same question, so they are one
 * band now, above everything else.
 *
 * ## The two lanes stay distinguishable
 *
 * They carry different authority and must never be confused:
 *
 * - **Desk** - written by the team. Few, exact, accountable to a person, and
 *   able to be pinned.
 * - **Press** - picked up automatically from the outlets this site follows.
 *   Many, unreviewed, and only as good as the outlet.
 *
 * Every row says which it is. A press item is never presented as the desk's own
 * word, because "we are telling you" and "someone reported" are different
 * claims and a farmer acts differently on each.
 *
 * ## Why one item is promoted
 *
 * A list of twelve equal rows has no answer to "what matters right now". The
 * top item is rendered as a banner and the rest fold behind a count, so the
 * band costs one line of attention when nothing is urgent and earns more when
 * something is.
 *
 * ## X / Twitter
 *
 * ⚠️ There is no free X API, and scraping a logged-out timeline returns
 * something different every week. Reading an outlet that quotes X and calling it
 * "from X" would be a false claim about sourcing. So X appears here the honest
 * way: when the desk posts a link to a tweet, the row is badged with its host.
 * The desk lane is where a specific tweet belongs, with a person behind it.
 */

type WireItem = {
  id: string;
  lane: "desk" | "press";
  title: string;
  body: string;
  url: string | null;
  /** Who is making the claim: the desk, or a named outlet. */
  source: string;
  sourceIcon: string | null;
  at: number;
  /** Desk kind ("snapshot", "tge", ...) or press category. */
  tag: string;
  tone: string | null;
  pinned: boolean;
  venues: string[];
  /** Cover image, desk lane only. */
  image: string | null;
};

/** Host of a URL, for badging a desk link with where it points. */
function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Where a row should take the reader.
 *
 * ⚠️ A press item links to `/news/read`, NOT to the outlet. The site already has
 * a reader that renders the story with its own briefing, and sending someone off
 * to coingape.com mid-session is losing them to answer a question this site can
 * answer better. The outlet is still named and still one tap away from there.
 *
 * A DESK link is different and stays external: the desk chose that URL - usually
 * a tweet or a Telegram post - and there is nothing to render on-site for it.
 */
function readHref(item: WireItem): string | null {
  if (!item.url) return null;
  if (item.lane === "desk") return item.url;
  return `/news/read?u=${encodeURIComponent(item.url)}`;
}

/** Whether following this row leaves the site. */
function leavesSite(item: WireItem): boolean {
  return item.lane === "desk" && Boolean(item.url);
}

/** X links are worth naming as X rather than as a hostname. */
function prettyHost(host: string | null): string | null {
  if (!host) return null;
  if (host === "x.com" || host === "twitter.com") return "X";
  if (host === "t.me") return "Telegram";
  return host;
}

export function LiveWire() {
  const { data: session } = useSession();
  const canManage = hasPermission(session?.user as never, "points:manage");

  const [desk, setDesk] = useState<PointsUpdateDto[]>([]);
  const [press, setPress] = useState<RadarItem[]>([]);
  const [deskState, setDeskState] = useState<"loading" | "ready" | "down">("loading");
  const [pressState, setPressState] = useState<"loading" | "ready" | "down">("loading");
  const [open, setOpen] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  /** "all" | "x" - narrow the band to items that link to X/Twitter. */
  const [lens, setLens] = useState<"all" | "x">("all");
  /** Show every item rather than the first dozen. */
  const [showAll, setShowAll] = useState(false);
  /**
   * Items that arrived since the reader last looked.
   *
   * ⚠️ New rows are NOT spliced in silently. A live feed that reflows under
   * someone mid-sentence is worse than a stale one: they lose their place and
   * learn not to trust the list. So an arrival raises a count, and the reader
   * decides when the list moves.
   */
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const seenRef = useRef<Set<string> | null>(null);
  const [brief, setBrief] = useState<{
    loading: boolean;
    text: string | null;
    err: string | null;
    meta?: { model?: string; cached?: boolean; continued?: boolean; truncated?: boolean } | null;
  }>({
    loading: false,
    text: null,
    err: null,
  });
  const pressAtRef = useRef(0);

  // ⚠️ Restored in an effect. A localStorage value reaching the DOM during the
  // first render is the React #418 trap documented in CLAUDE.md.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw !== null) setOpen(raw === "1");
    } catch {
      // Blocked storage: closed is a fine default.
    }
  }, []);

  const toggle = useCallback(() => {
    setOpen((v) => {
      try {
        localStorage.setItem(STORE_KEY, v ? "0" : "1");
      } catch {
        // Never let storage break the control.
      }
      return !v;
    });
  }, []);

  const loadDesk = useCallback(async (force = false) => {
    try {
      const res = await fetch(refreshUrl(`/api/points/updates${canManage ? "?all=1" : ""}`, force), { cache: "no-store" });
      const j = await res.json();
      if (res.ok && Array.isArray(j.updates)) {
        setDesk(sortUpdates(j.updates));
        setDeskState("ready");
      } else setDeskState("down");
    } catch {
      setDeskState("down");
    }
  }, [canManage]);

  const loadPress = useCallback(async (force = false) => {
    try {
      const res = await fetch(refreshUrl("/api/points/radar", force), { cache: "no-store" });
      const j = await res.json();
      if (res.ok && Array.isArray(j.items)) {
        setPress(j.items);
        setPressState("ready");
        pressAtRef.current = Date.now();
        setFetchedAt(Date.now());
      } else setPressState("down");
    } catch {
      setPressState("down");
    }
  }, []);

  useEffect(() => {
    void loadDesk();
    void loadPress();
  }, [loadDesk, loadPress]);

  // The desk lane is genuinely realtime: a post broadcasts and every open page
  // refetches. `useRealtime` carries the retry-with-backoff, the armed fallback
  // poll and the wake refetch that seven other surfaces needed and that this one
  // would otherwise get wrong the same way they did.
  useRealtime({ channel: CH_POINTS, event: "points_update", onMessage: () => void loadDesk() });

  // ⚠️ The press lane had NO live path - mount and wake only. The desk lane
  // broadcast on write, so half the band was live and half was as old as the
  // page, with nothing saying which. A band called "Latest updates" has to be.
  //
  // Hidden tabs are skipped: a backgrounded tab polling on a timer is pure cost
  // for something nobody is looking at, and the wake handler below covers the
  // moment it comes back.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void loadPress();
    }, RADAR_POLL_MS);
    return () => clearInterval(t);
  }, [loadPress]);

  // Wake still matters on top of the interval: a tab left for an hour should not
  // wait up to 90s for the first tick.
  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState === "hidden") return;
      if (wakeIsDue(Date.now(), pressAtRef.current, RADAR_WINDOW_MS)) void loadPress();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("online", onWake);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("online", onWake);
    };
  }, [loadPress]);

  const items: WireItem[] = useMemo(() => {
    const d: WireItem[] = desk.map((u) => ({
      id: `desk-${u.id}`,
      lane: "desk",
      title: u.title,
      body: u.body,
      url: u.url ?? null,
      source: "XYZ desk",
      sourceIcon: null,
      at: new Date(u.createdAt).getTime(),
      tag: KIND_LABEL[u.kind] ?? u.kind,
      tone: KIND_TONE[u.kind] ?? null,
      pinned: Boolean(u.pinned),
      venues: u.program ? [u.program] : [],
      image: u.image ?? null,
    }));
    const p: WireItem[] = press.map((i) => ({
      id: `press-${i.id}`,
      lane: "press",
      title: i.title,
      body: i.summary,
      url: i.url,
      source: i.source,
      sourceIcon: i.sourceIcon,
      at: i.publishedAt,
      tag: i.category,
      tone: null,
      pinned: false,
      venues: i.venues,
      // ⚠️ Was hard-coded null: the radar route carried no image, so a press
      // row could never show one and half the band was pictureless next to the
      // desk lane. The route ships it now, and this is the line that was
      // silently discarding it either way.
      image: i.image ?? null,
    }));
    // A pinned desk post outranks everything: pinning is the desk saying "this
    // is the thing". After that it is simply newest first, and the desk wins a
    // tie because it is the reviewed lane.
    return [...d, ...p].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (b.at !== a.at) return b.at - a.at;
      return a.lane === "desk" ? -1 : 1;
    });
  }, [desk, press]);

  /** X links, whichever lane they came from. */
  const isX = (i: WireItem) => prettyHost(hostOf(i.url)) === "X";
  const xCount = items.filter(isX).length;
  const shownItems = lens === "x" ? items.filter(isX) : items;

  // Arrivals, computed from ids rather than length: a feed can gain one and
  // lose one in the same refresh and still be the same length.
  useEffect(() => {
    // ⚠️ Seed only once BOTH lanes have finished their first load.
    //
    // Two earlier attempts at this were wrong, and each looked right:
    //
    // 1. Seeding on first render recorded an EMPTY set (the effect runs before
    //    either fetch resolves), so the whole first feed counted as arrivals.
    // 2. Seeding on the first non-empty list was no better: the lanes resolve
    //    SEPARATELY. The desk lane landed first with one post, that became the
    //    baseline, and all seventeen press items then read as new.
    //
    // Both measured the same way - a freshly opened page announcing
    // "18 new updates" before the reader had seen anything at all, which is the
    // exact opposite of what the pill is for.
    //
    // "The reader has seen the initial feed" means both lanes have settled, so
    // that is what the condition says.
    const settled = deskState !== "loading" && pressState !== "loading";
    if (!settled) return;

    const ids = items.map((i) => i.id);
    if (seenRef.current === null) {
      seenRef.current = new Set(ids);
      return;
    }
    const fresh = ids.filter((id) => !seenRef.current!.has(id));
    if (fresh.length) setPendingIds((p) => [...new Set([...p, ...fresh])]);
  }, [items, deskState, pressState]);

  const acceptNew = useCallback(() => {
    seenRef.current = new Set(items.map((i) => i.id));
    setPendingIds([]);
  }, [items]);

  const [hot, ...rest] = shownItems;
  const visibleRest = showAll ? rest : rest.slice(0, 12);
  const live = deskState !== "down" || pressState !== "down";

  /**
   * One AI briefing over what is actually on the band right now.
   *
   * ⚠️ Built from the HEADLINES the reader can see, not from a separate query.
   * A briefing that summarises something other than what is on screen is an
   * invitation to trust it over the sources, and the sources are the thing with
   * a name attached.
   *
   * On demand only. Auto-firing an AI call on every page view would bill for a
   * generation nobody asked for, on a page most visitors scroll straight past.
   */
  const generateBrief = useCallback(async () => {
    const top = shownItems.slice(0, 8);
    if (!top.length || brief.loading) return;
    setBrief({ loading: true, text: null, err: null });
    try {
      const res = await fetch("/api/ai/why-matters", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Perp DEX and airdrop roundup",
          // ⚠️ One numbered block per story, and a generous cap. This used to be
          // a single blob sliced at 1200 characters, which cut the list off
          // mid-item - so the model was briefed on half a sentence and then
          // asked, by the single-story prompt, to describe "the story".
          summary: top
            .map((i, n) => `${n + 1}. [${i.source}] ${i.title}${i.body ? ` — ${i.body}` : ""}`)
            .join("\n")
            .slice(0, 3800),
          // ⚠️ `roundup`, not `briefing`. Several unrelated items need an answer
          // shaped like a roundup; the briefing prompt asks for "What happened"
          // and "Key players" about ONE event, and handed a list a model either
          // picks one story or hedges. That is what "briefing not working" was.
          mode: "roundup",
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Could not generate the briefing.");
      setBrief({
        loading: false,
        text: j?.text ?? null,
        err: null,
        meta: j?.meta ?? null,
      });
    } catch (e) {
      setBrief({ loading: false, text: null, err: (e as Error).message });
    }
  }, [shownItems, brief.loading]);

  return (
    <section aria-label="Live updates" className="relative">
      <div className="surface overflow-hidden rounded-3xl">
        {/* ── the band header ───────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-hairline px-4 py-2.5 sm:px-5">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-mint-300">
            <span className="relative flex h-1.5 w-1.5">
              {live && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-400 opacity-75" />
              )}
              <span
                className={cn(
                  "relative inline-flex h-1.5 w-1.5 rounded-full",
                  live ? "bg-mint-400" : "bg-rose-400"
                )}
              />
            </span>
            <Radio className="h-3.5 w-3.5" strokeWidth={1.7} />
            {/* ⚠️ "Live wire" was jargon. A wire service is a newsroom term and
                nobody outside one reads it as "the latest updates", which is all
                this is. Plain words beat clever ones on a label a reader has to
                understand in the half second before they decide to keep reading. */}
            Latest updates
          </span>

          {/* ⚠️ Freshness lives HERE, in the header, and always.
              It used to sit inside the "N more" button - which does not render
              when the list is short - so a band with nothing new gave zero
              evidence it was running. "Working but quiet" and "broken" looked
              identical, and a reader watching a feed that never visibly changes
              reasonably concludes the second.

              A narrow filter is the point of this band: it tracks airdrop, points
              and perp DEX stories only, and on a slow day there genuinely is
              nothing new for hours. That is a fine answer - but it has to be a
              stated one. */}
          <span className="text-[11px] text-content-subtle">
            {fetchedAt !== null ? (
              <>
                {items.length} tracked · checked {formatDateTime(new Date(fetchedAt))}
              </>
            ) : (
              "Perp DEX & airdrops"
            )}
          </span>

          {/* ⚠️ Only offered when there is something to filter TO. A dead "X"
              chip that always yields an empty list teaches a reader the control
              is broken. */}
          {xCount > 0 && (
            <button
              type="button"
              onClick={() => setLens((l) => (l === "x" ? "all" : "x"))}
              aria-pressed={lens === "x"}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition-colors",
                lens === "x"
                  ? "border-gold-500/40 bg-gold-500/15 text-gold-200"
                  : "border-hairline text-content-muted hover:text-content"
              )}
            >
              From X <span className="mono opacity-70">{xCount}</span>
            </button>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void generateBrief()}
              disabled={brief.loading || shownItems.length === 0}
              className="btn-ghost inline-flex min-h-8 shrink-0 items-center gap-1.5 text-[11px] disabled:opacity-50"
            >
              {brief.loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.7} />
              ) : (
                <RobotIcon className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{brief.text ? "Re-brief" : "AI brief"}</span>
              <span className="sm:hidden">Brief</span>
            </button>
            {/* ⚠️ No "Post" button here. It only jumped to the composer further
                down the same page, which is a control that looks like an action
                and is actually a scroll. The composer is where posting belongs
                and it is already reachable. */}
            <button
              type="button"
              onClick={() => {
                // ⚠️ `true` - a BUTTON press forces an origin read. Without it
                // this refetched the same edge-cached bytes and the button was
                // decoration. See `refreshUrl`.
                void loadDesk(true);
                void loadPress(true);
              }}
              className="btn-ghost inline-flex min-h-8 shrink-0 items-center gap-1.5 text-[11px]"
              aria-label="Refresh the latest updates"
            >
              <RefreshCw
                className={cn(
                  "h-3.5 w-3.5",
                  (deskState === "loading" || pressState === "loading") && "animate-spin"
                )}
                strokeWidth={1.7}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* ⚠️ New rows are announced, not spliced in. A live feed that reflows
            under someone mid-sentence is worse than a stale one - they lose
            their place and learn not to trust the list. The count is the
            invitation; the reader decides when it moves. */}
        {pendingIds.length > 0 && (
          <button
            type="button"
            onClick={acceptNew}
            className="flex min-h-11 w-full items-center justify-center gap-1.5 border-b border-mint-500/25 bg-mint-500/[0.06] text-[11px] font-semibold text-mint-200 transition-colors hover:bg-mint-500/[0.1]"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint-400" />
            </span>
            {pendingIds.length} new update{pendingIds.length === 1 ? "" : "s"} — tap to mark as read
          </button>
        )}

        {/* ── the AI briefing, when asked for ───────────────────────────── */}
        {(brief.loading || brief.text || brief.err) && (
          <div className="border-b border-hairline bg-surface-2 px-4 py-4 sm:px-5">
            <div className="flex items-center gap-2">
              {/* The same mark the assistant and the news briefing use. One
                  face for XYZ AI everywhere it speaks: a reader should be able
                  to tell at a glance which words on a page are the model's. */}
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gold-200">
                <RobotIcon className="h-4 w-4" />
                XYZ AI briefing
              </p>
              {/* A briefing is long. Once it is read it is in the way, and
                  scrolling past it every time is not a substitute for closing
                  it. */}
              <button
                type="button"
                onClick={() => setBrief({ loading: false, text: null, err: null })}
                aria-label="Close the briefing"
                className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-lg text-content-subtle transition-colors hover:text-content"
              >
                <X className="h-4 w-4" strokeWidth={1.7} />
              </button>
            </div>
            {brief.loading && (
              <p className="mt-2 text-xs text-content-muted">
                Reading {Math.min(shownItems.length, 8)} headlines and writing the breakdown…
              </p>
            )}
            {brief.err && <p className="mt-2 text-xs text-amber-200">{brief.err}</p>}
            {brief.text && (
              // MarkdownLite is the same renderer the news briefing uses, so the
              // headings, bullets and emphasis land identically on both pages.
              <div className="prose-brief mt-2 text-xs leading-relaxed text-content-muted">
                <MarkdownLite text={brief.text} />
              </div>
            )}
            {/* ⚠️ Says when the answer was cut short, and names the model. A
                fragment shown as a finished briefing leaves a reader to conclude
                the feature is broken - which is exactly what happened on the
                news side, four times over, before the same line was added there. */}
            {brief.meta?.truncated && (
              <p className="mt-2 text-[11px] leading-relaxed text-amber-200">
                This ran out of room before it finished. Generating it again usually completes it.
              </p>
            )}
            <p className="mt-2.5 text-[10px] text-content-subtle">
              Generated from the headlines above. Not financial advice, and no substitute for the sources.
              {brief.meta?.model && (
                <span className="mono ml-1 opacity-70">
                  · {brief.meta.cached ? "cached" : brief.meta.model}
                  {brief.meta.continued ? " · continued" : ""}
                </span>
              )}
            </p>
          </div>
        )}

        {/* ── the hot item, as a banner ─────────────────────────────────── */}
        {hot ? (
          <WireEntry item={hot} hero />
        ) : (
          <p className="px-4 py-4 text-xs text-content-muted sm:px-5">
            {deskState === "loading" || pressState === "loading"
              ? "Loading the latest…"
              : "Nothing new right now. Snapshots, TGE dates and new programmes land here live."}
          </p>
        )}

        {/* ── the rest, behind a count ──────────────────────────────────── */}
        {rest.length > 0 && (
          <>
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-controls="points-wire-more"
              className="flex min-h-11 w-full items-center gap-2 border-t border-hairline px-4 text-[11px] font-medium text-content-muted transition-colors hover:text-content sm:px-5"
            >
              {open ? "Hide" : `${rest.length} more`} related update{rest.length === 1 ? "" : "s"}
              <ChevronDown
                className={cn("ml-auto h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
                strokeWidth={1.7}
              />
            </button>

            {/* grid-rows 0fr -> 1fr animates a height nobody has to measure. The
                inner min-h-0 overflow-hidden child is required, or the content
                sets the row height and nothing moves. */}
            <div
              id="points-wire-more"
              className={cn(
                "grid transition-all duration-300",
                open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <ul className="divide-y divide-hairline border-t border-hairline">
                  {visibleRest.map((i, n) => (
                    // A short, staggered rise so a long list arrives in order
                    // rather than all at once. Capped at ten steps: past that
                    // the last rows would visibly lag the scroll.
                    //
                    // ⚠️ `animate-fade-up` is THIS project's keyframe, already in
                    // tailwind.config.ts. The obvious spelling here would have
                    // been `animate-in fade-in slide-in-from-bottom-1`, which
                    // belongs to `tailwindcss-animate` - a plugin this repo does
                    // not install. Those classes parse, generate nothing, and
                    // fail silently: the same family as the `bg-base/95` and
                    // `text-content0` incidents.
                    <li
                      key={i.id}
                      className="animate-fade-up"
                      style={{ animationDelay: `${Math.min(n, 10) * 25}ms` }}
                    >
                      <WireEntry item={i} isNew={pendingIds.includes(i.id)} />
                    </li>
                  ))}
                </ul>

                {rest.length > 12 && (
                  <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    className="flex min-h-11 w-full items-center justify-center gap-1.5 border-t border-hairline text-[11px] font-medium text-content-muted transition-colors hover:text-content"
                  >
                    {showAll ? "Show fewer" : `Show all ${rest.length}`}
                    <ChevronDown
                      className={cn("h-3.5 w-3.5 transition-transform", showAll && "rotate-180")}
                      strokeWidth={1.7}
                    />
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/**
 * A row that opens in place.
 *
 * ⚠️ Clicking a headline used to LEAVE - straight out to the outlet. On a page
 * whose whole argument is "check the number before you act", throwing the reader
 * off-site at the first tap is the opposite of the job. So a tap expands the
 * item here: the full summary, who is claiming it, and then an explicit link
 * that opens the story on THIS site's reader, which renders it with its own
 * briefing.
 *
 * Expanding is a `<button>` and reading is an `<a>`, never one element doing
 * both. A link that sometimes navigates and sometimes does not is the control
 * readers learn to distrust first.
 */
function WireEntry({
  item,
  hero = false,
  isNew = false,
}: {
  item: WireItem;
  hero?: boolean;
  /** Arrived since the reader last caught up. Marked, not animated in place. */
  isNew?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const host = prettyHost(hostOf(item.url));
  const href = readHref(item);
  const external = leavesSite(item);

  return (
    <div className={cn(hero && "border-b border-hairline", isNew && "bg-mint-500/[0.04]")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full flex-col gap-1.5 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.02] sm:px-5"
      >
        <span className="flex flex-wrap items-center gap-2 text-[10px]">
          <LaneBadge item={item} />
          {isNew && (
            <span className="rounded-full border border-mint-500/30 bg-mint-500/10 px-2 py-0.5 font-medium text-mint-200">
              New
            </span>
          )}
          {item.pinned && (
            <span className="inline-flex items-center gap-1 font-medium text-gold-200">
              <Pin className="h-3 w-3" strokeWidth={1.7} /> Pinned
            </span>
          )}
          {item.venues.slice(0, 2).map((v) => (
            <span
              key={v}
              className="rounded-full border border-gold-500/30 bg-gold-500/10 px-2 py-0.5 font-medium text-gold-200"
            >
              {v}
            </span>
          ))}
          <span className="ml-auto text-content-subtle">{formatDateTime(new Date(item.at))}</span>
        </span>

        <span className="flex items-start gap-3">
          {/* ⚠️ The picture belongs in the COLLAPSED row, not only the expanded
              one. An image a reader has to open a row to discover does not do
              the job an image does - it is what makes a list scannable, and a
              band of pure text reads as an archive rather than a feed.

              Plain <img>, never `next/image`: these are publisher CDN URLs (and
              Supabase Storage for a desk post), fetched browser-to-origin at
              ZERO Vercel transfer. Routing them through the optimiser would
              spend Fast Origin Transfer and optimisation quota on someone
              else's file (cost-check, trap 3). `loading="lazy"` so a folded
              dozen does not fetch a dozen covers, and an `onError` that hides
              it - a dead enclosure URL is common enough that a broken-image
              icon would be a regular sight. */}
          {item.image && !open && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image}
              alt=""
              loading="lazy"
              className={cn(
                "shrink-0 rounded-lg border border-hairline object-cover",
                hero ? "h-16 w-24 sm:h-20 sm:w-32" : "h-11 w-16"
              )}
              onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
            />
          )}

          {/* ⚠️ `min-h` matched to the thumbnail, and measured rather than
              guessed: without it a row WITH a picture stood 10px taller than
              one without (100px vs 90px), so the list stepped unevenly down the
              page depending on which feeds happened to ship an enclosure. The
              floor makes every folded row the same height whether or not there
              is an image, which is the whole difference between a feed that
              looks composed and one that looks assembled. */}
          <span className={cn("min-w-0 flex-1", !hero && "flex min-h-11 flex-col justify-center")}>
            <span
              className={cn(
                "block font-semibold leading-snug tracking-tight text-content",
                hero ? "font-display text-base sm:text-lg" : "text-xs"
              )}
            >
              {item.title}
            </span>

            {!open && item.body && (
              <span
                className={cn(
                  "mt-1 block text-xs leading-relaxed text-content-muted",
                  // The hero has room for a second line; a folded row does not,
                  // and letting it take one makes the list scan unevenly.
                  hero ? "line-clamp-2" : "line-clamp-1"
                )}
              >
                {item.body}
              </span>
            )}
          </span>

          <ChevronDown
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0 text-content-subtle transition-transform",
              open && "rotate-180"
            )}
            strokeWidth={1.7}
          />
        </span>
      </button>

      {/* grid-rows 0fr -> 1fr animates a height nobody has to measure. */}
      <div className={cn("grid transition-all duration-300", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="min-h-0 overflow-hidden">
          <div className="px-4 pb-4 sm:px-5">
            {/* The same picture, full width, once the row is open - the
                thumbnail above hides itself when that happens, so the image
                grows into place rather than appearing twice. Same plain <img>
                for the same reason (cost-check, trap 3).

                ⚠️ Gated on `open`, not merely hidden by the collapsing grid.
                Rendered unconditionally it is a SECOND <img> per row sitting in
                a zero-height overflow container - a browser is entitled to
                fetch that, and a probe counted 18 image nodes across 17 rows
                before this gate existed. */}
            {item.image && open && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.image}
                alt=""
                loading="lazy"
                className="mb-3 block max-h-56 w-full rounded-xl border border-hairline object-cover"
                onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
              />
            )}
            {item.body && (
              // Same renderer as the desk card, so a link is tappable in both
              // places and formatting cannot diverge between them.
              <div className="text-xs leading-relaxed text-content-muted">
                <MarkdownLite text={item.body} />
              </div>
            )}
            <p className="mt-2.5 text-[11px] text-content-subtle">
              {item.lane === "desk" ? "Posted by the XYZ desk" : `Reported by ${item.source}`}
              {host && ` · ${host}`}
            </p>
            {href && (
              <a
                href={href}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="mt-2.5 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-hairline px-3 text-[11px] font-medium text-gold-200 transition-colors hover:border-gold-500/30 hover:text-gold-100"
              >
                {external ? `Open on ${host ?? "the source"}` : "Read the full story here"}
                {external && <ExternalLink className="h-3 w-3" strokeWidth={1.7} />}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Which lane a row belongs to, always visible.
 *
 * The desk's word and an outlet's report are different claims. A reader acts on
 * them differently, so the distinction is never left to be inferred from the
 * wording of a headline.
 */
function LaneBadge({ item }: { item: WireItem }) {
  if (item.lane === "desk") {
    return (
      <span
        className={cn(
          "rounded-full border px-2 py-0.5 font-medium",
          item.tone ?? "border-mint-500/30 bg-mint-500/10 text-mint-200"
        )}
      >
        {item.tag}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-content-muted">
      {item.sourceIcon && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.sourceIcon}
          alt=""
          width={12}
          height={12}
          className="h-3 w-3 rounded-sm"
          onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")}
        />
      )}
      {item.source}
    </span>
  );
}
