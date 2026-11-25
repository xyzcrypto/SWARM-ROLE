"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Award, BadgeCheck, Brain, CalendarDays, Gauge, Layers, LogIn, Radio, Sparkles, Trophy, Zap } from "lucide-react";
import { getJson, useAcademyPing, useMe } from "../client/hooks";
import { Hero } from "./Hero";
import { Dashboard } from "./Dashboard";
import { CertificateShowcase } from "./CertificateShowcase";
import { Library } from "./Library";
import { LeaderboardView } from "./Leaderboard";
import type { CatalogCategory, Pulse } from "./types";
import { Avatar, Empty, Panel, SectionTitle, Skeleton, utcDate } from "./ui";

const MODES = [
  { href: "/academy/quiz?mode=quick", icon: Zap, title: "Quick Quiz", body: "5 to 20 mixed questions. Fast XP.", acc: "gold", tag: "4 min" },
  { href: "/academy/quiz?mode=topic", icon: Layers, title: "Topic Challenge", body: "Go deep on any one topic, Beginner to Expert.", acc: "mint", tag: "Any topic" },
  { href: "/academy/quiz?mode=daily", icon: CalendarDays, title: "Daily Challenge", body: "Same 10 questions for everyone, once a day.", acc: "gold", tag: "Bonus XP" },
  { href: "/academy/quiz?mode=weekly", icon: Trophy, title: "Weekly Challenge", body: "20 questions. One shot. Big bonus.", acc: "mint", tag: "Big bonus" },
  { href: "/academy/quiz?mode=advanced", icon: Brain, title: "Advanced Challenge", body: "Hard and expert only. Less time, more XP.", acc: "gold", tag: "Hard" },
  { href: "/academy/live", icon: Radio, title: "Live Multiplayer", body: "Everyone, same question, same clock.", acc: "live", tag: "Live" },
];

export function AcademyHome() {
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [catalog, setCatalog] = useState<CatalogCategory[] | null>(null);
  const { me, status } = useMe();

  // The live numbers in the hero. One quiet retry: a cold function or a
  // dropped request used to leave "—" placeholders up until the next ping.
  const loadPulse = useCallback(async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        setPulse(await getJson<Pulse>("/api/academy/pulse"));
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 2500));
      }
    }
  }, []);

  useEffect(() => {
    void loadPulse();
    getJson<{ categories: CatalogCategory[] }>("/api/academy/catalog")
      .then((r) => setCatalog(r.categories))
      .catch(() => setCatalog([]));
  }, [loadPulse]);

  useAcademyPing(loadPulse, 30_000);

  // AneQue's greeting (by name, on open) lives in the dock: see GreetBubble.

  return (
    <div>
      <Hero pulse={pulse} me={me} topics={catalog?.length ?? null} questions={catalog ? catalog.reduce((n, c) => n + c.questionCount, 0) : null} tracks={catalog} />

      {status === "authenticated" ? (
        me ? (
          <Dashboard me={me} />
        ) : (
          <div className="mt-10 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
          </div>
        )
      ) : status === "unauthenticated" ? (
        <Panel className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gold-400/15 text-gold-200">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-lg font-semibold text-content">Your personal learning dashboard</div>
            <p className="mt-0.5 text-sm text-content-muted">Sign in to earn XP, keep a daily streak, climb the leaderboards and win official certificates. Lessons are free to read without an account.</p>
          </div>
          <Link href="/login?callbackUrl=/academy" className="btn-gold h-11 px-5 text-sm">
            <LogIn className="h-4 w-4" /> Sign in
          </Link>
        </Panel>
      ) : null}

      <section className="mt-16 sm:mt-20">
        <SectionTitle eyebrow="Play" title="Choose your challenge" sub="Every mode is scored on the server: correct answers, difficulty, speed and streaks. Wrong answers never earn quiz XP." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODES.map((m, i) => (
            <motion.div key={m.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: i * 0.05 }}>
              <Link href={m.href} className={`surface surface-hover acad-tilt acad-mode acad-acc-${m.acc} group relative flex h-full items-start gap-4 overflow-hidden rounded-3xl p-5`}>
                <span className="acad-mode-glow pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full blur-2xl" aria-hidden />
                <span className="acad-mode-icon grid h-12 w-12 shrink-0 place-items-center rounded-2xl">
                  <m.icon className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-base font-semibold text-content">{m.title}</span>
                    <span className="acad-mode-tag rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]">{m.tag}</span>
                  </div>
                  <div className="mt-0.5 text-sm text-content-muted">{m.body}</div>
                </div>
                <ArrowRight className="ml-auto mt-1 h-4 w-4 shrink-0 text-content-subtle transition-all group-hover:translate-x-0.5 group-active:translate-x-0.5 group-hover:text-gold-300" />
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="library" className="mt-16 scroll-mt-28 sm:mt-20">
        <SectionTitle
          eyebrow="Learn"
          title="The Web3 library"
          sub={`${catalog?.length ?? 21} topics, each from Beginner to Expert. Short lessons, real examples, and a knowledge check that completes the lesson.`}
          right={
            <Link href="/academy/learn" className="btn-ghost h-10 px-4 text-sm">
              All topics
            </Link>
          }
        />
        <Library categories={catalog} me={me} />
      </section>

      <CertificateShowcase />

      <section className="mt-16 grid gap-5 sm:mt-20 lg:grid-cols-[1.4fr_1fr]">
        <Panel>
          <SectionTitle eyebrow="Compete" title="Global leaderboard" />
          <LeaderboardView compact />
        </Panel>
        <Panel delay={0.05}>
          <SectionTitle eyebrow="Community" title="Happening now" />
          <CommunityPulse pulse={pulse} />
        </Panel>
      </section>
    </div>
  );
}

function CommunityPulse({ pulse }: { pulse: Pulse | null }) {
  if (!pulse)
    return (
      <div className="space-y-3">
        <Skeleton className="h-16" />
        <Skeleton className="h-40" />
      </div>
    );
  const quiet = !pulse.achievements.length && !pulse.certificates.length;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        {[
          { v: pulse.learningNow, l: "learning now", live: true },
          { v: pulse.quizzesToday, l: "quizzes today" },
          { v: pulse.liveParticipants, l: "in live quizzes" },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl border border-hairline px-3 py-2.5 text-center">
            <div className="flex items-center justify-center gap-1.5 font-display text-xl font-bold text-content">
              {s.live && <span className="acad-live-dot h-1.5 w-1.5 rounded-full bg-mint-400 text-mint-400" />}
              {s.v}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-content-subtle">{s.l}</div>
          </div>
        ))}
      </div>
      {quiet ? (
        <Empty>No achievements or certificates yet. Be the first name here.</Empty>
      ) : (
        <>
          {pulse.achievements.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-content-subtle">
                <BadgeCheck className="h-3.5 w-3.5 text-gold-300" /> Recent achievements
              </div>
              <ul className="space-y-2">
                {pulse.achievements.map((a, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm">
                    <Avatar src={a.image} alt={a.name} size={26} />
                    <span className="min-w-0 flex-1 truncate text-content-muted">
                      <span className="font-semibold text-content">{a.name}</span> unlocked <span className="text-gold-200">{a.title}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {pulse.certificates.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-content-subtle">
                <Award className="h-3.5 w-3.5 text-gold-300" /> New certificates
              </div>
              <ul className="space-y-2">
                {pulse.certificates.map((c) => (
                  <li key={c.code}>
                    <Link href={`/academy/certificate/${c.code}`} className="flex items-center gap-2.5 rounded-xl px-1 py-0.5 text-sm hover:bg-white/[0.03]">
                      <Gauge className="h-4 w-4 text-gold-300" />
                      <span className="min-w-0 flex-1 truncate text-content-muted">
                        <span className="font-semibold text-content">{c.displayName}</span>, {c.title}
                      </span>
                      <span className="text-[11px] text-content-subtle">{utcDate(c.issuedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
