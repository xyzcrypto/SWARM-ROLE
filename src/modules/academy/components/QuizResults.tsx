"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, Award, CheckCircle2, ChevronDown, Copy, GraduationCap, RotateCcw, Share2, Sparkles, Swords, Timer, Trophy, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { play, say, sfx, type Piece } from "../client/audio";
import { useAudio } from "../client/hooks";
import { VOICE_LINES, type VoiceLine } from "../client/voice-lines";

const line = (k: VoiceLine): Piece => ({ url: `/academy/voice/${k}.mp3`, text: VOICE_LINES[k] });
import type { QuizResult } from "./types";
import { ShareSheet } from "./ShareSheet";
import { burstConfetti, CountUp, DIFF_LABEL, DIFF_TONE, duration, Eyebrow, fmt, Panel, Pill, ProgressBar, shareOnX } from "./ui";

const LETTERS = ["A", "B", "C", "D"];

function Ring({ pct }: { pct: number }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-36 w-36">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
        <motion.circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke="url(#acadRing)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct / 100) }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        />
        <defs>
          <linearGradient id="acadRing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f3d488" />
            <stop offset="100%" stopColor="#34e3a1" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-display text-3xl font-bold text-content">
            <CountUp value={pct} format={(n) => `${Math.round(n)}%`} />
          </div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-content-subtle">accuracy</div>
        </div>
      </div>
    </div>
  );
}

export function QuizResults({ result: r, onPlayAgain }: { result: QuizResult; onPlayAgain: () => void }) {
  const [review, setReview] = useState(false);
  const [copied, setCopied] = useState(false);
  const { settings } = useAudio();
  const leveled = r.level.after.level > r.level.before.level;
  const announced = useRef(false);
  // The share link is a page whose preview is the score card; it offers the
  // same questions as a challenge.
  const challengeUrl = typeof window !== "undefined" ? `${window.location.origin}/academy/s/quiz/${r.attemptId}` : "";

  useEffect(() => {
    if (announced.current) return;
    announced.current = true;
    const t = setTimeout(() => {
      // One spoken recap, in order: the round, then whatever it unlocked.
      const pieces: Piece[] = [];
      const pick = (prefix: string, n: number) => {
        const k = (n > 1 && Math.random() < 0.5 ? `${prefix}_2` : prefix) as VoiceLine;
        return line(k in VOICE_LINES ? k : (prefix as VoiceLine));
      };
      if (r.mode === "module") pieces.push(line(r.moduleCompleted ? (Math.random() < 0.5 ? "lesson_done" : "module_done_2") : "module_failed"));
      else if (r.accuracy === 100 && r.total >= 5) pieces.push(pick("result_perfect", 2));
      else if (r.accuracy >= 80) pieces.push(pick("result_great", 2));
      else if (r.accuracy >= 60) pieces.push(pick("result_good", 2));
      else if (r.accuracy >= 40) pieces.push(pick("result_ok", 2));
      else pieces.push(pick("result_low", 2));
      if (r.challenge) pieces.push(line(r.score > r.challenge.score ? "challenge_win" : r.score === r.challenge.score ? "challenge_tie" : "challenge_lose"));
      if (leveled && `level_${r.level.after.level}` in VOICE_LINES) pieces.push(line(`level_${r.level.after.level}` as VoiceLine));
      for (const u of r.unlocked.slice(0, 3)) if (`ach_${u.code}` in VOICE_LINES) pieces.push(line(`ach_${u.code}` as VoiceLine));
      if (r.xp.streak > 0 && `streak_day_${r.streak}` in VOICE_LINES) pieces.push(line(`streak_day_${r.streak}` as VoiceLine));
      if (r.rank.after === 1 && r.rank.before !== 1) pieces.push(line("rank_first"));
      else if (r.rank.after && r.rank.after <= 3 && (r.rank.before ?? 99) > 3) pieces.push(line("top3"));
      else if (r.rank.before && r.rank.after && r.rank.after < r.rank.before) pieces.push(line("rank_up"));
      if (r.xp.total === 0 && r.correct > 0) pieces.push(line("no_xp"));

      if (leveled) {
        sfx("levelup");
        burstConfetti();
      } else if (r.unlocked.length) {
        sfx("achievement");
        burstConfetti();
      } else if (r.accuracy >= 80) {
        sfx("winner");
        burstConfetti();
      } else sfx("xp");
      if (settings.guide) play(pieces);
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moved = r.rank.before && r.rank.after ? r.rank.before - r.rank.after : null;
  const wrong = r.total - r.correct;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="text-center">
        <Eyebrow>{r.mode === "module" ? "Knowledge check" : r.mode === "daily" ? "Daily challenge" : r.mode === "weekly" ? "Weekly challenge" : "Quiz complete"}</Eyebrow>
        <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-2 font-display text-3xl font-semibold tracking-tight text-content sm:text-5xl">
          {r.accuracy === 100 ? <span className="text-shine">Flawless.</span> : r.accuracy >= 80 ? <span className="text-gold-gradient">Brilliant work.</span> : r.accuracy >= 50 ? "Solid round." : "Every miss is a lesson."}
        </motion.h1>
        {r.mode === "module" && (
          <p className={cn("mt-2 text-sm", r.moduleCompleted ? "text-mint-300" : "text-content-muted")}>
            {r.moduleCompleted ? "Lesson complete. It now counts toward your progress." : "Score 60% or more to complete the lesson. Review the answers and try again."}
          </p>
        )}
      </div>

      <AnimatePresence>
        {leveled && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, type: "spring" }} className="mx-auto mt-6 flex max-w-md items-center gap-4 rounded-3xl border border-gold-300/60 bg-gold-400/10 p-4 shadow-gold">
            <GraduationCap className="h-10 w-10 shrink-0 text-gold-200" />
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-300">Level up</div>
              <div className="font-display text-xl font-bold text-content">
                Level {r.level.after.level}: {r.level.after.name}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-8 grid gap-5 md:grid-cols-[auto_1fr]">
        <Panel className="flex flex-col items-center justify-center gap-4 md:px-10">
          <Ring pct={r.accuracy} />
          <div className="text-center">
            <div className="font-display text-4xl font-bold text-content">
              <CountUp value={r.score} />
            </div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-content-subtle">final score</div>
          </div>
        </Panel>
        <Panel delay={0.05}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-mint-400/25 bg-mint-400/[0.04] p-3.5">
              <CheckCircle2 className="h-4 w-4 text-mint-300" />
              <div className="mt-2 font-display text-2xl font-bold text-content">{r.correct}</div>
              <div className="text-[11px] text-content-subtle">correct</div>
            </div>
            <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.03] p-3.5">
              <XCircle className="h-4 w-4 text-red-300" />
              <div className="mt-2 font-display text-2xl font-bold text-content">{wrong}</div>
              <div className="text-[11px] text-content-subtle">incorrect</div>
            </div>
            <div className="rounded-2xl border border-hairline p-3.5">
              <Timer className="h-4 w-4 text-sky-300" />
              <div className="mt-2 font-display text-2xl font-bold text-content">{duration(r.timeMs)}</div>
              <div className="text-[11px] text-content-subtle">time taken</div>
            </div>
            <div className="rounded-2xl border border-gold-400/30 bg-gold-400/[0.05] p-3.5">
              <Sparkles className="h-4 w-4 text-gold-300" />
              <div className="mt-2 font-display text-2xl font-bold text-gold-200">
                +<CountUp value={r.xp.total} />
              </div>
              <div className="text-[11px] text-content-subtle">XP earned</div>
            </div>
          </div>

          <div className="mt-5 space-y-1.5 text-sm">
            {[
              { l: "Quiz XP", v: r.xp.quiz },
              { l: "Streak bonus", v: r.xp.streak },
              { l: "Lesson completed", v: r.xp.module },
              { l: "Achievements", v: r.xp.achievements },
            ]
              .filter((x) => x.v > 0)
              .map((x) => (
                <div key={x.l} className="flex justify-between text-content-muted">
                  <span>{x.l}</span>
                  <span className="font-mono text-gold-200">+{fmt(x.v)}</span>
                </div>
              ))}
            {r.xp.total === 0 && (
              <p className="text-[13px] text-content-subtle">
                {r.correct === 0 ? "No XP this round: XP is only earned by correct answers." : "No new XP: these answers were practice repeats, or today's quiz XP cap is reached."}
              </p>
            )}
          </div>

          <div className="mt-5">
            <div className="flex justify-between text-xs text-content-subtle">
              <span>
                Level {r.level.after.level} · {r.level.after.name}
              </span>
              <span>{r.level.after.next == null ? "Max level" : `${fmt(r.level.after.toNext)} XP to next`}</span>
            </div>
            <ProgressBar value={r.level.after.progress} className="mt-1.5" />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5 text-content-muted">
              <Trophy className="h-4 w-4 text-gold-300" /> All-time rank {r.rank.after ? `#${fmt(r.rank.after)}` : "–"}
            </span>
            {moved != null && moved !== 0 && (
              <span className={cn("flex items-center gap-1 text-xs font-semibold", moved > 0 ? "text-mint-300" : "text-red-400")}>
                {moved > 0 ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                {Math.abs(moved)} {Math.abs(moved) === 1 ? "place" : "places"}
              </span>
            )}
            {r.rank.before == null && r.rank.after && <span className="text-xs font-semibold text-sky-300">New on the board</span>}
          </div>
        </Panel>
      </div>

      {r.challenge && (
        <Panel className="mt-5">
          <div className="flex items-center gap-4">
            <Swords className="h-6 w-6 text-gold-300" />
            <div className="flex-1 text-sm text-content-muted">
              <span className="font-semibold text-content">{r.challenge.name}</span> scored {fmt(r.challenge.score)} ({r.challenge.correct}/{r.challenge.total}). You scored {fmt(r.score)}.
            </div>
            <span className={cn("font-display text-lg font-bold", r.score > r.challenge.score ? "text-mint-300" : r.score === r.challenge.score ? "text-content" : "text-red-300")}>
              {r.score > r.challenge.score ? "You win" : r.score === r.challenge.score ? "Tie" : "They win"}
            </span>
          </div>
        </Panel>
      )}

      {r.unlocked.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {r.unlocked.map((u, i) => (
            <motion.div key={u.code} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 + i * 0.15 }} className="flex items-center gap-3 rounded-2xl border border-gold-400/40 bg-gold-400/[0.06] p-4">
              <Award className="h-7 w-7 text-gold-200" />
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-300">Achievement unlocked</div>
                <div className="font-semibold text-content">{u.title}</div>
              </div>
              <span className="ml-auto font-mono text-sm text-gold-200">+{u.xp}</span>
            </motion.div>
          ))}
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <button type="button" onClick={onPlayAgain} className="btn-primary h-12 justify-center text-sm">
          <RotateCcw className="h-4 w-4" /> Play Again
        </button>
        <button type="button" onClick={() => setReview((v) => !v)} className="btn-secondary h-12 justify-center text-sm" aria-expanded={review}>
          <ChevronDown className={cn("h-4 w-4 transition-transform", review && "rotate-180")} /> Review Answers
        </button>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(challengeUrl);
              setCopied(true);
              say("challenge_sent", { auto: true });
              setTimeout(() => setCopied(false), 2000);
            } catch {
              /* clipboard blocked: the X share still works */
            }
            shareOnX(`I scored ${fmt(r.score)} (${r.correct}/${r.total}) on XYZ Crypto Academy. Same questions, can you beat me?`, challengeUrl);
          }}
          className="btn-gold h-12 justify-center text-sm"
        >
          {copied ? <Copy className="h-4 w-4" /> : <Share2 className="h-4 w-4" />} {copied ? "Link copied" : "Challenge Friends"}
        </button>
        <Link href="/academy" className="btn-ghost h-12 justify-center text-sm">
          Back to Academy
        </Link>
      </div>

      <div className="mt-4 rounded-2xl border border-hairline bg-white/[0.02] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-content-subtle">Share your score card</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/academy/card/quiz/${r.attemptId}`} alt="" width={120} height={63} className="hidden h-[63px] w-[120px] rounded-lg border border-hairline object-cover sm:block" loading="lazy" />
        </div>
        <ShareSheet url={challengeUrl} image={`/academy/card/quiz/${r.attemptId}`} text={`I scored ${fmt(r.score)} (${r.correct}/${r.total}) on XYZ Crypto Academy. Same questions, can you beat me?`} fileName="xyz-quiz-score.png" />
      </div>

      <AnimatePresence>
        {review && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-6 space-y-3">
              {r.review.map((q) =>
                q ? (
                  <div key={q.index} className="surface rounded-3xl p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-content-subtle">Q{q.index + 1}</span>
                      <Pill tone={DIFF_TONE[q.difficulty]}>{DIFF_LABEL[q.difficulty]}</Pill>
                      <span className={cn("ml-auto text-xs font-semibold", q.correct ? "text-mint-300" : "text-red-300")}>{q.correct ? `+${q.points}` : q.chosen === -1 ? "Timed out" : "Incorrect"}</span>
                    </div>
                    <div className="mt-2 font-semibold leading-snug text-content">{q.prompt}</div>
                    <ul className="mt-3 space-y-1.5">
                      {q.options.map((o, i) => (
                        <li
                          key={i}
                          className={cn(
                            "flex gap-2 rounded-xl px-3 py-2 text-sm",
                            i === q.correctShown ? "bg-mint-400/10 text-mint-100" : i === q.chosen ? "bg-red-400/10 text-red-200" : "text-content-muted"
                          )}
                        >
                          <span className="font-mono text-xs">{LETTERS[i]}</span> {o}
                        </li>
                      ))}
                    </ul>
                    {q.explanation && <p className="mt-3 text-sm leading-relaxed text-content-muted">{q.explanation}</p>}
                  </div>
                ) : null
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
