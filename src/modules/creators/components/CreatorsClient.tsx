"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { Swords } from "lucide-react";
import { XIcon, YouTubeIcon } from "@shared/components/BrandIcons";
import { cn } from "@/lib/utils";
import type { TopicId } from "@modules/creators/lib/scoring";
import type { XWindow } from "@modules/creators/lib/x-index";
import { compact, full } from "@modules/creators/lib/game";
import { XBoard, type BoardState } from "./XBoard";
import { XProfile } from "./XProfile";
import { YoutubeBoard, type YtState } from "./YoutubeBoard";
import { Arena, fromBoard } from "./Arena";
import { CountUp } from "./ui";

type Tab = "x" | "youtube" | "arena";

const TABS: { id: Tab; label: string; short: string; Icon: (p: { className?: string }) => React.ReactNode }[] = [
  { id: "x", label: "X · Variational", short: "Variational", Icon: XIcon },
  { id: "youtube", label: "YouTube · Perp DEX", short: "YouTube", Icon: YouTubeIcon },
  { id: "arena", label: "Arena", short: "Arena", Icon: Swords },
];

export function CreatorsClient() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  const [tab, setTab] = useState<Tab>("x");
  const [win, setWin] = useState<XWindow>("all");
  const [board, setBoard] = useState<BoardState>({ status: "loading" });
  const [topic, setTopic] = useState<TopicId>("all");
  const [yt, setYt] = useState<YtState>({ status: "loading" });
  const [profile, setProfile] = useState<string | null>(null);
  const [compareWith, setCompareWith] = useState<string | null>(null);

  // Deep links (?x=handle opens a profile, ?tab=youtube|arena). Read after
  // mount, not during render, so the static shell and the first client render
  // match - and the page needs no Suspense boundary for useSearchParams.
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

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => setBoard({ status: "loading" }), 0);
    fetch(`/api/creators/x?window=${win}`)
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!alive) return;
        if (!r.ok || !Array.isArray(body?.rows)) return setBoard({ status: "error" });
        setBoard({ status: "ready", board: body });
      })
      .catch(() => alive && setBoard({ status: "error" }));
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [win]);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => setYt({ status: "loading" }), 0);
    fetch(`/api/creators/youtube?topic=${topic}`)
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!alive) return;
        if (body?.configured === false) return setYt({ status: "unconfigured" });
        if (!r.ok || !Array.isArray(body?.videos)) return setYt({ status: "error", quota: body?.error === "quota" });
        // The window filter's "now" is captured here, never during render.
        setYt({ status: "ready", videos: body.videos, fetchedAt: body.fetchedAt ?? null, partial: Boolean(body.partial), loadedAt: Date.now() });
      })
      .catch(() => alive && setYt({ status: "error", quota: false }));
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [topic]);

  const openProfile = useCallback((h: string) => {
    setProfile(h);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("x", h);
      window.history.replaceState(null, "", url);
    } catch {
      /* history blocked: the modal still opens */
    }
  }, []);

  const closeProfile = useCallback(() => {
    setProfile(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("x");
      window.history.replaceState(null, "", url);
    } catch {
      /* ignore */
    }
  }, []);

  const hide = useCallback(async (h: string) => {
    const r = await fetch(`/api/creators/x?handle=${encodeURIComponent(h)}`, { method: "DELETE" });
    if (r.ok) {
      setBoard((s) => (s.status === "ready" ? { status: "ready", board: { ...s.board, rows: s.board.rows.filter((x) => x.handle !== h) } } : s));
    }
  }, []);

  const rows = useMemo(() => (board.status === "ready" ? board.board.rows : []), [board]);
  const pool = useMemo(() => fromBoard(rows), [rows]);
  const ytCount = yt.status === "ready" ? yt.videos.length : 0;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <header className="relative">
        <div aria-hidden className="pointer-events-none absolute -left-20 -top-16 h-56 w-56 rounded-full bg-mint-400/10 blur-3xl" />
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-400"
        >
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
          Scan any X handle for its Proof of Variational, climb eight levels, collect badges, and see which YouTube creators lead on
          Variational, Hyperliquid, Lighter, Aster, edgeX and Paradex. Every number comes from public data, and every formula is on the page.
        </motion.p>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="relative mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm"
        >
          <span className="text-content-subtle">
            <span className="font-display text-lg font-bold text-content">
              <CountUp value={board.status === "ready" ? board.board.totals.accounts : 0} format={full} />
            </span>{" "}
            X creators
          </span>
          <span className="text-content-subtle">
            <span className="font-display text-lg font-bold text-content">
              <CountUp value={board.status === "ready" ? board.board.totals.views : 0} format={compact} />
            </span>{" "}
            views on Variational posts
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
            onClick={() => setTab(id)}
            className={cn(
              "relative inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 sm:px-4 text-sm font-semibold transition-colors sm:flex-none",
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

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
          {tab === "x" && <XBoard state={board} win={win} setWin={setWin} onOpen={openProfile} isAdmin={isAdmin} onHide={hide} />}
          {tab === "youtube" && <YoutubeBoard state={yt} topic={topic} setTopic={setTopic} />}
          {tab === "arena" && <Arena pool={pool} compareWith={compareWith} />}
        </motion.div>
      </AnimatePresence>

      {profile && (
        <XProfile
          key={profile}
          handle={profile}
          // Profile ranks are all-time, so only an all-time board can say who is next above.
          board={win === "all" ? rows : []}
          onClose={closeProfile}
          onCompare={(h) => {
            setCompareWith(h);
            closeProfile();
            setTab("arena");
          }}
        />
      )}
    </div>
  );
}
