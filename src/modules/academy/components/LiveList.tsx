"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CalendarClock, Crown, Radio, Timer, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { getJson, useAcademyPing, useTicker } from "../client/hooks";
import type { LiveListItem } from "./types";
import { Avatar, Empty, Pill, SectionTitle, Skeleton } from "./ui";

function until(ts: number) {
  const ms = ts - Date.now();
  if (ms <= 0) return "starting";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m ${String(s % 60).padStart(2, "0")}s`;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });

function Card({ q, i }: { q: LiveListItem; i: number }) {
  const live = q.state === "live";
  const ended = q.state === "ended";
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
      <Link
        href={ended ? `/academy/live/${q.id}?view=results` : `/academy/live/${q.id}`}
        className={cn("surface surface-hover lift group flex h-full flex-col rounded-3xl p-5", live && "border-mint-400/40 shadow-[0_0_0_1px_rgba(52,227,161,0.15),0_30px_70px_-40px_rgba(52,227,161,0.6)]")}
      >
        <div className="flex items-center gap-2">
          {live ? (
            <Pill tone="border-mint-400/50 text-mint-300">
              <span className="acad-live-dot h-1.5 w-1.5 rounded-full bg-mint-400 text-mint-400" /> LIVE NOW
            </Pill>
          ) : ended ? (
            <Pill>Completed</Pill>
          ) : q.state === "cancelled" ? (
            <Pill tone="border-red-400/40 text-red-300">Cancelled</Pill>
          ) : (
            <Pill tone="border-gold-400/40 text-gold-300">
              <Timer className="h-3 w-3" /> in {until(Date.parse(q.scheduledAt))}
            </Pill>
          )}
          <span className="ml-auto flex items-center gap-1 text-xs text-content-subtle">
            <Users className="h-3.5 w-3.5" /> {q.participants}
          </span>
        </div>
        <h3 className="mt-4 font-display text-lg font-semibold leading-snug text-content">{q.title}</h3>
        {q.description && <p className="mt-1 line-clamp-2 text-sm text-content-muted">{q.description}</p>}
        <div className="mt-3 flex items-center gap-2 text-[0.75rem] text-content-subtle">
          <CalendarClock className="h-3.5 w-3.5" /> {when(q.scheduledAt)} · {q.questions} questions · {q.questionSec}s each
        </div>
        <div className="mt-auto pt-4">
          {ended && q.winner ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-2xl border border-gold-400/30 bg-gold-400/[0.05] px-3 py-2">
                <Crown className="h-4 w-4 text-gold-300" />
                <Avatar src={q.winner.image} alt={q.winner.name} size={22} />
                <span className="min-w-0 flex-1 truncate text-sm text-content">{q.winner.name}</span>
                <span className="font-mono text-xs text-gold-200">{q.winner.score.toLocaleString("en-US")}</span>
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-gold-300">
                Answers &amp; results <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-active:translate-x-0.5" />
              </span>
            </div>
          ) : (
            <span className={cn("inline-flex items-center gap-1 text-sm font-semibold", live ? "text-mint-300" : "text-gold-300")}>
              {live ? "Join now" : ended ? "See results" : "Open waiting room"} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-active:translate-x-0.5" />
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

export function LiveList() {
  const [items, setItems] = useState<LiveListItem[] | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    try {
      setItems((await getJson<{ quizzes: LiveListItem[] }>("/api/academy/live")).quizzes);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useAcademyPing(load, 10_000);
  useTicker(true, 1000);

  // A countdown reaching zero means a quiz just went live: refetch once.
  useEffect(() => {
    const next = items?.filter((q) => q.state === "upcoming").map((q) => Date.parse(q.scheduledAt) - Date.now()).filter((ms) => ms > 0).sort((a, b) => a - b)[0];
    if (next == null) return;
    const id = setTimeout(load, next + 1500);
    return () => clearTimeout(id);
  }, [items, load]);

  const live = items?.filter((q) => q.state === "live") ?? [];
  const upcoming = items?.filter((q) => q.state === "upcoming") ?? [];
  const done = items?.filter((q) => q.state === "ended") ?? [];

  return (
    <div>
      <SectionTitle
        eyebrow="Live multiplayer"
        title={
          <span className="flex items-center gap-3">
            <Radio className="h-7 w-7 text-mint-300" /> <span className="text-gold-gradient">Live Quiz Arena</span>
          </span>
        }
        sub="Everyone gets the same question at the same moment, on the server's clock. Faster correct answers score more. Winners get XP and an official certificate."
      />
      {error && !items ? (
        <Empty>
          Could not load live quizzes.{" "}
          <button type="button" onClick={load} className="font-semibold text-gold-300">
            Retry
          </button>
        </Empty>
      ) : !items ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-52" />
          <Skeleton className="h-52" />
          <Skeleton className="h-52" />
        </div>
      ) : (
        <div className="space-y-10">
          {live.length > 0 && (
            <section>
              <h2 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-mint-300">Live now</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {live.map((q, i) => (
                  <Card key={q.id} q={q} i={i} />
                ))}
              </div>
            </section>
          )}
          <section>
            <h2 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-content-subtle">Upcoming</h2>
            {upcoming.length ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {upcoming.map((q, i) => (
                  <Card key={q.id} q={q} i={i} />
                ))}
              </div>
            ) : (
              <Empty>No live quiz is scheduled right now. The next one will appear here, and on this page it goes live by itself at its start time. Meanwhile, the daily challenge is open.</Empty>
            )}
          </section>
          {done.length > 0 && (
            <section>
              <h2 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-content-subtle">Completed</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {done.map((q, i) => (
                  <Card key={q.id} q={q} i={i} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
