"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Clock, Headphones, Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMe } from "../client/hooks";
import { say, unlock } from "../client/audio";
import type { VoiceLine } from "../client/voice-lines";
import { DIFF_TONE, Icon, LEVEL_LABEL, Pill, ProgressBar } from "./ui";

type C = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  icon: string;
  questions: number;
  modules: { id: string; slug: string; level: string; title: string; summary: string; minutes: number; objectives: string[]; questions: number }[];
};

export function CategoryView({ c }: { c: C }) {
  const { me } = useMe();
  const done = new Set(me?.progress.modules ?? []);
  const finished = c.modules.filter((m) => done.has(m.id)).length;
  return (
    <div>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link href="/academy/learn" className="text-xs font-semibold text-content-subtle hover:text-gold-300">
            ← All topics
          </Link>
          <div className="mt-4 flex items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-gold-400/30 bg-gradient-to-br from-gold-400/20 to-transparent text-gold-200">
              <Icon name={c.icon} className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-3xl font-semibold tracking-tight text-content sm:text-4xl">{c.title}</h1>
              <p className="mt-1 text-sm text-content-muted sm:text-base">{c.tagline}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              unlock();
              say(`learn_${c.slug}` as VoiceLine);
            }}
            className="btn-secondary h-11 px-4 text-sm"
          >
            <Headphones className="h-4 w-4" /> Intro by Nova
          </button>
          <Link href={`/academy/quiz?mode=topic&category=${c.slug}`} className="btn-gold h-11 px-5 text-sm">
            <Swords className="h-4 w-4" /> Topic challenge
          </Link>
        </div>
      </div>

      {me && (
        <div className="mt-6 max-w-sm">
          <div className="flex justify-between text-xs text-content-subtle">
            <span>Progress</span>
            <span>
              {finished}/{c.modules.length} lessons
            </span>
          </div>
          <ProgressBar value={c.modules.length ? finished / c.modules.length : 0} tone="mint" className="mt-1.5" />
        </div>
      )}

      <ol className="relative mt-10 space-y-4 before:absolute before:bottom-6 before:left-[1.35rem] before:top-6 before:w-px before:bg-gradient-to-b before:from-gold-400/50 before:via-hairline before:to-transparent sm:before:left-[1.6rem]">
        {c.modules.map((m, i) => {
          const isDone = done.has(m.id);
          return (
            <motion.li
              key={m.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
             
              transition={{ duration: 0.45, delay: i * 0.06 }}
              className="relative pl-14 sm:pl-16"
            >
              <span
                className={cn(
                  "absolute left-1.5 top-5 grid h-8 w-8 place-items-center rounded-full border font-mono text-xs font-bold sm:left-2.5 sm:h-9 sm:w-9",
                  isDone ? "border-mint-400/60 bg-mint-400/15 text-mint-200" : "border-gold-400/40 bg-ink-950 text-gold-200"
                )}
              >
                {isDone ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </span>
              <Link href={`/academy/learn/${c.slug}/${m.slug}`} className="surface surface-hover lift group block rounded-3xl p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={DIFF_TONE[m.level]}>{LEVEL_LABEL[m.level]}</Pill>
                  <span className="flex items-center gap-1 text-[11px] text-content-subtle">
                    <Clock className="h-3 w-3" /> {m.minutes} min · {m.questions} question check
                  </span>
                  {isDone && <Pill tone="border-mint-400/40 text-mint-300">Completed</Pill>}
                </div>
                <h2 className="mt-3 font-display text-xl font-semibold tracking-tight text-content">{m.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-content-muted">{m.summary}</p>
                {m.objectives.length > 0 && (
                  <ul className="mt-3 grid gap-1 text-[13px] text-content-muted sm:grid-cols-2">
                    {m.objectives.slice(0, 4).map((o) => (
                      <li key={o} className="flex gap-2">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold-300" />
                        {o}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-gold-300">
                  {isDone ? "Review lesson" : "Start lesson"} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-active:translate-x-0.5" />
                </div>
              </Link>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
