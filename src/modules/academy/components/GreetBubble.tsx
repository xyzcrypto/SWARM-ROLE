"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { Volume2, X } from "lucide-react";
import { lineFor, play, sfx, stopVoice, tryAutoUnlock, unlock, type Piece } from "../client/audio";
import { useAudio, useMe } from "../client/hooks";
import { greetName } from "../client/name-bank";
import { greeting, greetPage, setGreetLineResolver } from "../client/greet";
import { GuideCaption } from "./Guide";

const KEY = "xyz:academy:greeted:v2";
setGreetLineResolver(lineFor);

function seen(k: string): boolean {
  try {
    return Boolean(sessionStorage.getItem(k));
  } catch {
    return false;
  }
}
function mark(k: string) {
  try {
    sessionStorage.setItem(k, "1");
  } catch {
    /* no storage: may greet again next page */
  }
}

/**
 * AneQue greets the member BY NAME as soon as an Academy page opens:
 *
 *  1. If the browser already allows sound (they clicked into the Academy from
 *     elsewhere on the site, or play media here often), she just talks.
 *  2. If not, a speech bubble says "Hey Rahul! Tap to hear me" and she talks
 *     on that tap, or on the first tap anywhere on the page.
 *  3. Either way the bubble shows her words, so it reads the same muted.
 *
 * The full greeting (name, time of day, streak/daily status) plays once per
 * browser session; the library, leaderboard, live and certificate pages get a
 * short line of their own the first time each is opened.
 */
export function GreetBubble({ hidden, onVisible }: { hidden: boolean; onVisible: (v: boolean) => void }) {
  const path = usePathname();
  const page = greetPage(path);
  const { data: session, status } = useSession();
  const { me } = useMe(page === "home");
  const { settings, unlocked, voice } = useAudio();
  const [bubble, setBubble] = useState<{ name: string | null; pieces: Piece[]; waiting: boolean } | null>(null);
  const started = useRef<string | null>(null);

  const sessionName = (session?.user as { name?: string | null } | undefined)?.name;
  const meName = me?.user?.name && me.user.name !== "Learner" ? me.user.name : null;
  const name = greetName(sessionName || meName);
  const ready = status === "unauthenticated" || (status === "authenticated" && (page !== "home" || Boolean(me)));

  // Give the dashboard data a moment on the home page, then greet without it.
  const [waitedLong, setWaitedLong] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setWaitedLong(true), 2500);
    return () => clearTimeout(t);
  }, [path]);

  useEffect(() => {
    if (status === "loading" || (!ready && !waitedLong)) return;
    if (started.current === path) return;
    started.current = path;
    if (!settings.guide) return;
    const first = !seen(KEY);
    const pageKey = `${KEY}:${page}`;
    if (!first && seen(pageKey)) return;
    const pieces = greeting({
      name,
      signedIn: status === "authenticated",
      page,
      hour: new Date().getHours(), // local hour, read after mount only
      first,
      streak: me?.streak,
      learnedToday: me?.learnedToday,
      dailyDone: me ? me.daily?.status === "done" : null,
      r: Math.random(),
    });
    if (!pieces.length) return;
    mark(KEY);
    mark(pageKey);
    let alive = true;
    void (async () => {
      const ok = await tryAutoUnlock();
      if (!alive) return;
      setBubble({ name, pieces, waiting: !ok });
      if (ok) play(pieces);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, status, ready, waitedLong]);

  // Waiting for a tap: the first tap anywhere unlocks audio (GuideDock), and
  // then she speaks.
  useEffect(() => {
    if (bubble?.waiting && unlocked) {
      setBubble((b) => (b ? { ...b, waiting: false } : b));
      play(bubble.pieces);
    }
  }, [unlocked, bubble]);

  // Hide once she has finished (or after a while if nobody taps).
  const spoke = useRef(false);
  useEffect(() => {
    if (!bubble) return;
    if (voice.speaking) spoke.current = true;
    if (!bubble.waiting && spoke.current && !voice.speaking) {
      const t = setTimeout(() => setBubble(null), 1800);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setBubble(null), bubble.waiting ? 14_000 : 20_000);
    return () => clearTimeout(t);
  }, [bubble, voice.speaking]);

  useEffect(() => {
    spoke.current = false;
  }, [path]);

  // On the Academy home the hero card already shows her words, so the bubble
  // is only needed there to ask for the tap.
  const show = Boolean(bubble) && !hidden && (page !== "home" || Boolean(bubble?.waiting));
  useEffect(() => onVisible(show), [show, onVisible]);

  // The bubble's title already says "Hey Riya!", so the caption starts after it.
  const full = bubble ? (voice.speaking && voice.text ? voice.text : bubble.pieces.map((p) => p.text).join(" ")) : "";
  const caption = full.replace(/^Hey [^!]{1,30}!\s*/, "");

  return (
    <AnimatePresence>
      {show && bubble && (
        <motion.div
          key="greet"
          initial={{ opacity: 0, y: 10, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 320, damping: 26 }}
          className="acad-greet pointer-events-none relative mb-3 w-[min(17rem,calc(100vw-2rem))] origin-bottom-left rounded-2xl rounded-bl-md border border-gold-400/30 bg-ink-950/95 p-3.5 shadow-elevate backdrop-blur-xl md:ml-auto md:origin-bottom-right md:rounded-bl-2xl md:rounded-br-md"
          role="status"
          aria-live="polite"
        >
          <button
            type="button"
            onClick={() => {
              stopVoice();
              setBubble(null);
            }}
            className="pointer-events-auto absolute right-1.5 top-1.5 rounded-full p-1 text-content-subtle hover:text-content"
            aria-label="Dismiss AneQue's greeting"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="pr-5 font-display text-sm font-semibold text-content">{bubble.name ? `Hey ${bubble.name}! 👋` : "Hey there! 👋"}</div>
          {bubble.waiting ? (
            <button
              type="button"
              onClick={() => {
                unlock();
                sfx("pop");
              }}
              className="pointer-events-auto mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gold-400/15 px-3 py-2 text-xs font-semibold text-gold-100 transition-colors hover:bg-gold-400/25"
            >
              <Volume2 className="h-4 w-4" /> Tap to hear AneQue
            </button>
          ) : (
            <GuideCaption text={caption} speaking={voice.speaking && !voice.paused} className="mt-1 line-clamp-3 text-[13px] leading-relaxed" />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
