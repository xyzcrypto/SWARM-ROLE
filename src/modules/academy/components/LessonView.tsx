"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Headphones, Lightbulb, Pause, Swords, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAudio, useLang, useMe, type HiText } from "../client/hooks";
import { play, say, stopVoice, unlock } from "../client/audio";
import { clearTalkContext, setTalkContext } from "../client/talk";
import type { VoiceLine } from "../client/voice-lines";
import { DIFF_TONE, Icon, LEVEL_LABEL, Pill } from "./ui";
import { BungeeLessonCta } from "@modules/giveaway/components/BungeeLessonCta";
import { BUNGEE_CATEGORY, BUNGEE_LAST_MODULE } from "@modules/giveaway/lib/bungee";

type Lesson = {
  id: string;
  slug: string;
  level: string;
  title: string;
  summary: string;
  summaryVoice: string | null;
  minutes: number;
  objectives: string[];
  sections: { heading: string; body: string }[];
  concepts: { term: string; definition: string }[];
  example: { title: string; body: string } | null;
  questions: number;
  isFirst: boolean;
  voices: { sections: { heading: string | null; body: string | null }[]; example: { title: string | null; body: string | null } | null };
  hi: {
    title: HiText | null;
    summary: HiText | null;
    objectives: (HiText | null)[];
    sections: { heading: HiText | null; body: HiText | null }[];
    concepts: (HiText | null)[];
    example: { title: HiText | null; body: HiText | null } | null;
  };
};
type Nav = {
  category: { slug: string; title: string; icon: string };
  modules: { id: string; slug: string; level: string; title: string; minutes: number }[];
  prev: string | null;
  next: string | null;
};

export function LessonView({ lesson, nav }: { lesson: Lesson; nav: Nav }) {
  const { me, status } = useMe();
  const { voice } = useAudio();
  const { tx, vx, hiOn } = useLang();
  const H = lesson.hi;
  // The pieces AneQue reads for section i: its heading, then its body.
  const sectionPieces = (i: number) => {
    const s = lesson.sections[i];
    return [
      { url: vx(lesson.voices.sections[i]?.heading ?? null, H.sections[i]?.heading), text: tx(s.heading, H.sections[i]?.heading) },
      { url: vx(lesson.voices.sections[i]?.body ?? null, H.sections[i]?.body), text: tx(s.body, H.sections[i]?.body) },
    ];
  };
  const done = me?.progress.modules.includes(lesson.id) ?? false;
  const [reading, setReading] = useState<number | null>(null);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const greeted = useRef(false);

  // The first lesson of a topic gets AneQue's spoken intro (if she speaks on her own).
  useEffect(() => {
    if (greeted.current || !lesson.isFirst) return;
    greeted.current = true;
    say(`learn_${nav.category.slug}` as VoiceLine, { auto: true });
  }, [lesson.isFirst, nav.category.slug]);

  useEffect(() => {
    if (!voice.speaking) setReading(null);
  }, [voice.speaking]);
  useEffect(() => () => stopVoice(), []);
  // Tell AneQue what is on screen so "explain this" works in Live Talk.
  useEffect(() => {
    setTalkContext({ topic: nav.category.title, lesson: lesson.title, questionOpen: false, question: null });
    return () => clearTalkContext(["topic", "lesson"]);
  }, [nav.category.title, lesson.title]);

  const readSection = (i: number) => {
    unlock();
    if (reading === i) {
      stopVoice();
      setReading(null);
      return;
    }
    play(sectionPieces(i), { caption: tx(lesson.sections[i].body, H.sections[i]?.body) });
    setReading(i);
  };

  const quizHref = `/academy/quiz?mode=module&module=${lesson.id}`;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_17rem]">
      <article className="min-w-0">
        <Link href={`/academy/learn/${nav.category.slug}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-content-subtle hover:text-gold-300">
          <Icon name={nav.category.icon} className="h-3.5 w-3.5" /> {nav.category.title}
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Pill tone={DIFF_TONE[lesson.level]}>{LEVEL_LABEL[lesson.level]}</Pill>
          <span className="flex items-center gap-1 text-xs text-content-subtle">
            <Clock className="h-3.5 w-3.5" /> {lesson.minutes} min read
          </span>
          {done && (
            <Pill tone="border-mint-400/40 text-mint-300">
              <CheckCircle2 className="h-3 w-3" /> Completed
            </Pill>
          )}
        </div>
        <h1 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-tight text-content sm:text-[2.6rem]">{tx(lesson.title, H.title)}</h1>
        <p className="mt-3 text-base leading-relaxed text-content-muted sm:text-lg">{tx(lesson.summary, H.summary)}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              unlock();
              if (reading === -1) {
                stopVoice();
                setReading(null);
                return;
              }
              // AneQue reads the summary in her own voice, then the lesson in order.
              const ex = lesson.example;
              play(
                [
                  { url: vx(lesson.summaryVoice, H.summary), text: tx(lesson.summary, H.summary) },
                  ...lesson.sections.flatMap((_, i) => sectionPieces(i)),
                  ...(ex
                    ? [
                        { url: vx(lesson.voices.example?.title ?? null, H.example?.title), text: tx(ex.title, H.example?.title) },
                        { url: vx(lesson.voices.example?.body ?? null, H.example?.body), text: tx(ex.body, H.example?.body) },
                      ]
                    : []),
                ],
                { caption: tx(lesson.summary, H.summary) }
              );
              setReading(-1);
            }}
            className="btn-secondary h-10 px-4 text-sm"
          >
            {reading === -1 ? <Pause className="h-4 w-4" /> : <Headphones className="h-4 w-4" />} {reading === -1 ? "Stop" : hiOn ? "AneQue se poora lesson suno" : "Listen to this lesson"}
          </button>
        </div>

        {lesson.objectives.length > 0 && (
          <div className="mt-6 rounded-3xl border border-gold-400/25 bg-gold-400/[0.04] p-5">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-300">
              <Target className="h-3.5 w-3.5" /> By the end you will
            </div>
            <ul className="mt-3 space-y-2">
              {lesson.objectives.map((o, i) => (
                <li key={o} className="flex gap-2.5 text-sm text-content">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" />
                  {tx(o, H.objectives[i])}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 space-y-4">
          {lesson.sections.map((s, i) => (
            <motion.section
              key={i}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
             
              transition={{ duration: 0.45 }}
              className={cn("surface rounded-3xl p-5 sm:p-6", reading === i && "ring-1 ring-gold-300/50")}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-lg font-semibold tracking-tight text-content sm:text-xl">
                  <span className="mr-2 font-mono text-sm text-gold-300">{String(i + 1).padStart(2, "0")}</span>
                  {tx(s.heading, H.sections[i]?.heading)}
                </h2>
                <button
                  type="button"
                  onClick={() => readSection(i)}
                  className="shrink-0 rounded-full border border-hairline p-2 text-content-subtle transition-colors hover:border-gold-400/40 hover:text-gold-200"
                  aria-label={reading === i ? "Stop reading" : `Read “${s.heading}” aloud`}
                  title={reading === i ? "Stop" : "Read aloud"}
                >
                  {reading === i ? <Pause className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-3 text-[15px] leading-7 text-content-muted">{tx(s.body, H.sections[i]?.body)}</p>
            </motion.section>
          ))}
        </div>

        {lesson.concepts.length > 0 && (
          <div className="mt-10">
            <h2 className="font-display text-xl font-semibold text-content">Key concepts</h2>
            <p className="mt-1 text-xs text-content-subtle">Tap a card to reveal its meaning, then test yourself.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {lesson.concepts.map((c, i) => {
                const open = flipped.has(i);
                return (
                  <button
                    key={c.term}
                    type="button"
                    onClick={() =>
                      setFlipped((f) => {
                        const n = new Set(f);
                        if (n.has(i)) n.delete(i);
                        else n.add(i);
                        return n;
                      })
                    }
                    aria-expanded={open}
                    className={cn("rounded-2xl border p-4 text-left transition-colors", open ? "border-gold-400/40 bg-gold-400/[0.05]" : "border-hairline hover:border-gold-400/30")}
                  >
                    <div className="font-semibold text-content">{c.term}</div>
                    <motion.div initial={false} animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }} className="overflow-hidden">
                      <p className="pt-2 text-sm leading-relaxed text-content-muted">{tx(c.definition, H.concepts[i])}</p>
                    </motion.div>
                    {!open && <div className="mt-1 text-[11px] text-gold-300/80">Reveal</div>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {lesson.example && (
          <div className="mt-10 rounded-3xl border border-mint-400/25 bg-mint-400/[0.04] p-5 sm:p-6">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-mint-300">
              <Lightbulb className="h-3.5 w-3.5" /> Real-world example
            </div>
            <h3 className="mt-2 font-display text-lg font-semibold text-content">{tx(lesson.example.title, H.example?.title)}</h3>
            <p className="mt-2 text-[15px] leading-7 text-content-muted">{tx(lesson.example.body, H.example?.body)}</p>
          </div>
        )}

        {/* Bungee Funded Perps track: giveaway banner, and the referral card on the last lesson. */}
        {nav.category.slug === BUNGEE_CATEGORY && <BungeeLessonCta last={lesson.slug === BUNGEE_LAST_MODULE} />}

        <div className="mt-10 overflow-hidden rounded-3xl border border-gold-400/30 bg-gradient-to-br from-gold-400/[0.09] to-transparent p-6 sm:p-8">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-300">Knowledge check</div>
          <h2 className="mt-2 font-display text-2xl font-semibold text-content">{done ? "Lesson complete. Want to sharpen it?" : "Ready to lock it in?"}</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-content-muted">
            {lesson.questions} questions on this lesson. Score 60% or more to complete it and earn XP. You can retake it any time.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {status === "unauthenticated" ? (
              <Link href={`/login?callbackUrl=${encodeURIComponent(`/academy/learn/${nav.category.slug}/${lesson.slug}`)}`} className="btn-gold h-11 px-5 text-sm">
                Sign in to take the check
              </Link>
            ) : (
              <Link
                href={quizHref}
                onClick={() => {
                  unlock();
                  say("module_check", { auto: true });
                }}
                className="btn-primary h-11 px-5 text-sm"
              >
                <Swords className="h-4 w-4" /> {done ? "Retake the check" : "Start the knowledge check"}
              </Link>
            )}
            {nav.next && (
              <Link href={`/academy/learn/${nav.category.slug}/${nav.next}`} className="btn-ghost h-11 px-5 text-sm">
                Next lesson <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-between text-sm">
          {nav.prev ? (
            <Link href={`/academy/learn/${nav.category.slug}/${nav.prev}`} className="inline-flex items-center gap-1 text-content-subtle hover:text-gold-300">
              <ArrowLeft className="h-4 w-4" /> Previous
            </Link>
          ) : (
            <span />
          )}
          {nav.next && (
            <Link href={`/academy/learn/${nav.category.slug}/${nav.next}`} className="inline-flex items-center gap-1 text-content-subtle hover:text-gold-300">
              Next <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </article>

      <aside className="hidden lg:block">
        <div className="sticky top-28 rounded-3xl border border-hairline p-4">
          <div className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-content-subtle">{nav.category.title}</div>
          <ol className="mt-3 space-y-1">
            {nav.modules.map((m, i) => {
              const active = m.slug === lesson.slug;
              const isDone = me?.progress.modules.includes(m.id);
              return (
                <li key={m.id}>
                  <Link
                    href={`/academy/learn/${nav.category.slug}/${m.slug}`}
                    aria-current={active ? "page" : undefined}
                    className={cn("flex items-start gap-2.5 rounded-xl px-2 py-2 text-sm transition-colors", active ? "bg-gold-400/10 text-gold-100" : "text-content-muted hover:bg-white/[0.03] hover:text-content")}
                  >
                    <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border font-mono text-[10px]", isDone ? "border-mint-400/60 text-mint-300" : "border-hairline")}>
                      {isDone ? "✓" : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block leading-snug">{m.title}</span>
                      <span className="text-[11px] text-content-subtle">{LEVEL_LABEL[m.level]}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      </aside>
    </div>
  );
}
