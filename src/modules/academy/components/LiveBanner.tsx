"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Radio, X, Zap } from "lucide-react";
import { getJson } from "../client/hooks";
import { sfx } from "../client/audio";
import type { LiveListItem } from "./types";

const DISMISS = "xyz:academy:live-banner:dismissed";
const WINDOW_MS = 7 * 86_400_000; // only announce quizzes within the next week

function hms(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return d > 0 ? `${d}d ${p(h)}:${p(m)}:${p(sec)}` : `${p(h)}:${p(m)}:${p(sec)}`;
}

/**
 * The next live quiz, on every Academy page: a "LIVE NOW" call while one runs,
 * else a countdown to the next one this week. One cached request per mount (the
 * list route is edge-cached), no polling: the countdown runs on the device and a
 * single refetch happens when it reaches zero. Renders nothing until the data
 * arrives, so the server HTML never disagrees with the first client render.
 */
export function LiveBanner() {
  const path = usePathname() ?? "";
  const [items, setItems] = useState<LiveListItem[] | null>(null);
  // Read lazily: it only decides visibility once data exists, and there is
  // no data on the server, so this can never change the server's HTML.
  const [gone, setGone] = useState<string | null>(() => {
    try {
      return typeof window === "undefined" ? null : sessionStorage.getItem(DISMISS);
    } catch {
      return null;
    }
  });
  // The clock lives in state (set from a timer), never read during render.
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    getJson<{ quizzes: LiveListItem[] }>("/api/academy/live").then(
      (d) => alive && setItems(d.quizzes),
      () => undefined
    );
    return () => {
      alive = false;
    };
  }, []);

  const pick = useMemo(() => {
    if (!items || !now) return null;
    const live = items.find((q) => q.state === "live");
    if (live) return { q: live, live: true };
    const next = items
      .filter((q) => q.state === "upcoming" && new Date(q.scheduledAt).getTime() - now < WINDOW_MS)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];
    return next ? { q: next, live: false } : null;
  }, [items, now]);

  // A countdown that reaches zero means the quiz just went live: refetch once.
  // (Only rendered after the client fetched the list, so reading the clock here
  // can never disagree with the server's HTML.)
  const left = pick && !pick.live ? new Date(pick.q.scheduledAt).getTime() - now : null;
  // The server may still call it "upcoming" for a moment (and the list is edge-
  // cached for 10s), so retry every 4s a few times until it flips to live.
  const due = left != null && left <= 0;
  useEffect(() => {
    if (!due) return;
    let tries = 0;
    const id = setInterval(() => {
      if (++tries > 6) return clearInterval(id);
      getJson<{ quizzes: LiveListItem[] }>("/api/academy/live").then((d) => setItems(d.quizzes), () => undefined);
    }, 4000);
    return () => clearInterval(id);
  }, [due]);

  const hidden = !pick || path.startsWith("/academy/live/") || gone === pick.q.id;
  const hide = () => {
    if (!pick) return;
    setGone(pick.q.id);
    try {
      sessionStorage.setItem(DISMISS, pick.q.id);
    } catch {
      /* fine */
    }
  };
  const action = pick ? (
    <>
      {!pick.live && left != null && (
        <div className="acad-live-count font-mono text-lg font-bold tabular-nums text-content sm:text-xl" aria-label="Starts in">
          {left > 0 ? hms(left) : "Starting…"}
        </div>
      )}
      <Link
        href={`/academy/live/${pick.q.id}`}
        onClick={() => sfx("go")}
        className={pick.live ? "btn-primary acad-join-pulse h-10 px-4 text-sm" : "btn-gold h-10 px-4 text-sm"}
      >
        {pick.live ? <Radio className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
        {pick.live ? "Join now" : "Get ready"}
      </Link>
    </>
  ) : null;
  return (
    <AnimatePresence>
      {!hidden && pick && (
        <motion.div
          key={pick.q.id}
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className={pick.live ? "acad-live-banner is-live mb-5 sm:mb-7" : "acad-live-banner mb-5 sm:mb-7"}
          role="status"
        >
          <div className="relative rounded-[1.15rem] px-4 py-3 sm:px-5">
            <div className="flex items-center gap-3 sm:gap-4">
              <span className={pick.live ? "acad-live-dot" : "acad-live-dot is-soon"} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 text-[0.625rem] font-bold uppercase tracking-[0.2em]">
                  {pick.live ? <span className="text-red-400">Live now</span> : <span className="text-gold-300">Next live quiz</span>}
                  <span className="text-content-subtle">· {pick.q.questions} questions</span>
                  {pick.q.participants > 0 && <span className="text-content-subtle">· {pick.q.participants} joined</span>}
                </div>
                <div className="truncate font-display text-[0.9375rem] font-semibold text-content sm:text-base">{pick.q.title}</div>
              </div>
              <div className="hidden items-center gap-4 sm:flex">{action}</div>
              <button
                type="button"
                aria-label="Hide"
                onClick={hide}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-content-subtle hover:bg-white/5 hover:text-content"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Phones: the countdown and the button get their own row. */}
            <div className="mt-2.5 flex items-center justify-between gap-3 sm:hidden">{action}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
