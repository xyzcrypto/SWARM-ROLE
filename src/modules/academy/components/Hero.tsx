"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, AudioLines, BadgeCheck, CalendarDays, CheckCircle2, Flame, Gauge, Headphones, Pause, Radio, Trophy, Unlock, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { GuideCaption, GuideWave } from "./Guide";
import { Avatar, CountUp, fmt, Icon, ProgressBar, rise } from "./ui";
import { lineFor, pauseVoice, play, resumeVoice, unlock, type Piece } from "../client/audio";
import { useAudio, type Me } from "../client/hooks";
import { VOICE_LINES, type VoiceLine } from "../client/voice-lines";
import type { CatalogCategory, Pulse } from "./types";
import { greetName } from "../client/name-bank";

const ease = [0.22, 1, 0.36, 1] as const;
const vline = (k: VoiceLine): Piece => lineFor(k);

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

function Stat({ value, label, live, accent, href }: { value: number | null; label: string; live?: boolean; accent?: boolean; href?: string }) {
  const body = (
    <>
      <div className={cn("flex items-center gap-1.5 font-display text-[1.35rem] font-semibold leading-none tabular-nums sm:text-[1.7rem]", accent ? "text-gold-gradient" : "text-content")}>
        {live && <span className="acad-live-dot h-1.5 w-1.5 shrink-0 rounded-full bg-mint-400 text-mint-400" />}
        {value == null ? <span className="acad-skel inline-block h-6 w-9 rounded-md" aria-label="Loading" /> : <CountUp value={value} />}
      </div>
      <div className="mt-1.5 truncate font-mono text-[8.5px] uppercase tracking-[0.04em] text-content-subtle sm:text-[10px] sm:tracking-[0.14em]">{label}</div>
    </>
  );
  const cls = "acad-stat block min-w-0 rounded-2xl px-2 py-3 sm:px-4 sm:py-3.5";
  return href ? (
    <Link href={href} className={cls} title={label}>
      {body}
    </Link>
  ) : (
    <div className={cls} title={label}>
      {body}
    </div>
  );
}

/** Time-of-day greeting, decided after mount (the server has no idea of the reader's clock). */
function useDayPart() {
  const [part, setPart] = useState<string | null>(null);
  useEffect(() => {
    const h = new Date().getHours();
    setPart(h < 5 ? "Up late" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
  }, []);
  return part;
}

/**
 * Desktop-only 3D tilt for the ticket. Writes CSS variables straight to the
 * element on pointer move, so it is never a render input (no hydration risk)
 * and touch screens never see it (the CSS applies it under (hover: hover)).
 */
function useTilt<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--rx", `${(-y * 5).toFixed(2)}deg`);
        el.style.setProperty("--ry", `${(x * 6).toFixed(2)}deg`);
        el.style.setProperty("--mx", `${((x + 0.5) * 100).toFixed(1)}%`);
        el.style.setProperty("--my", `${((y + 0.5) * 100).toFixed(1)}%`);
      });
    };
    const leave = () => {
      cancelAnimationFrame(raf);
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, []);
  return ref;
}

const QUICK = [
  { href: "/academy/quiz?mode=daily", label: "Daily", icon: CalendarDays, tone: "bg-gold-400/15 text-gold-600 dark:text-gold-200", auth: true },
  { href: "/academy/quiz?mode=quick", label: "Quick quiz", icon: Zap, tone: "bg-mint-400/15 text-mint-600 dark:text-mint-300", auth: true },
  { href: "/academy/leaderboard", label: "Ranks", icon: Trophy, tone: "bg-violet-400/15 text-violet-600 dark:text-violet-300", auth: false },
  { href: "/academy/certificates", label: "Certificates", icon: BadgeCheck, tone: "bg-sky-400/15 text-sky-600 dark:text-sky-300", auth: false },
];

const PROMISES = [
  { icon: Unlock, text: "Free to learn" },
  { icon: Gauge, text: "Scored on the server" },
  { icon: BadgeCheck, text: "Verifiable certificates" },
  { icon: AudioLines, text: "A tutor you can talk to" },
];

export function Hero({ pulse, me, topics, questions, tracks }: { pulse: Pulse | null; me: Me | null; topics: number | null; questions: number | null; tracks?: CatalogCategory[] | null }) {
  const { voice } = useAudio();
  const dayPart = useDayPart();
  const tilt = useTilt<HTMLElement>();
  const first = greetName(me?.user?.name && me.user.name !== "Learner" ? me.user.name : null);
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
    <>
    <section className="acad-stage relative isolate overflow-hidden rounded-[2rem] px-4 pb-5 pt-5 sm:px-8 sm:pb-8 sm:pt-8 lg:px-10 lg:py-8">
      {/* The stage: aurora light, a fine dot grid and a gold hairline on top. */}
      <div className="acad-aurora pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <span className="acad-aurora-a" />
        <span className="acad-aurora-b" />
        <span className="acad-aurora-c" />
      </div>
      <div className="acad-dots pointer-events-none absolute inset-0 -z-10" aria-hidden />
      {/* Phones: intro, quick actions, today's card, then the numbers - an app
          home screen, not a long column of text. Desktop: copy left, card right. */}
      <div className="acad-hero-grid grid gap-6 lg:items-center lg:gap-x-14">
        {/* ---------- intro ---------- */}
        <div className="min-w-0 pt-1 [grid-area:top]">
          <motion.div style={rise({ y: 8, dur: 0.5 })} className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="acad-hero-pill inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-gold-400/[0.08] py-1 pl-1.5 pr-3 text-[12px] font-medium text-content-muted">
              <span className="rounded-full bg-gold-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-950">Academy</span>
              {me && dayPart ? (
                <span>
                  {dayPart}
                  {first ? (
                    <>
                      , <span className="font-semibold text-content">{first}</span>
                    </>
                  ) : null}
                </span>
              ) : (
                <span>
                  {topics ?? 21} tracks · {fmt(questions ?? 510)} questions
                </span>
              )}
            </span>
            {pulse && pulse.learningNow > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-mint-400/30 bg-mint-400/10 px-2.5 py-1 text-[11px] font-semibold text-mint-600 dark:text-mint-300">
                <span className="acad-live-dot h-1.5 w-1.5 rounded-full bg-mint-400 text-mint-400" /> {fmt(pulse.learningNow)} learning
              </span>
            )}
          </motion.div>
          <h1 className="acad-hero-title mt-5 font-display font-semibold text-content sm:mt-6">
            <motion.span className="block" style={rise({ y: 24, dur: 0.75, delay: 0.08 })}>
              <span className="acad-title-ink">Master </span>
              <span className="text-shine">Web3.</span>
            </motion.span>
            <motion.span className="acad-hero-sub block" style={rise({ y: 24, dur: 0.75, delay: 0.2 })}>
              <span className="text-shimmer">Prove it on the leaderboard.</span>
            </motion.span>
          </h1>
          <motion.p style={rise({ dur: 0.6, delay: 0.45 })} className="mt-4 max-w-[34rem] text-[15px] leading-relaxed text-content-muted sm:mt-5 sm:text-[17px]">
            <span className="sm:hidden">Bite-size lessons, live quiz battles, and AneQue explaining every answer in English or Hinglish.</span>
            <span className="hidden sm:inline">Bite-size lessons, quizzes against the clock and live battles, with AneQue explaining every answer out loud, in English or Hinglish. Earn XP, climb the board, get certified.</span>
          </motion.p>
          <motion.div style={rise({ y: 8, dur: 0.5, delay: 0.55 })} className="mt-6 grid grid-cols-[1fr_1fr_auto] gap-2.5 sm:mt-8 sm:flex sm:flex-wrap sm:gap-3">
            <Link href={me?.next ? `/academy/learn/${me.next.categorySlug}/${me.next.moduleSlug}` : "/academy/learn"} className="btn-primary group h-12 justify-center whitespace-nowrap px-3 text-[13px] sm:px-6 sm:text-sm">
              Start Learning <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-active:translate-x-0.5" />
            </Link>
            <Link href="/academy/live" className="btn-gold h-12 justify-center whitespace-nowrap px-3 text-[13px] sm:px-6 sm:text-sm">
              <Radio className="h-4 w-4" /> Enter Live Quiz
            </Link>
            <button
              type="button"
              onClick={() => {
                unlock();
                window.dispatchEvent(new Event("academy:talk"));
              }}
              className="btn-ghost h-12 w-12 justify-center whitespace-nowrap !px-0 text-[13px] sm:w-auto sm:!px-4 sm:text-sm"
              aria-label="Ask AneQue"
            >
              <AudioLines className="h-4 w-4 text-gold-300" /> <span className="hidden sm:inline">Ask AneQue</span>
            </button>
          </motion.div>

          {/* Quick actions: one tap to every way of playing (phones and tablets). */}
          <motion.nav
            aria-label="Quick actions"
            style={rise({ y: 8, dur: 0.5, delay: 0.62 })}
            className="mt-4 grid grid-cols-4 gap-2 lg:hidden"
          >
            {QUICK.map((a) => (
              <Link
                key={a.href}
                href={me || !a.auth ? a.href : `/login?callbackUrl=${encodeURIComponent(a.href)}`}
                className="acad-quick group flex flex-col items-center gap-1.5 rounded-2xl border border-hairline bg-white/[0.03] px-1 py-3 text-center transition-colors active:border-gold-400/50"
              >
                <span className={cn("grid h-9 w-9 place-items-center rounded-xl", a.tone)}>
                  <a.icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                </span>
                <span className="text-[11px] font-semibold leading-tight text-content">{a.label}</span>
              </Link>
            ))}
          </motion.nav>
        </div>
        {/* ---------- today card ---------- */}
        <motion.div style={rise({ y: 24, r: -1.2, dur: 0.8, delay: 0.25 })} className="acad-ticket-wrap relative min-w-0 [grid-area:card]">
        <div className="acad-ticket-glow pointer-events-none absolute -inset-8 -z-10" aria-hidden />
        <aside
          ref={tilt}
          className="acad-ticket acad-tilt relative min-w-0 overflow-hidden rounded-[1.75rem] border border-hairline bg-ink-900/80 shadow-elevate"
          aria-label="Today in the Academy"
        >
          <span className="acad-ticket-ring pointer-events-none absolute inset-0 rounded-[inherit]" aria-hidden />
          <span className="acad-ticket-sheen pointer-events-none absolute inset-0 rounded-[inherit]" aria-hidden />
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
                {/* One line that never wraps: the status replaces the subtitle
                    instead of being squeezed in next to the Talk button. */}
                <div className="truncate text-sm font-semibold text-content">
                  AneQue <span className={cn("font-normal", speaking ? "text-gold-300" : "text-content-subtle")}>· {speaking ? "speaking" : voice.paused ? "paused" : "AI study partner"}</span>
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
              // ⚠️ Fixed at three lines. The caption follows whatever AneQue
              // is saying, and its height used to follow the text: the first
              // tap on the page (which unlocks audio) changed the line count,
              // the hero shrank ~21px, everything below jumped, and the tap
              // landed beside the button it was meant for. A fixed box means
              // the text can change without moving the page.
              className="mt-3 line-clamp-3 h-[4rem] text-[13px] leading-relaxed"
            />
          </div>
        </aside>

        {/* Fills the column under the ticket with live proof: the newest
            certificates (real, verifiable) and whether a live quiz is on. */}
        </motion.div>
      </div>
    </section>

    {/* Below the hero: the numbers, tracks, live activity and the newest
        certificates, so the hero itself fits one screen. */}
    <section className="acad-hero-strip mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_25rem] xl:grid-cols-[minmax(0,1fr)_27rem]" aria-label="Academy at a glance">
        {/* ---------- numbers, tracks, activity ---------- */}
        <div className="acad-strip-card min-w-0 rounded-[1.5rem] p-3 sm:p-5">
          <motion.div style={rise({ y: 8, dur: 0.6, delay: 0.7 })} className="grid grid-cols-4 gap-1.5 sm:gap-2">
            <Stat accent value={questions ?? 510} label="questions" />
            <Stat value={topics ?? 21} label="tracks" />
            {/* ⚠️ "live now" means live QUIZZES. It used to show learningNow
                (people active in the last 10 minutes), so it read "1 live now"
                with no live quiz running. Learners are the "N learning" pill. */}
            <Stat live={!!pulse?.liveNow} value={pulse?.liveNow ?? null} label="live now" href="/academy/live" />
            <Stat value={pulse?.quizzesToday ?? null} label="quizzes today" />
          </motion.div>
          {tracks && tracks.length > 0 && (
            <motion.div style={rise({ dur: 0.6, delay: 0.65 })} className="acad-track-rail mt-4 overflow-hidden" aria-label="Learning tracks">
              <div className="acad-track-rail-track flex w-max gap-2">
                {[0, 1].map((k) => (
                  <div key={k} className="flex gap-2" aria-hidden={k === 1}>
                    {tracks.map((t) => (
                      <Link
                        key={`${k}-${t.slug}`}
                        href={`/academy/learn/${t.slug}`}
                        tabIndex={k === 1 ? -1 : undefined}
                        className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full border border-hairline bg-white/[0.03] px-3.5 text-[12.5px] font-medium text-content-muted transition-colors hover:border-gold-400/40 hover:text-content active:border-gold-400/40"
                      >
                        <Icon name={t.icon} className="h-3.5 w-3.5 text-gold-300" />
                        {t.title}
                        <span className="font-mono text-[10px] text-content-subtle">{t.modules.length}</span>
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
          {pulse && pulse.achievements.length + pulse.certificates.length > 0 && (
            <div className="acad-ticker mt-4 overflow-hidden" aria-label="Recent activity">
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
          <motion.ul style={rise({ dur: 0.6, delay: 0.85 })} className="acad-nav-scroll -mx-3 mt-4 flex gap-2 overflow-x-auto px-3 [scrollbar-width:none] sm:mx-0 sm:mt-5 sm:flex-wrap sm:gap-x-5 sm:gap-y-2 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
            {PROMISES.map((p) => (
              <li key={p.text} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-hairline px-3 py-1.5 text-[12px] text-content-subtle sm:rounded-none sm:border-0 sm:p-0 sm:text-[12.5px]">
                <p.icon className="h-3.5 w-3.5 shrink-0 text-mint-400" /> {p.text}
              </li>
            ))}
          </motion.ul>
        </div>
        <div className="acad-hero-proof acad-strip-card rounded-[1.5rem] p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-content-subtle">
              <BadgeCheck className="h-3.5 w-3.5 text-gold-300" /> Latest certificates
            </span>
            {pulse && pulse.liveNow > 0 ? (
              <Link href="/academy/live" className="flex items-center gap-1.5 text-[11px] font-semibold text-mint-300 hover:underline">
                <span className="acad-live-dot h-1.5 w-1.5 rounded-full bg-mint-400 text-mint-400" /> {pulse.liveNow} live now
              </Link>
            ) : (
              <Link href="/academy/certificates" className="text-[11px] font-semibold text-gold-300 hover:underline">
                View all
              </Link>
            )}
          </div>
          {pulse && pulse.certificates.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {pulse.certificates.slice(0, 2).map((c) => (
                <li key={c.code}>
                  <Link href={`/academy/certificate/${c.code}`} className="group flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.04] active:bg-white/[0.04]">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-gold-400/30 bg-gold-400/10 text-gold-200">
                      <Trophy className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-content">{c.displayName}</span>
                      <span className="block truncate text-[11px] text-content-subtle">{c.title}</span>
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-content-subtle transition-transform group-hover:translate-x-0.5 group-active:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[13px] leading-relaxed text-content-muted">
              Top the daily, weekly or monthly board, or win a live quiz, to earn a verifiable certificate.
            </p>
          )}
        </div>
    </section>
    </>
  );
}
