"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Award, BookOpen, CalendarDays, CheckCircle2, Flame, Lock, Swords, Target, Trophy, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Me } from "../client/hooks";
import { Avatar, CountUp, Eyebrow, fmt, Icon, LEVEL_LABEL, Panel, Pill, DIFF_TONE, ProgressBar, Stat, utcDate } from "./ui";

const BOARD_LABEL: Record<string, string> = { daily: "Today", weekly: "This week", monthly: "This month", alltime: "All-time" };

function WeekChart({ week }: { week: Me["week"] }) {
  const max = Math.max(1, ...week.map((w) => w.xp));
  return (
    // Columns stretch to the chart's full height; the bars are a % of that.
    // (With items-end the columns shrank to their label, so every bar was
    // a percentage of zero and the chart rendered empty.)
    <div className="flex h-28 gap-2">
      {week.map((w, i) => {
        const d = new Date(`${w.day}T00:00:00Z`);
        const label = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
        return (
          <div key={w.day} className="flex h-full min-w-0 flex-1 flex-col items-center gap-1.5" title={`${w.day}: ${fmt(w.xp)} XP`}>
            <div className="relative flex min-h-0 w-full flex-1 items-end">
              <motion.div
                className={cn("w-full rounded-t-lg", i === week.length - 1 ? "bg-gradient-to-t from-gold-600 to-gold-300" : "bg-gradient-to-t from-gold-700/50 to-gold-400/50")}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(w.xp ? 6 : 2, (w.xp / max) * 100)}%` }}
                transition={{ duration: 0.8, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <span className="text-[10px] uppercase tracking-wide text-content-subtle">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function ChallengeCard({ kind, state, href }: { kind: "daily" | "weekly"; state: Me["daily"]; href: string }) {
  const done = state?.status === "done";
  const active = state?.status === "active";
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border p-4 transition-colors",
        done ? "border-mint-400/30 bg-mint-400/[0.04]" : "border-gold-400/30 bg-gold-400/[0.05] hover:border-gold-400/60"
      )}
    >
      <div className="flex items-center justify-between">
        <Eyebrow>{kind === "daily" ? "Daily challenge" : "Weekly challenge"}</Eyebrow>
        {done ? <CheckCircle2 className="h-4 w-4 text-mint-300" /> : kind === "daily" ? <CalendarDays className="h-4 w-4 text-gold-300" /> : <Trophy className="h-4 w-4 text-gold-300" />}
      </div>
      <div className="mt-3 font-display text-lg font-semibold text-content">
        {done ? `${state!.correct}/${state!.total} correct` : active ? "Pick up where you left off" : kind === "daily" ? "10 questions, same for everyone" : "20 questions, one shot a week"}
      </div>
      <div className="mt-1 flex items-center gap-1 text-xs text-content-subtle">
        {done ? `${fmt(state!.score)} points. Back ${kind === "daily" ? "tomorrow" : "next week"}.` : <>Bonus XP <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-active:translate-x-0.5" /></>}
      </div>
    </Link>
  );
}

export function Dashboard({ me }: { me: Me }) {
  const rank = me.standing.alltime?.rank;
  const earned = me.achievements.filter((a) => a.earnedAt);
  return (
    <div className="mt-10 space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Panel className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-gold-500/10 blur-3xl" aria-hidden />
          <div className="flex items-center gap-4">
            <Avatar src={me.user?.image ?? null} alt={me.user?.name ?? "You"} size={60} className="ring-2 ring-gold-400/40 ring-offset-2 ring-offset-ink-950" />
            <div className="min-w-0">
              <Eyebrow>Level {me.level.level}</Eyebrow>
              <div className="truncate font-display text-xl font-semibold text-content sm:text-2xl">{me.user?.name}</div>
              <div className="text-sm text-gold-300">{me.level.name}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="font-display text-3xl font-bold text-content">
                <CountUp value={me.xp} />
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-content-subtle">Total XP</div>
            </div>
          </div>
          <div className="mt-5">
            <ProgressBar value={me.level.progress} className="h-2.5" />
            <div className="mt-2 flex justify-between text-[11px] text-content-subtle">
              <span>{fmt(me.level.floor)} XP</span>
              <span>{me.level.next == null ? "Max level" : `${fmt(me.level.toNext)} XP to ${me.levels[me.level.level]?.name ?? "next level"}`}</span>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Stat label="Global rank" value={rank ? `#${fmt(rank)}` : "–"} sub={me.standing.alltime ? `of ${fmt(me.standing.alltime.size)}` : undefined} accent icon={<Trophy className="h-3 w-3" />} />
            <Stat label="Streak" value={`${me.streak}d`} sub={me.learnedToday ? "Learned today" : me.streak ? "Learn today to keep it" : `Best ${me.bestStreak}d`} icon={<Flame className="h-3 w-3" />} />
            <Stat label="Quizzes" value={fmt(me.quizzes)} sub={`${fmt(me.answered)} answers`} icon={<Swords className="h-3 w-3" />} />
            <Stat label="Accuracy" value={me.accuracy == null ? "–" : `${me.accuracy}%`} sub={`${me.certificates.filter((c) => c.status === "issued").length} certificates`} icon={<Target className="h-3 w-3" />} />
          </div>
        </Panel>

        <Panel delay={0.05}>
          <div className="flex items-center justify-between">
            <Eyebrow>Weekly performance</Eyebrow>
            <span className="font-mono text-xs text-gold-300">{fmt(me.week.reduce((s, w) => s + w.xp, 0))} XP</span>
          </div>
          <div className="mt-4">
            <WeekChart week={me.week} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {(["daily", "weekly", "monthly", "alltime"] as const).map((p) => (
              <Link key={p} href={`/academy/leaderboard?period=${p}`} className="rounded-xl border border-hairline px-3 py-2 transition-colors hover:border-gold-400/40">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-content-subtle">{BOARD_LABEL[p]}</div>
                <div className="mt-0.5 flex items-baseline justify-between gap-2">
                  <span className="font-display text-base font-semibold text-content">{me.standing[p]?.rank ? `#${fmt(me.standing[p].rank!)}` : "Unranked"}</span>
                  <span className="font-mono text-[11px] text-content-subtle">{fmt(me.standing[p]?.xp ?? 0)} XP</span>
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-1">
          <Eyebrow>Continue learning</Eyebrow>
          {me.active ? (
            <Link href={`/academy/quiz?resume=${me.active.id}`} className="group mt-3 block rounded-2xl border border-gold-400/30 bg-gold-400/[0.05] p-4 hover:border-gold-400/60">
              <div className="text-xs text-content-subtle">Quiz in progress</div>
              <div className="mt-1 font-display text-lg font-semibold text-content">
                Question {me.active.at} of {me.active.total}
              </div>
              <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-gold-300">
                Resume <ArrowRight className="h-3 w-3" />
              </div>
            </Link>
          ) : me.next ? (
            <Link href={`/academy/learn/${me.next.categorySlug}/${me.next.moduleSlug}`} className="group mt-3 block rounded-2xl border border-hairline p-4 transition-colors hover:border-gold-400/50">
              <div className="flex items-center gap-2 text-xs text-content-subtle">
                <BookOpen className="h-3.5 w-3.5" /> {me.next.category}
              </div>
              <div className="mt-1 font-display text-lg font-semibold leading-snug text-content">{me.next.module}</div>
              <div className="mt-2 flex items-center gap-2">
                <Pill tone={DIFF_TONE[me.next.level]}>{LEVEL_LABEL[me.next.level]}</Pill>
                <span className="text-[11px] text-content-subtle">{me.next.minutes} min</span>
                <ArrowRight className="ml-auto h-4 w-4 text-gold-300 transition-transform group-hover:translate-x-0.5 group-active:translate-x-0.5" />
              </div>
            </Link>
          ) : (
            <div className="mt-3 rounded-2xl border border-mint-400/30 p-4 text-sm text-content-muted">Every lesson complete. Remarkable. Keep sharp with the daily challenge.</div>
          )}
          <div className="mt-4">
            <div className="flex justify-between text-[11px] text-content-subtle">
              <span>Learning progress</span>
              <span>
                {me.progress.done}/{me.progress.total} lessons
              </span>
            </div>
            <ProgressBar value={me.progress.total ? me.progress.done / me.progress.total : 0} tone="mint" className="mt-1.5" />
          </div>
        </Panel>
        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
          <ChallengeCard kind="daily" state={me.daily} href="/academy/quiz?mode=daily" />
          <ChallengeCard kind="weekly" state={me.weekly} href="/academy/quiz?mode=weekly" />
          <Link href="/academy/quiz?mode=quick" className="group flex items-center gap-3 rounded-2xl border border-hairline p-4 transition-colors hover:border-gold-400/40">
            <Zap className="h-5 w-5 text-gold-300" />
            <div className="min-w-0">
              <div className="font-semibold text-content">Quick quiz</div>
              <div className="text-xs text-content-subtle">10 mixed questions, about 4 minutes</div>
            </div>
            <ArrowRight className="ml-auto h-4 w-4 text-content-subtle transition-transform group-hover:translate-x-0.5 group-active:translate-x-0.5" />
          </Link>
          <Link href="/academy/live" className="group flex items-center gap-3 rounded-2xl border border-hairline p-4 transition-colors hover:border-gold-400/40">
            <span className="acad-live-dot h-2 w-2 rounded-full bg-mint-400 text-mint-400" />
            <div className="min-w-0">
              <div className="font-semibold text-content">Live quiz arena</div>
              <div className="text-xs text-content-subtle">Compete in real time</div>
            </div>
            <ArrowRight className="ml-auto h-4 w-4 text-content-subtle transition-transform group-hover:translate-x-0.5 group-active:translate-x-0.5" />
          </Link>
        </div>
      </div>

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Eyebrow>Achievements</Eyebrow>
          <span className="flex items-center gap-3 text-xs text-content-subtle">
            {earned.length} of {me.achievements.length} unlocked
            <Link href="/academy/achievements" className="font-semibold text-gold-600 hover:text-gold-500 dark:text-gold-300 dark:hover:text-gold-200">
              View all badges
            </Link>
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {me.achievements.map((a) => (
            <div
              key={a.code}
              title={a.description}
              className={cn("relative rounded-2xl border p-3.5 transition-colors", a.earnedAt ? "border-gold-400/40 bg-gold-400/[0.06]" : "border-hairline opacity-60")}
            >
              <div className={cn("grid h-9 w-9 place-items-center rounded-xl", a.earnedAt ? "bg-gold-400/15 text-gold-200" : "bg-white/[0.04] text-content-subtle")}>
                {a.earnedAt ? <Icon name={a.icon} className="h-4.5 w-4.5 h-[18px] w-[18px]" /> : <Lock className="h-4 w-4" />}
              </div>
              <div className="mt-2.5 text-[13px] font-semibold leading-snug text-content">{a.title}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-content-subtle">{a.earnedAt ? `Earned ${utcDate(a.earnedAt)}` : a.description}</div>
              <span className="absolute right-3 top-3 font-mono text-[10px] text-gold-300/80">+{a.xp}</span>
            </div>
          ))}
        </div>
      </Panel>

      {me.certificates.length > 0 && (
        <Panel>
          <div className="flex items-center justify-between">
            <Eyebrow>Your certificates</Eyebrow>
            <Link href="/academy/certificates" className="text-xs font-semibold text-gold-300 hover:text-gold-200">
              View all
            </Link>
          </div>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {me.certificates.slice(0, 3).map((c) => (
              <Link key={c.code} href={`/academy/certificate/${c.code}`} className="flex items-center gap-3 rounded-2xl border border-gold-400/30 p-3.5 hover:border-gold-400/60">
                <Award className="h-6 w-6 text-gold-300" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-content">{c.title}</div>
                  <div className="text-[11px] text-content-subtle">
                    {c.status === "pending" ? "Awaiting approval" : `#${c.rank} · ${utcDate(c.issuedAt)}`}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
