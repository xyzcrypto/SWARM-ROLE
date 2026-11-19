"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { Swords } from "lucide-react";
import { XIcon, YouTubeIcon } from "@shared/components/BrandIcons";
import { cn } from "@/lib/utils";
import { rankYoutubeCreators, type TopicId } from "@modules/creators/lib/scoring";
import type { VenueFilter, XWindow } from "@modules/creators/lib/x-index";
import { compact, full } from "@modules/creators/lib/game";
import { XBoard, venueLabel, type BoardState } from "./XBoard";
import { XProfile } from "./XProfile";
import { YoutubeBoard, type YtState } from "./YoutubeBoard";
import { Arena, fromBoard, fromYoutube } from "./Arena";
import { CountUp, useLocalList } from "./ui";

type Tab = "x" | "youtube" | "arena";

const TABS: { id: Tab; label: string; short: string; Icon: (p: { className?: string }) => React.ReactNode }[] = [
  { id: "x", label: "X · Perp DEX", short: "X", Icon: XIcon },
  { id: "youtube", label: "YouTube · Perp DEX", short: "YouTube", Icon: YouTubeIcon },
  { id: "arena", label: "Arena", short: "Arena", Icon: Swords },
];

const VALID_VENUES = new Set(["variational", "entropy", "all"]);

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
  const [venue, setVenue] = useState<VenueFilter>("variational");
  const [win, setWin] = useState<XWindow>("all");
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
      const v = sp.get("venue");
      if (tb === "youtube" || tb === "arena" || tb === "x") setTab(tb);
      if (v && VALID_VENUES.has(v)) setVenue(v as VenueFilter);
      if (x && /^[A-Za-z0-9_]{1,15}$/.test(x)) setProfile(x);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // Board: keep what is on screen while the next venue/window loads, so a
  // filter change dims the board for a moment instead of blanking it.
  useEffect(() => {
    let alive = true;
    // A poll of the same filter updates silently; only a filter change dims.
    const key = `${venue}|${win}`;
    const silent = boardKey.current === key;
    boardKey.current = key;
    const t = setTimeout(() => {
      if (!silent) setBoard((s) => (s.status === "ready" ? { ...s, refreshing: true } : { status: "loading" }));
    }, 0);
    fetch(`/api/creators/x?venue=${venue}&window=${win}`)
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!alive) return;
        if (!r.ok || !Array.isArray(body?.rows)) return setBoard((s) => (s.status === "ready" ? { ...s, refreshing: false } : { status: "error" }));
        setBoard({ status: "ready", board: body, refreshing: false });
      })
      .catch(() => alive && setBoard((s) => (s.status === "ready" ? { ...s, refreshing: false } : { status: "error" })));
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [venue, win, xTick]);

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
        setYt({ status: "ready", videos: body.videos, fetchedAt: body.fetchedAt ?? null, statsAt: body.statsAt ?? null, partial: Boolean(body.partial), loadedAt: Date.now(), refreshing: false });
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
  const changeVenue = (v: VenueFilter) => {
    setVenue(v);
    setUrl("venue", v === "variational" ? null : v);
  };

  const rows = useMemo(() => (board.status === "ready" ? board.board.rows : []), [board]);
  const xPool = useMemo(() => fromBoard(rows), [rows]);
  const ytPool = useMemo(() => (yt.status === "ready" ? fromYoutube(rankYoutubeCreators(yt.videos)) : []), [yt]);
  const ytCount = yt.status === "ready" ? yt.videos.length : 0;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <header className="relative">
        <div aria-hidden className="pointer-events-none absolute -left-20 -top-16 h-56 w-56 rounded-full bg-mint-400/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute right-0 top-10 hidden h-48 w-48 rounded-full bg-gold-400/10 blur-3xl md:block" />
        <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="relative text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-400">
          Creator Leaderboard
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative mt-2 max-w-3xl font-display text-[2rem] font-bold leading-[1.08] tracking-tight text-content sm:text-5xl"
        >
          Who really moves <span className="text-shine">perp DEX</span> <span className="text-shimmer">crypto Twitter and YouTube</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.6 }}
          className="relative mt-4 max-w-2xl text-sm leading-relaxed text-content-muted sm:text-[15px]"
        >
          Scan any X handle for its proof of work on Variational and Entropy, climb eight levels, collect badges, and see which YouTube creators lead
          on ten perp DEXs. Every number comes from public data, and every formula is on the page.
        </motion.p>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="relative mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <span className="text-content-subtle">
            <span className="font-display text-lg font-bold text-content">
              <CountUp value={board.status === "ready" ? board.board.totals.accounts : 0} format={full} />
            </span>{" "}
            X creators · {venueLabel(venue)}
          </span>
          <span className="text-content-subtle">
            <span className="font-display text-lg font-bold text-content">
              <CountUp value={board.status === "ready" ? board.board.totals.views : 0} format={compact} />
            </span>{" "}
            post views
          </span>
          <span className="text-content-subtle">
            <span className="font-display text-lg font-bold text-content">
              <CountUp value={ytCount} format={full} />
            </span>{" "}
            perp DEX videos
          </span>
        </motion.div>
      </header>

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
              setVenue={changeVenue}
              win={win}
              setWin={setWin}
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
