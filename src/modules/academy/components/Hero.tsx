"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Flame, Play, Radio, Trophy, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { NetworkCanvas } from "./NetworkCanvas";
import { GuideOrb } from "./Guide";
import { Avatar, CountUp, fmt, ProgressBar } from "./ui";
import { say, unlock } from "../client/audio";
import { useAudio, type Me } from "../client/hooks";
import type { Pulse } from "./types";

const ease = [0.22, 1, 0.36, 1] as const;

function Line({ children, i, className }: { children: React.ReactNode; i: number; className?: string }) {
  return (
    <motion.span
      className={cn("block", className)}
      initial={{ opacity: 0, y: 28, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.8, delay: 0.1 + i * 0.12, ease }}
    >
      {children}
    </motion.span>
  );
}

function LiveChip({ icon, value, label, live }: { icon: React.ReactNode; value: number | null; label: string; live?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-hairline bg-ink-900/60 px-3 py-1.5 text-xs text-content-muted backdrop-blur">
      {live ? <span className="acad-live-dot h-1.5 w-1.5 rounded-full bg-mint-400 text-mint-400" /> : icon}
      <span className="font-semibold tabular-nums text-content">{value == null ? "–" : <CountUp value={value} />}</span>
      {label}
    </div>
  );
}

export function Hero({ pulse, me }: { pulse: Pulse | null; me: Me | null }) {
  const { voice } = useAudio();
  const speaking = voice.speaking && !voice.paused;
  const top = pulse?.top?.slice(0, 3) ?? [];

  return (
    <section className="relative isolate -mx-5 overflow-hidden px-5 pb-12 pt-6 sm:mx-0 sm:rounded-[2.5rem] sm:border sm:border-hairline sm:px-10 sm:pb-16 sm:pt-12 lg:px-14">
      <div className="acad-grid-bg pointer-events-none absolute inset-0 -z-10" aria-hidden />
      <NetworkCanvas className="pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-80" />
      <div className="pointer-events-none absolute -right-24 -top-24 -z-10 h-96 w-96 rounded-full bg-gold-500/10 blur-3xl" aria-hidden />

      <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-6">
        <div className="min-w-0">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }} className="eyebrow-glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-200">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-300" /> XYZ Crypto Academy
          </motion.div>
          <h1 className="mt-6 font-display text-[clamp(2.1rem,6.4vw,4.6rem)] font-bold uppercase leading-[0.98] tracking-[-0.03em] text-content">
            <Line i={0}>
              <span className="text-shimmer">Master Web3.</span>
            </Line>
            <Line i={1}>
              <span className="text-shimmer">Prove your knowledge.</span>
            </Line>
            <Line i={2}>
              <span className="text-shine">Dominate the leaderboard.</span>
            </Line>
          </h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.55 }} className="mt-6 max-w-xl text-base leading-relaxed text-content-muted sm:text-lg">
            Learn Web3 through interactive challenges, compete in live quizzes, earn XP, and become one of the top Web3 minds in the community.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.7, ease }} className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={me?.next ? `/academy/learn/${me.next.categorySlug}/${me.next.moduleSlug}` : "/academy/learn"} className="btn-primary group h-12 px-6 text-sm">
              Start Learning <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-active:translate-x-0.5" />
            </Link>
            <Link href="/academy/live" className="btn-gold group h-12 px-6 text-sm">
              <Radio className="h-4 w-4" /> Enter Live Quiz
            </Link>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.9 }} className="mt-8 flex flex-wrap gap-2">
            <LiveChip live value={pulse?.learningNow ?? null} label="learning now" icon={null} />
            <LiveChip icon={<Zap className="h-3.5 w-3.5 text-gold-300" />} value={pulse?.quizzesToday ?? null} label="quizzes today" />
            <LiveChip icon={<Users className="h-3.5 w-3.5 text-sky-300" />} value={pulse ? pulse.liveParticipants : null} label={pulse?.liveNow ? "in live quizzes" : "in live quizzes now"} />
          </motion.div>
        </div>

        {/* Nova + previews */}
        <div className="relative mx-auto flex w-full max-w-md flex-col items-center lg:max-w-none">
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2, ease }}
            onClick={() => {
              unlock();
              say(me ? "welcome_back" : "welcome");
            }}
            className="acad-float relative rounded-full focus-visible:outline-none"
            aria-label="Hear Nova, your Academy guide"
          >
            <GuideOrb size={240} speaking={speaking} className="sm:!h-[280px] sm:!w-[280px]" />
            <span className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-gold-400/30 bg-ink-950/80 px-3 py-1 text-[11px] font-semibold text-gold-200 backdrop-blur">
              <Play className="h-3 w-3" /> {speaking ? "Nova is speaking" : "Hear Nova"}
            </span>
          </motion.button>

          <div className="mt-6 grid w-full gap-3 sm:grid-cols-2">
            <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.8, ease }} className="glass rounded-2xl p-4">
              {me ? (
                <>
                  <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-content-subtle">
                    <span>Level {me.level.level}</span>
                    <span className="text-gold-300">{me.level.name}</span>
                  </div>
                  <div className="mt-2 font-display text-2xl font-bold text-content">
                    <CountUp value={me.xp} /> <span className="text-sm font-semibold text-gold-300">XP</span>
                  </div>
                  <ProgressBar value={me.level.progress} className="mt-3" />
                  <div className="mt-1.5 text-[11px] text-content-subtle">{me.level.next == null ? "Max level reached" : `${fmt(me.level.toNext)} XP to level ${me.level.level + 1}`}</div>
                </>
              ) : (
                <>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-content-subtle">Your progress</div>
                  <div className="mt-2 text-sm leading-relaxed text-content-muted">Every correct answer earns XP. Six levels from Web3 Beginner to Crypto Legend.</div>
                  <Link href="/login?callbackUrl=/academy" className="mt-3 inline-flex text-xs font-semibold text-gold-300 hover:text-gold-200">
                    Sign in to start tracking →
                  </Link>
                </>
              )}
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.95, ease }} className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-content-subtle">
                <span>This week</span>
                <Trophy className="h-3.5 w-3.5 text-gold-300" />
              </div>
              {top.length ? (
                <ul className="mt-2 space-y-1.5">
                  {top.map((r) => (
                    <li key={r.userId} className="flex items-center gap-2 text-sm">
                      <span className={cn("w-4 text-center font-mono text-xs font-bold", r.rank === 1 ? "text-gold-300" : r.rank === 2 ? "text-zinc-300" : "text-amber-600")}>{r.rank}</span>
                      <Avatar src={r.image} alt={r.name} size={22} />
                      <span className="min-w-0 flex-1 truncate text-content">{r.name}</span>
                      <span className="font-mono text-xs text-gold-300">{fmt(r.xp)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-2 text-sm leading-relaxed text-content-muted">
                  {pulse ? "No one has scored this week yet. The top spot is open." : "Loading the board…"}
                </div>
              )}
              {me?.streak ? (
                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-content-subtle">
                  <Flame className="h-3.5 w-3.5 text-gold-300" /> {me.streak}-day streak
                </div>
              ) : null}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
