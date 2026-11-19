"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { Swords } from "lucide-react";
import { XIcon, YouTubeIcon } from "@shared/components/BrandIcons";
import { cn } from "@/lib/utils";
import { rankYoutubeCreators, type TopicId } from "@modules/creators/lib/scoring";
import type { VenueFilter, XWindow } from "@modules/creators/lib/x-index";
import { XBoard, venueLabel, type BoardState } from "./XBoard";
import { XProfile } from "./XProfile";
import { YoutubeBoard, type YtState } from "./YoutubeBoard";
import { Arena, fromBoard, fromYoutube } from "./Arena";
import { useLocalList } from "./ui";
import { Hero } from "./Hero";

type Tab = "x" | "youtube" | "arena";

const TABS: { id: Tab; label: string; short: string; Icon: (p: { className?: string }) => React.ReactNode }[] = [
  { id: "x", label: "X · Variational", short: "Variational", Icon: XIcon },
  { id: "youtube", label: "YouTube · Perp DEX", short: "YouTube", Icon: YouTubeIcon },
  { id: "arena", label: "Arena", short: "Arena", Icon: Swords },
];


/**
 * Live refresh. Each poll is SHORTER than its route's edge window (X 300s,
 * YouTube 600s) and longer than a third of it, so a poll never forces a
 * regeneration and never just re-reads identical bytes - see
 * markets-poll-alignment.test.ts, where both are in TARGETS. Visible tab only.
 */
export const X_POLL_MS = 240_000;
export const YT_POLL_MS = 540_000;

function useVisibleTick(ms: number): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let last = Date.now();
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      last = Date.now();
      setTick((t) => t + 1);
    }, ms);
    // Coming back to a tab that missed a poll refreshes at once.
    const onVis = () => {
      if (document.visibilityState === "visible" && Date.now() - last >= ms) {
        last = Date.now();
        setTick((t) => t + 1);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ms]);
  return tick;
}

export function CreatorsClient() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  const [tab, setTab] = useState<Tab>("x");
  // The X board is Variational only (owner's call). Kept as a value so the
  // API contract (?venue=) stays explicit.
  const venue: VenueFilter = "variational";
  const [win, setWin] = useState<XWindow>("all");
  const [replies, setReplies] = useState(false);
  const [board, setBoard] = useState<BoardState>({ status: "loading" });
  const [topic, setTopic] = useState<TopicId>("all");
  const [yt, setYt] = useState<YtState>({ status: "loading" });
  const [profile, setProfile] = useState<string | null>(null);
  const [compareWith, setCompareWith] = useState<string | null>(null);
  const [watch, saveWatch] = useLocalList("xyz:creators:watch", 200);
  const [recents, saveRecents] = useLocalList("xyz:creators:recent", 12);
  const xTick = useVisibleTick(X_POLL_MS);
  const ytTick = useVisibleTick(YT_POLL_MS);
  const boardKey = useRef("");
  const ytKey = useRef("");

  // Deep links (?x=handle opens a profile, ?tab=, ?venue=). Read after mount,
  // not during render, so the static shell and the first client render match -
  // and the page needs no Suspense boundary for useSearchParams.
  useEffect(() => {
    const t = setTimeout(() => {
      const sp = new URLSearchParams(window.location.search);
      const x = sp.get("x");
      const tb = sp.get("tab");
      if (tb === "youtube" || tb === "arena" || tb === "x") setTab(tb);
      if (x && /^[A-Za-z0-9_]{1,15}$/.test(x)) setProfile(x);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // Board: keep what is on screen while the next venue/window loads, so a
  // filter change dims the board for a moment instead of blanking it.
  useEffect(() => {
    let alive = true;
    // A poll of the same filter updates silently; only a filter change dims.
    const key = `${venue}|${win}|${replies}`;
    const silent = boardKey.current === key;
    boardKey.current = key;
    const t = setTimeout(() => {
      if (!silent) setBoard((s) => (s.status === "ready" ? { ...s, refreshing: true } : { status: "loading" }));
    }, 0);
    fetch(`/api/creators/x?venue=${venue}&window=${win}${replies ? "&replies=1" : ""}`)
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!alive) return;
        if (!r.ok || !Array.isArray(body?.rows)) return setBoard((s) => (s.status === "ready" ? { ...s, refreshing: false } : { status: "error" }));
        // Defaults for fields a cached older payload might lack, so a shape
        // change can never crash the page during a deploy window.
        setBoard({
          status: "ready",
          board: { latest: [], topics: [], rising: [], topPosts: [], daily: [], ranking: [], active7d: 0, replies: false, ...body, sync: { lastError: null, backfilledTo: null, ...body.sync }, rows: body.rows.map((r: any) => ({ move: null, ...r })) },
          refreshing: false,
        });
      })
      .catch(() => alive && setBoard((s) => (s.status === "ready" ? { ...s, refreshing: false } : { status: "error" })));
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [venue, win, replies, xTick]);

  useEffect(() => {
    let alive = true;
    const silent = ytKey.current === topic;
    ytKey.current = topic;
    const t = setTimeout(() => {
      if (!silent) setYt((s) => (s.status === "ready" ? { ...s, refreshing: true } : { status: "loading" }));
    }, 0);
    fetch(`/api/creators/youtube?topic=${topic}`)
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!alive) return;
        if (body?.configured === false) return setYt({ status: "unconfigured" });
        if (!r.ok || !Array.isArray(body?.videos)) return setYt((s) => (s.status === "ready" ? { ...s, refreshing: false } : { status: "error", quota: body?.error === "quota" }));
        // The window filter's "now" is captured here, never during render.
        setYt({ status: "ready", videos: body.videos, fetchedAt: body.fetchedAt ?? null, statsAt: body.statsAt ?? null, partial: Boolean(body.partial), loadedAt: Date.now(), refreshing: false, stale: Boolean(body.stale) });
      })
      .catch(() => alive && setYt((s) => (s.status === "ready" ? { ...s, refreshing: false } : { status: "error", quota: false })));
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [topic, ytTick]);

  const setUrl = (key: string, value: string | null) => {
    try {
      const url = new URL(window.location.href);
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
      window.history.replaceState(null, "", url);
    } catch {
      /* history blocked: the UI still works */
    }
  };

  const openProfile = useCallback(
    (h: string) => {
      setProfile(h);
      setUrl("x", h);
      saveRecents([h, ...recents.filter((r) => r.toLowerCase() !== h.toLowerCase())]);
    },
    [recents, saveRecents]
  );

  const closeProfile = useCallback(() => {
    setProfile(null);
    setUrl("x", null);
  }, []);

  const toggleWatch = useCallback(
    (h: string) => {
      const has = watch.some((w) => w.toLowerCase() === h.toLowerCase());
      saveWatch(has ? watch.filter((w) => w.toLowerCase() !== h.toLowerCase()) : [h, ...watch]);
    },
    [watch, saveWatch]
  );

  const hide = useCallback(async (h: string) => {
    const r = await fetch(`/api/creators/x?handle=${encodeURIComponent(h)}`, { method: "DELETE" });
    if (r.ok) {
      setBoard((s) => (s.status === "ready" ? { ...s, board: { ...s.board, rows: s.board.rows.filter((x) => x.handle !== h) } } : s));
    }
  }, []);

  const changeTab = (t: Tab) => {
    setTab(t);
    setUrl("tab", t === "x" ? null : t);
  };

  const rows = useMemo(() => (board.status === "ready" ? board.board.rows : []), [board]);
  const xPool = useMemo(() => fromBoard(rows), [rows]);
  const ytPool = useMemo(() => (yt.status === "ready" ? fromYoutube(rankYoutubeCreators(yt.videos)) : []), [yt]);
  const ytCount = yt.status === "ready" ? yt.videos.length : 0;
  const ytTop = useMemo(() => (yt.status === "ready" ? (rankYoutubeCreators(yt.videos)[0] ?? null) : null), [yt]);

  return (
    <div className="space-y-8">
      <Hero
        board={board.status === "ready" ? board.board : null}
        topChannel={ytTop}
        ytVideos={ytCount}
        onScan={(h) => {
          changeTab("x");
          openProfile(h);
        }}
        onOpen={openProfile}
      />

      {/* Tabs */}
      <div role="tablist" aria-label="Boards" className="sticky top-20 z-20 -mx-1 flex gap-1 overflow-x-auto rounded-2xl border border-hairline bg-ink-950/80 p-1 backdrop-blur-xl [scrollbar-width:none]">
        {TABS.map(({ id, label, short, Icon }) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => changeTab(id)}
            className={cn(
              "relative inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors sm:flex-none sm:px-4",
              tab === id ? "text-gold-100" : "text-content-muted hover:text-content"
            )}
          >
            {tab === id && (
              <motion.span layoutId="creators-tab" className="absolute inset-0 rounded-xl bg-gold-400/15 ring-1 ring-gold-400/40" transition={{ type: "spring", stiffness: 380, damping: 32 }} />
            )}
            <Icon className="relative h-4 w-4" />
            <span className="relative sm:hidden">{short}</span>
            <span className="relative hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Enter-only on purpose. This was AnimatePresence mode="wait", and the
          exit of a board holding a shared-layout element (the venue glow)
          could stall forever - the tab bar switched but the content never
          did. A keyed enter animation cannot get stuck. */}
      <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          {tab === "x" && (
            <XBoard
              state={board}
              venue={venue}
              win={win}
              setWin={setWin}
              replies={replies}
              setReplies={setReplies}
              onOpen={openProfile}
              isAdmin={isAdmin}
              onHide={hide}
              watch={watch}
              toggleWatch={toggleWatch}
              recents={recents}
              clearRecents={() => saveRecents([])}
            />
          )}
          {tab === "youtube" && <YoutubeBoard state={yt} topic={topic} setTopic={setTopic} />}
          {tab === "arena" && <Arena xPool={xPool} ytPool={ytPool} label={venueLabel(venue)} compareWith={compareWith} />}
      </motion.div>

      {profile && (
        <XProfile
          key={profile}
          handle={profile}
          venue={venue}
          replies={replies}
          // Profile ranks are all-time, so only an all-time board can say who is next above.
          board={win === "all" ? rows : []}
          boardVenue={win === "all" ? venue : null}
          starred={watch.some((w) => w.toLowerCase() === profile.toLowerCase())}
          onToggleStar={toggleWatch}
          onClose={closeProfile}
          onCompare={(h) => {
            setCompareWith(h);
            closeProfile();
            changeTab("arena");
          }}
        />
      )}
    </div>
  );
}
