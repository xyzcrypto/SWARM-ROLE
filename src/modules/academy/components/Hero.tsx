"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, AudioLines, CalendarDays, CheckCircle2, Flame, Headphones, Pause, Radio, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { GuideCaption, GuideWave } from "./Guide";
import { Avatar, CountUp, fmt, ProgressBar } from "./ui";
import { pauseVoice, play, resumeVoice, unlock, type Piece } from "../client/audio";
import { useAudio, type Me } from "../client/hooks";
import { VOICE_LINES, type VoiceLine } from "../client/voice-lines";
import type { Pulse } from "./types";

const ease = [0.22, 1, 0.36, 1] as const;
const vline = (k: VoiceLine): Piece => ({ url: `/academy/voice/${k}.mp3`, text: VOICE_LINES[k] });

/** Time left until the daily challenge rolls over (00:00 UTC). Client-only, after mount. */
function useUntilUtcMidnight() {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const next = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate() + 1);
      setLeft(next - now);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return left;
}

const hms = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
};

function Stat({ value, label, live }: { value: number | null; label: string; live?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 font-display text-2xl font-semibold tabular-nums text-content sm:text-3xl">
        {live && <span className="acad-live-dot h-2 w-2 rounded-full bg-mint-400 text-mint-400" />}
        {value == null ? <span className="text-content-subtle">–</span> : <CountUp value={value} />}
      </div>
      <div className="mt-0.5 text-xs text-content-subtle">{label}</div>
    </div>
  );
}

export function Hero({ pulse, me, topics, questions }: { pulse: Pulse | null; me: Me | null; topics: number | null; questions: number | null }) {
  const { voice } = useAudio();
  const speaking = voice.speaking && !voice.paused;
  const left = useUntilUtcMidnight();
  const top = pulse?.top?.slice(0, 3) ?? [];
  const daily = me?.daily;

  const hearGuide = () => {
    unlock();
    if (speaking) return pauseVoice();
    if (voice.paused) return resumeVoice();
    play(me ? [vline("welcome_back"), vline(daily?.status === "done" ? "daily_done" : "daily_new")] : [vline("welcome"), vline("learn_pick")]);
  };

  return (
    <section className="relative isolate">
      <div className="acad-ruled pointer-events-none absolute inset-x-0 -top-6 bottom-0 -z-10" aria-hidden />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-start lg:gap-14 xl:grid-cols-[minmax(0,1fr)_27rem]">
        {/* ---------- copy ---------- */}
        <div className="min-w-0 pt-2 lg:pt-8">
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="text-[13px] font-medium text-content-muted">
            <span className="font-semibold text-gold-300">XYZ Crypto Academy</span>
            <span className="mx-2 text-content-subtle">/</span>
            {topics ?? 14} topics, {questions ?? 280} questions, live quizzes every week
          </motion.p>
          <h1 className="mt-5 font-display text-[clamp(2.25rem,5.6vw,4.25rem)] font-bold leading-[1.02] tracking-[-0.035em] text-content">
            {["Master Web3.", "Prove your knowledge.", "Dominate the leaderboard."].map((t, i) => (
              <motion.span
                key={t}
                className="block"
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.08 + i * 0.1, ease }}
              >
                {i === 2 ? <span className="text-shine">{t}</span> : t}
              </motion.span>
            ))}
          </h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.45 }} className="mt-6 max-w-xl text-[17px] leading-relaxed text-content-muted">
            Learn Web3 through interactive challenges, compete in live quizzes, earn XP, and become one of the top Web3 minds in the community.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.55, ease }} className="mt-8 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            <Link href={me?.next ? `/academy/learn/${me.next.categorySlug}/${me.next.moduleSlug}` : "/academy/learn"} className="btn-primary group h-12 justify-center whitespace-nowrap px-3 text-[13px] sm:px-6 sm:text-sm">
              Start Learning <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-active:translate-x-0.5" />
            </Link>
            <Link href="/academy/live" className="btn-gold h-12 justify-center whitespace-nowrap px-3 text-[13px] sm:px-6 sm:text-sm">
              <Radio className="h-4 w-4" /> Enter Live Quiz
            </Link>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.7 }} className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-hairline pt-6">
            <Stat live value={pulse?.learningNow ?? null} label="learning now" />
            <Stat value={pulse?.quizzesToday ?? null} label="quizzes today" />
            <Stat value={pulse ? pulse.liveParticipants : null} label="in live quizzes" />
          </motion.div>
          {pulse && pulse.achievements.length + pulse.certificates.length > 0 && (
            <div className="acad-ticker mt-6 max-w-xl overflow-hidden" aria-label="Recent activity">
              <div className="acad-ticker-track flex w-max gap-8 text-[13px] text-content-muted">
                {[0, 1].map((k) => (
                  <div key={k} className="flex gap-8" aria-hidden={k === 1}>
                    {pulse.achievements.map((a, i) => (
                      <span key={`a${i}`} className="whitespace-nowrap">
                        <span className="font-semibold text-content">{a.name}</span> unlocked <span className="text-gold-300">{a.title}</span>
                      </span>
                    ))}
                    {pulse.certificates.map((c) => (
                      <span key={c.code} className="whitespace-nowrap">
                        <span className="font-semibold text-content">{c.displayName}</span> earned <span className="text-gold-300">{c.title}</span>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ---------- today card ---------- */}
        <motion.aside
          initial={{ opacity: 0, y: 24, rotate: -1.2 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease }}
          className="acad-ticket relative min-w-0 overflow-hidden rounded-[1.75rem] border border-hairline bg-ink-900/80 shadow-elevate"
          aria-label="Today in the Academy"
        >
          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-content-subtle">
                <CalendarDays className="h-3.5 w-3.5 text-gold-300" /> Daily challenge
              </span>
              <span className="font-mono text-xs tabular-nums text-content-muted" title="Resets at 00:00 UTC">
                {left == null ? "--:--:--" : hms(left)} left
              </span>
            </div>
            {daily?.status === "done" ? (
              <div className="mt-4">
                <div className="flex items-center gap-2 font-display text-2xl font-semibold text-content">
                  <CheckCircle2 className="h-6 w-6 text-mint-300" /> {daily.correct}/{daily.total} today
                </div>
                <p className="mt-1 text-sm text-content-muted">{fmt(daily.score)} points. A new set opens when the clock above runs out.</p>
              </div>
            ) : (
              <div className="mt-4">
                <div className="font-display text-2xl font-semibold leading-tight text-content">Ten questions. Same for everyone.</div>
                <p className="mt-1 text-sm text-content-muted">One attempt, bonus XP, and today&apos;s leaderboard is still open.</p>
              </div>
            )}
            <Link href={me ? "/academy/quiz?mode=daily" : "/login?callbackUrl=/academy/quiz?mode=daily"} className="btn-gold mt-5 h-11 w-full justify-center text-sm">
              {daily?.status === "done" ? "See your answers" : daily?.status === "active" ? "Resume today's challenge" : "Play today's challenge"}
            </Link>
          </div>

          <div className="acad-perforation" aria-hidden />

          <div className="grid grid-cols-2 gap-4 px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-content-subtle">Your run</div>
              {me ? (
                <>
                  <div className="mt-1 flex items-center gap-1.5 font-display text-lg font-semibold text-content">
                    <Flame className={cn("h-4 w-4", me.streak ? "text-gold-300" : "text-content-subtle")} /> {me.streak} day{me.streak === 1 ? "" : "s"}
                  </div>
                  <div className="mt-2 text-[11px] text-content-subtle">
                    Lv {me.level.level} · {fmt(me.xp)} XP
                  </div>
                  <ProgressBar value={me.level.progress} className="mt-1.5 h-1.5" />
                </>
              ) : (
                <Link href="/login?callbackUrl=/academy" className="mt-1 block text-sm font-semibold text-gold-300 hover:underline">
                  Sign in to track XP
                </Link>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-content-subtle">
                <Trophy className="h-3 w-3 text-gold-300" /> This week
              </div>
              {top.length ? (
                <ol className="mt-1.5 space-y-1">
                  {top.map((r) => (
                    <li key={r.userId} className="flex items-center gap-1.5 text-[13px]">
                      <span className="w-3 font-mono text-[11px] text-content-subtle">{r.rank}</span>
                      <Avatar src={r.image} alt={r.name} size={18} />
                      <span className="min-w-0 flex-1 truncate text-content">{r.name}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="mt-1 text-sm text-content-muted">{pulse ? "Nobody yet. Be first." : "…"}</div>
              )}
            </div>
          </div>

          {/* AneQue */}
          <div className="border-t border-hairline bg-ink-950/60 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={hearGuide}
                className={cn("relative grid h-11 w-11 shrink-0 place-items-center rounded-full border transition-colors", speaking ? "border-gold-400/70 bg-gold-400/15 text-gold-200" : "border-hairline bg-ink-900 text-content")}
                aria-label={speaking ? "Pause AneQue" : "Hear AneQue"}
              >
                {speaking ? <Pause className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
                {speaking && <span className="absolute inset-0 animate-ping rounded-full border border-gold-400/40" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-content">
                    AneQue <span className="font-normal text-content-subtle">· AI study partner</span>
                  </span>
                  {(speaking || voice.paused) && <span className="text-[11px] text-content-subtle">{speaking ? "speaking" : "paused"}</span>}
                </div>
                <GuideWave speaking={speaking} bars={28} className="mt-1 h-5" />
              </div>
              <button
                type="button"
                onClick={() => {
                  unlock();
                  window.dispatchEvent(new Event("academy:talk"));
                }}
                className="btn-primary h-10 shrink-0 px-4 text-xs"
                aria-label="Talk to AneQue live"
              >
                <AudioLines className="h-4 w-4" /> Talk
              </button>
            </div>
            <GuideCaption
              text={voice.text || "Ask me anything about Web3 out loud, from funding rates to airdrops. Tap Talk, speak, and I'll answer. I also read every question in my own voice."}
              speaking={speaking}
              className="mt-3 line-clamp-3 text-[13px] leading-relaxed"
            />
          </div>
        </motion.aside>
      </div>
    </section>
  );
}
