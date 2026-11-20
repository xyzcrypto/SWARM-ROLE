"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Brain, CalendarDays, CheckCircle2, Clock, Flame, Gauge, Headphones, Layers, Loader2, LogIn, RotateCcw, Split, Swords, Timer, Trophy, XCircle, Zap } from "lucide-react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { duck, play, say, sayOneOf, sfx, stopVoice, unlock, type Piece } from "../client/audio";
import { getJson, postJson, useAudio, useServerClock, useTicker } from "../client/hooks";
import { COMMAND_EVENT, type Parsed } from "../client/commands";
import { clearTalkContext, setTalkContext } from "../client/talk";
import { VOICE_LINES, type VoiceLine } from "../client/voice-lines";
import type { AnswerResult, CatalogCategory, QuizState } from "./types";
import { DIFF_LABEL, DIFF_TONE, Empty, Eyebrow, Panel, Pill } from "./ui";
import { QuizResults } from "./QuizResults";
import type { QuizResult } from "./types";

type Mode = "quick" | "topic" | "daily" | "weekly" | "advanced" | "module" | "challenge" | "mistakes" | "speed";
type Setup = { mode: Mode; category: string; difficulty: string; count: number; moduleId?: string | null; challenge?: string | null };

const MODE_TABS: { id: Mode; label: string; icon: typeof Zap; hint: string }[] = [
  { id: "quick", label: "Quick", icon: Zap, hint: "Mixed topics. Pick the length and difficulty." },
  { id: "topic", label: "Topic", icon: Layers, hint: "All questions from one topic." },
  { id: "advanced", label: "Advanced", icon: Brain, hint: "Hard and expert questions only. More points per answer." },
  { id: "speed", label: "Speed Run", icon: Gauge, hint: "Easy and medium questions, 12 seconds each. Fast fingers score big." },
  { id: "mistakes", label: "Mistakes", icon: RotateCcw, hint: "Only questions you got wrong before, until you get them right." },
  { id: "daily", label: "Daily", icon: CalendarDays, hint: "10 questions, the same for everyone today. One attempt. No lifelines." },
  { id: "weekly", label: "Weekly", icon: Trophy, hint: "20 questions for the whole week. One attempt. No lifelines. Big bonus." },
];

const LETTERS = ["A", "B", "C", "D"];
const line = (k: VoiceLine): Piece => ({ url: `/academy/voice/${k}.mp3`, text: VOICE_LINES[k] });

export function QuizClient() {
  const params = useSearchParams();
  const router = useRouter();
  const { status } = useSession();
  const initial: Setup = {
    mode: ((params.get("mode") as Mode) || (params.get("challenge") ? "challenge" : params.get("module") ? "module" : "quick")) as Mode,
    category: params.get("category") ?? "",
    difficulty: params.get("difficulty") ?? "mixed",
    count: Number(params.get("count")) || 10,
    moduleId: params.get("module"),
    challenge: params.get("challenge"),
  };
  const [setup, setSetup] = useState<Setup>(initial);
  const [attemptId, setAttemptId] = useState<string | null>(params.get("resume"));
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const start = useCallback(
    async (s: Setup) => {
      unlock();
      setStarting(true);
      setError(null);
      setResult(null);
      try {
        const r = await postJson<{ attemptId: string; done: boolean }>("/api/academy/quiz", {
          mode: s.mode,
          category: s.category || null,
          moduleId: s.moduleId || null,
          difficulty: s.difficulty,
          count: s.count,
          challenge: s.challenge || null,
        });
        if (r.done) {
          // Today's/this week's challenge already played: show its results.
          const res = await postJson<QuizResult>(`/api/academy/quiz/${r.attemptId}`, { action: "finish" });
          say(s.mode === "daily" ? "daily_done" : "weekly_done", { auto: true });
          setResult(res);
          return;
        }
        setAttemptId(r.attemptId);
        sfx("go");
        const intro: VoiceLine =
          s.mode === "daily"
            ? "daily_ready"
            : s.mode === "weekly"
              ? "weekly_ready"
              : s.mode === "module"
                ? "module_check"
                : s.mode === "mistakes"
                  ? "mistakes_ready"
                  : s.mode === "challenge"
                    ? "challenge_ready"
                    : s.mode === "topic" && `topic_${s.category}` in VOICE_LINES
                      ? (`topic_${s.category}` as VoiceLine)
                      : (`quiz_ready_${[5, 10, 15, 20].includes(s.count) ? s.count : 10}` as VoiceLine);
        say(intro, { auto: true });
        router.replace(`/academy/quiz?resume=${r.attemptId}`, { scroll: false });
      } catch (e) {
        const msg = (e as Error).message;
        if (s.mode === "mistakes" && /No mistakes/.test(msg)) say("mistakes_none", { auto: true });
        setError(msg);
      } finally {
        setStarting(false);
      }
    },
    [router]
  );

  if (status === "unauthenticated")
    return (
      <Panel className="mx-auto max-w-xl text-center">
        <Swords className="mx-auto h-8 w-8 text-gold-300" />
        <h1 className="mt-3 font-display text-2xl font-semibold text-content">Sign in to play</h1>
        <p className="mt-2 text-sm text-content-muted">Quizzes are scored on our server and your XP, streak and rank are saved to your account.</p>
        <Link href={`/login?callbackUrl=${encodeURIComponent(`/academy/quiz?${params.toString()}`)}`} className="btn-gold mt-5 h-11 px-6 text-sm">
          <LogIn className="h-4 w-4" /> Sign in
        </Link>
      </Panel>
    );

  if (result)
    return (
      <QuizResults
        result={result}
        onPlayAgain={() => {
          const again = result.mode === "daily" || result.mode === "weekly" ? { ...setup, mode: "quick" as Mode } : setup;
          setResult(null);
          setAttemptId(null);
          void start(again);
        }}
      />
    );

  if (attemptId)
    return (
      <QuizPlayer
        attemptId={attemptId}
        onFinished={(r) => {
          setResult(r);
          setAttemptId(null);
        }}
        onLost={() => {
          setAttemptId(null);
          router.replace("/academy/quiz", { scroll: false });
        }}
      />
    );

  return (
    <QuizSetup
      setup={setup}
      onChange={setSetup}
      onStart={() => start(setup)}
      onStartLesson={(moduleId) => start({ ...setup, mode: "module", moduleId })}
      starting={starting}
      error={error}
    />
  );
}

// ------------------------------------------------------------------ setup

function QuizSetup({
  setup,
  onChange,
  onStart,
  onStartLesson,
  starting,
  error,
}: {
  setup: Setup;
  onChange: (s: Setup) => void;
  onStart: () => void;
  onStartLesson: (moduleId: string) => void;
  starting: boolean;
  error: string | null;
}) {
  const [lessonTopic, setLessonTopic] = useState("");
  const [cats, setCats] = useState<CatalogCategory[]>([]);
  const [challenger, setChallenger] = useState<{ name: string; score: number; correct: number; total: number } | null>(null);
  useEffect(() => {
    getJson<{ categories: CatalogCategory[] }>("/api/academy/catalog")
      .then((r) => setCats(r.categories))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (setup.mode !== "challenge" || !setup.challenge) return;
    getJson<{ name: string; score: number; correct: number; total: number }>(`/api/academy/quiz/${setup.challenge}/challenge`)
      .then(setChallenger)
      .catch(() => setChallenger(null));
  }, [setup.mode, setup.challenge]);

  const fixed = setup.mode === "daily" || setup.mode === "weekly" || setup.mode === "module" || setup.mode === "challenge";
  const set = (p: Partial<Setup>) => onChange({ ...setup, ...p });
  const needsTopic = setup.mode === "topic" && !setup.category;
  const showDifficulty = !fixed && setup.mode !== "speed" && setup.mode !== "mistakes";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="text-center">
        <Eyebrow>Quiz engine</Eyebrow>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-content sm:text-4xl">
          {setup.mode === "module" ? "Knowledge check" : setup.mode === "challenge" ? "You've been challenged" : <span className="text-gold-gradient">Set up your challenge</span>}
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-content-muted">One question at a time, against the clock. Faster correct answers and streaks score more. Wrong answers score nothing.</p>
      </div>

      <Panel className="mt-8">
        {setup.mode !== "module" && setup.mode !== "challenge" && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Quiz mode">
            {MODE_TABS.map((m, i) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={setup.mode === m.id}
                onMouseEnter={() => sfx("hover")}
                onClick={() => {
                  unlock();
                  sfx("select");
                  set({ mode: m.id });
                }}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-semibold transition-colors",
                  i === MODE_TABS.length - 1 && "col-span-2 sm:col-span-1",
                  setup.mode === m.id ? "border-gold-400/60 bg-gold-400/10 text-gold-100" : "border-hairline text-content-muted hover:border-gold-400/30 hover:text-content"
                )}
              >
                <m.icon className="h-4 w-4 shrink-0" />
                {m.label}
              </button>
            ))}
          </div>
        )}
        <p className="mt-4 text-center text-sm text-content-muted">
          {setup.mode === "module"
            ? "Questions from this lesson. Score 60% or more to complete it."
            : setup.mode === "challenge"
              ? challenger
                ? `${challenger.name} scored ${challenger.score.toLocaleString("en-US")} points (${challenger.correct}/${challenger.total}). Same questions. Can you beat it?`
                : "Loading the challenge…"
              : MODE_TABS.find((m) => m.id === setup.mode)?.hint}
        </p>

        {!fixed && (
          <div className="mt-6 space-y-5">
            {setup.mode === "topic" && (
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-content-subtle">Topic</span>
                <select
                  value={setup.category}
                  onChange={(e) => set({ category: e.target.value })}
                  className="mt-2 w-full rounded-xl border border-hairline bg-ink-900/80 px-3 py-3 text-sm text-content focus:border-gold-400/50 focus:outline-none"
                >
                  <option value="">Choose a topic…</option>
                  {cats.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.title} ({c.questionCount})
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-content-subtle">Questions</span>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {[5, 10, 15, 20].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      sfx("click");
                      set({ count: n });
                    }}
                    aria-pressed={setup.count === n}
                    className={cn("rounded-xl border py-2.5 font-mono text-sm font-semibold", setup.count === n ? "border-gold-400/60 bg-gold-400/10 text-gold-100" : "border-hairline text-content-muted hover:text-content")}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            {showDifficulty && (
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-content-subtle">Difficulty</span>
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {(setup.mode === "advanced" ? ["mixed", "expert"] : ["mixed", "easy", "medium", "hard", "expert"]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        sfx("click");
                        set({ difficulty: d });
                      }}
                      aria-pressed={setup.difficulty === d}
                      className={cn("rounded-xl border py-2.5 text-sm font-semibold", setup.difficulty === d ? "border-gold-400/60 bg-gold-400/10 text-gold-100" : "border-hairline text-content-muted hover:text-content")}
                    >
                      {setup.mode === "advanced" && d === "mixed" ? "Hard + Expert" : DIFF_LABEL[d]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {error && <div className="mt-5 rounded-xl border border-red-400/30 bg-red-400/[0.06] px-4 py-3 text-sm text-red-300">{error}</div>}

        <button type="button" onClick={onStart} disabled={starting || needsTopic} className="btn-primary mt-6 h-12 w-full justify-center text-base disabled:opacity-50">
          {starting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Swords className="h-5 w-5" />}
          {setup.mode === "challenge" ? "Accept the challenge" : setup.mode === "module" ? "Start the check" : "Start quiz"}
        </button>
        <div className="mt-4 grid gap-2 text-[11px] text-content-subtle sm:grid-cols-3">
          <span className="flex items-center gap-1.5">
            <Split className="h-3.5 w-3.5 text-gold-300" /> Two 50:50 lifelines per quiz (half points)
          </span>
          <span className="flex items-center gap-1.5">
            <Headphones className="h-3.5 w-3.5 text-gold-300" /> AneQue reads questions in her own voice
          </span>
          <span>Keys: 1-4 or A-D, Enter for next, F for 50:50</span>
        </div>
      </Panel>

      {setup.mode !== "module" && setup.mode !== "challenge" && cats.length > 0 && (
        <Panel className="mt-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Eyebrow>Every lesson has a quiz</Eyebrow>
              <h2 className="mt-1 font-display text-lg font-semibold text-content">Quiz any lesson</h2>
              <p className="text-sm text-content-muted">Pick a topic, then the lesson you want to test. Pass 60% to complete it.</p>
            </div>
            <select
              value={lessonTopic || cats[0]?.slug}
              onChange={(e) => setLessonTopic(e.target.value)}
              className="w-full rounded-xl border border-hairline bg-ink-900/80 px-3 py-2.5 text-sm text-content focus:border-gold-400/50 focus:outline-none sm:w-64"
              aria-label="Topic"
            >
              {cats.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {(cats.find((c) => c.slug === (lessonTopic || cats[0]?.slug))?.modules ?? []).map((m, i) => (
              <button
                key={m.id}
                type="button"
                disabled={starting}
                onMouseEnter={() => sfx("hover")}
                onClick={() => onStartLesson(m.id)}
                className="group flex items-center gap-3 rounded-2xl border border-hairline px-3.5 py-3 text-left transition-colors hover:border-gold-400/40"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-hairline font-mono text-xs text-content-subtle">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-content">{m.title}</span>
                  <span className="text-[11px] text-content-subtle">{DIFF_LABEL[{ beginner: "easy", intermediate: "medium", advanced: "hard", expert: "expert" }[m.level] ?? "mixed"]} · knowledge check</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-content-subtle transition-transform group-hover:translate-x-0.5 group-active:translate-x-0.5" />
              </button>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ player

function TimerRing({ left, limitMs, frozen }: { left: number; limitMs: number; frozen: boolean }) {
  const pct = Math.max(0, Math.min(1, left / limitMs));
  const r = 22;
  const c = 2 * Math.PI * r;
  const urgent = left < 5000 && !frozen;
  return (
    <div className={cn("relative grid h-14 w-14 shrink-0 place-items-center", urgent && "animate-pulse")} role="timer" aria-label={`${Math.ceil(left / 1000)} seconds left`}>
      <svg viewBox="0 0 52 52" className="absolute inset-0 -rotate-90">
        <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
        <circle cx="26" cy="26" r={r} fill="none" stroke={urgent ? "#f87171" : "#e2a72f"} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: "stroke-dashoffset 250ms linear" }} />
      </svg>
      <span className={cn("font-mono text-sm font-bold tabular-nums", urgent ? "text-red-300" : frozen ? "text-content-subtle" : "text-content")}>{Math.ceil(left / 1000)}</span>
    </div>
  );
}

function QuizPlayer({ attemptId, onFinished, onLost }: { attemptId: string; onFinished: (r: QuizResult) => void; onLost: () => void }) {
  const [state, setState] = useState<QuizState | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [reveal, setReveal] = useState<AnswerResult | null>(null);
  const [hidden, setHidden] = useState<number[]>([]);
  const [fiftyLeft, setFiftyLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pop, setPop] = useState<{ id: number; text: string } | null>(null);
  const clock = useServerClock();
  const { settings } = useAudio();
  const timedOut = useRef<number | null>(null);
  const announced = useRef<number>(-1);
  const warned = useRef<{ i: number; ten: boolean; beats: number }>({ i: -1, ten: false, beats: 99 });
  const q = state?.question ?? null;
  const lifelinesOff = state?.mode === "daily" || state?.mode === "weekly" || state?.mode === "challenge";
  useTicker(!!q && !reveal, 200);

  const adopt = useCallback((s: QuizState) => {
    setState(s);
    setHidden(s.question?.hidden ?? []);
    setFiftyLeft(s.question?.fiftyLeft ?? 0);
  }, []);

  const load = useCallback(async () => {
    const sent = Date.now();
    try {
      const s = await getJson<QuizState>(`/api/academy/quiz/${attemptId}`);
      clock.sync(s.serverNow, sent);
      adopt(s);
      setErr(null);
      if (s.status !== "active") {
        const r = await postJson<QuizResult>(`/api/academy/quiz/${attemptId}`, { action: "finish" });
        onFinished(r);
        return;
      }
      if (s.revealed) {
        const a = s.answered.find((x) => x && x.index === s.current);
        if (a) {
          setPicked(a.chosen);
          setReveal({ index: a.index, correct: a.correct, timedOut: a.chosen === -1, correctShown: a.correctShown, explanation: a.explanation, voice: { explanation: a.voice.explanation }, points: a.points, fresh: a.fresh, assisted: a.assisted, ms: a.ms, run: s.run, score: s.score, last: s.current === s.total - 1 });
        }
      }
    } catch (e) {
      const st = (e as { status?: number }).status;
      if (st === 404) onLost();
      else setErr((e as Error).message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  useEffect(() => {
    void load();
    return () => {
      duck(1);
      stopVoice();
    };
  }, [load]);

  // AneQue may help in Live Talk, but must never give the open question away.
  useEffect(() => {
    if (q && !reveal) setTalkContext({ questionOpen: true, question: q.prompt, topic: q.category });
    else setTalkContext({ questionOpen: false, question: null });
  }, [q, reveal]);
  useEffect(() => () => clearTalkContext(["questionOpen", "question"]), []);

  // Music steps back while a question is open.
  useEffect(() => {
    duck(q && !reveal ? 0.35 : 1);
  }, [q, reveal]);

  const readQuestion = useCallback(
    (withOptions: boolean) => {
      if (!q) return;
      const pieces: Piece[] = [{ url: q.voice.prompt, text: q.prompt }];
      if (withOptions)
        q.options.forEach((o, i) => {
          if (hidden.includes(i)) return;
          pieces.push(line(`opt_${LETTERS[i]}` as VoiceLine), { url: q.voice.options[i], text: o });
        });
      play(pieces, { caption: withOptions ? `${q.prompt} ${q.options.map((o, i) => `${LETTERS[i]}: ${o}`).join("  ")}` : q.prompt });
    },
    [q, hidden]
  );

  // AneQue announces each new question: first / halfway / last, then reads it.
  useEffect(() => {
    if (!q || reveal || announced.current === q.index) return;
    announced.current = q.index;
    const pieces: Piece[] = [];
    if (settings.guide) {
      if (q.index === 0) pieces.push(line("question_first"));
      else if (q.index === q.total - 1) pieces.push(line("question_last"));
      else if (q.total >= 6 && q.index === Math.floor(q.total / 2)) pieces.push(line("question_half"));
      else if (q.index < 20) pieces.push(line(`q_${q.index + 1}` as VoiceLine));
    }
    if (settings.readQuestions) pieces.push({ url: q.voice.prompt, text: q.prompt });
    if (pieces.length) play(pieces, { caption: q.prompt, queue: q.index === 0 });
  }, [q, reveal, settings.guide, settings.readQuestions]);

  const answer = useCallback(
    async (choice: number) => {
      if (!q || reveal || busy || (choice >= 0 && hidden.includes(choice))) return;
      unlock();
      setBusy(true);
      setPicked(choice);
      if (choice >= 0) sfx("select");
      const prevRun = state?.run ?? 0;
      try {
        const r = await postJson<AnswerResult>(`/api/academy/quiz/${attemptId}`, { action: "answer", index: q.index, choice });
        setReveal(r);
        setState((s) => (s ? { ...s, score: r.score, correct: s.correct + (r.correct ? 1 : 0), run: r.run, revealed: true } : s));
        const after: Piece[] = [];
        if (r.correct) {
          sfx("correct");
          if (r.points) {
            setTimeout(() => sfx("coin"), 260);
            setPop({ id: Date.now(), text: `+${r.points}` });
          }
          const streak = { 3: "streak", 5: "streak_5", 7: "streak_7", 10: "streak_10" }[r.run] as VoiceLine | undefined;
          if (streak) {
            setTimeout(() => sfx("fire"), 420);
            say(streak, { auto: true });
          } else if (r.ms < 3000) sayOneOf("fast", 3, { auto: true });
          else sayOneOf("correct", 10, { auto: true });
        } else {
          sfx("wrong");
          if (prevRun >= 3) say("streak_broken", { auto: true });
          else if (r.timedOut) sayOneOf("timeout", 3, { auto: true });
          else sayOneOf("incorrect", 7, { auto: true });
          if (settings.explainWrong && r.explanation) after.push({ url: r.voice.explanation, text: r.explanation });
        }
        if (after.length) play(after, { queue: true, caption: r.explanation });
      } catch (e) {
        setErr((e as Error).message);
        if ((e as { status?: number }).status === 409) void load();
      } finally {
        setBusy(false);
      }
    },
    [q, reveal, busy, hidden, attemptId, load, state?.run, settings.explainWrong]
  );

  const fifty = useCallback(async () => {
    if (!q || reveal || busy || fiftyLeft <= 0 || hidden.length || lifelinesOff) return;
    unlock();
    setBusy(true);
    try {
      const r = await postJson<{ hidden: number[]; fiftyLeft: number }>(`/api/academy/quiz/${attemptId}`, { action: "fifty", index: q.index });
      setHidden(r.hidden);
      setFiftyLeft(r.fiftyLeft);
      sfx("fifty");
      sayOneOf("fifty", 2, { auto: true });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [q, reveal, busy, fiftyLeft, hidden.length, lifelinesOff, attemptId]);

  const next = useCallback(async () => {
    if (!reveal || busy) return;
    setBusy(true);
    stopVoice();
    try {
      if (reveal.last) {
        const r = await postJson<QuizResult>(`/api/academy/quiz/${attemptId}`, { action: "finish" });
        onFinished(r);
        return;
      }
      const sent = Date.now();
      const s = await postJson<QuizState>(`/api/academy/quiz/${attemptId}`, { action: "next" });
      clock.sync(s.serverNow, sent);
      adopt(s);
      setPicked(null);
      setReveal(null);
      setPop(null);
      sfx("whoosh");
    } catch (e) {
      setErr((e as Error).message);
      if ((e as { status?: number }).status === 409) void load();
    } finally {
      setBusy(false);
    }
  }, [reveal, busy, attemptId, onFinished, clock, load, adopt]);

  // Clock: the server decides time-outs; this asks it to settle, and warns.
  const now = clock.now();
  const left = q ? (reveal ? Math.max(0, q.limitMs - reveal.ms) : Math.max(0, q.deadline - now)) : 0;
  useEffect(() => {
    if (!q || reveal || busy) return;
    const w = warned.current;
    if (w.i !== q.index) warned.current = { i: q.index, ten: false, beats: 99 };
    if (now > q.deadline + 600 && timedOut.current !== q.index) {
      timedOut.current = q.index;
      void answer(-1);
      return;
    }
    const secs = Math.ceil((q.deadline - now) / 1000);
    if (q.limitMs >= 20_000 && secs === 10 && !warned.current.ten) {
      warned.current.ten = true;
      say("time_10", { auto: true, queue: true });
    }
    if (secs <= 5 && secs > 0 && secs < warned.current.beats) {
      warned.current.beats = secs;
      sfx("heartbeat");
    }
  }, [now, q, reveal, busy, answer]);

  // Keyboard
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      const k = e.key.toLowerCase();
      const i = ["1", "2", "3", "4"].indexOf(k) >= 0 ? Number(k) - 1 : ["a", "b", "c", "d"].indexOf(k);
      if (i >= 0 && !reveal) void answer(i);
      else if (k === "f" && !reveal) void fifty();
      else if (k === "r") readQuestion(true);
      else if ((k === "enter" || k === " ") && reveal) {
        e.preventDefault();
        void next();
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [answer, next, reveal, fifty, readQuestion]);

  // Voice commands from AneQue's dock
  useEffect(() => {
    const on = (e: Event) => {
      const p = (e as CustomEvent<NonNullable<Parsed>>).detail;
      if (!q) return;
      if (p.cmd === "repeat") readQuestion(true);
      else if (p.cmd === "explain" && reveal) play([{ url: reveal.voice.explanation, text: reveal.explanation || "There is no explanation for this one." }]);
      else if (p.cmd === "next" && reveal) void next();
      else if (p.cmd === "answer" && p.option != null && !reveal) void answer(p.option);
    };
    window.addEventListener(COMMAND_EVENT, on);
    return () => window.removeEventListener(COMMAND_EVENT, on);
  }, [q, reveal, next, answer, readQuestion]);

  // Plain computation, not useMemo: the React Compiler reads `state.current` as a ref.
  const segments = !state
    ? []
    : Array.from({ length: state.total }, (_, i) => {
        const a = state.answered.find((x) => x && x.index === i);
        if (i === state.current && reveal) return reveal.correct ? "right" : "wrong";
        if (a) return a.correct ? "right" : "wrong";
        return i === state.current ? "current" : "todo";
      });

  if (err && !state) return <Empty>{err}</Empty>;
  if (!state || !q)
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold-300" />
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl">
      {/* sticky progress */}
      <div className="sticky top-[4.5rem] z-20 -mx-5 border-b border-hairline bg-ink-950/90 px-5 py-2.5 backdrop-blur sm:top-20 sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
        <div className="flex items-center gap-3">
          <TimerRing left={left} limitMs={q.limitMs} frozen={!!reveal} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-content">
                Question {q.index + 1} <span className="text-content-subtle">/ {q.total}</span>
                {state.mode === "speed" && <span className="ml-2 text-gold-300">Speed Run</span>}
              </span>
              <span className="flex items-center gap-3">
                {state.run >= 2 && (
                  <motion.span key={state.run} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="flex items-center gap-1 font-semibold text-gold-300">
                    <Flame className="h-3.5 w-3.5" /> {state.run}
                  </motion.span>
                )}
                <span className="font-mono font-semibold text-gold-200">{state.score.toLocaleString("en-US")} pts</span>
              </span>
            </div>
            <div className="mt-2 flex gap-1">
              {segments.map((s, i) => (
                <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-500", s === "right" ? "bg-mint-400" : s === "wrong" ? "bg-red-400/80" : s === "current" ? "bg-gold-300" : "bg-white/10")} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div key={q.index} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="mt-4">
          <div className="surface relative rounded-3xl p-5 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={DIFF_TONE[q.difficulty]}>{DIFF_LABEL[q.difficulty]}</Pill>
              <span className="min-w-0 truncate text-[11px] text-content-subtle">{q.category}</span>
              <div className="ml-auto flex items-center gap-1.5">
                {!lifelinesOff && (
                  <button
                    type="button"
                    onClick={() => void fifty()}
                    disabled={!!reveal || busy || fiftyLeft <= 0 || hidden.length > 0}
                    className={cn("flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold transition-colors disabled:opacity-40", hidden.length ? "border-gold-400/60 text-gold-200" : "border-hairline text-content-muted hover:border-gold-400/50 hover:text-gold-200")}
                    aria-label={`Use 50:50 lifeline, ${fiftyLeft} left`}
                    title="Remove two wrong answers. This answer scores half."
                  >
                    <Split className="h-3.5 w-3.5" /> 50:50 <span className="font-mono text-content-subtle">×{fiftyLeft}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    unlock();
                    readQuestion(true);
                  }}
                  className="acad-icon-btn h-8 w-8"
                  aria-label="Read the question and options aloud"
                  title="Read aloud (R)"
                >
                  <Headphones />
                </button>
              </div>
            </div>
            <h2 className="mt-4 font-display text-xl font-semibold leading-snug text-content sm:text-2xl">{q.prompt}</h2>

            <div className="mt-6 grid gap-2.5">
              {q.options.map((o, i) => {
                const isPicked = picked === i;
                const right = reveal && reveal.correctShown === i;
                const wrong = reveal && isPicked && !reveal.correct;
                const gone = hidden.includes(i) && !right;
                return (
                  <motion.button
                    key={i}
                    type="button"
                    disabled={!!reveal || busy || gone}
                    onClick={() => void answer(i)}
                    onMouseEnter={() => !reveal && !gone && sfx("hover")}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: gone ? 0.25 : 1, y: 0, scale: gone ? 0.98 : 1 }}
                    transition={{ delay: gone ? 0 : 0.05 + i * 0.05 }}
                    className={cn(
                      "acad-option flex w-full items-center gap-3 rounded-2xl border border-hairline bg-ink-900/40 px-4 py-3.5 text-left text-[15px] text-content sm:py-4",
                      isPicked && !reveal && "is-picked",
                      right && "is-right",
                      wrong && "is-wrong",
                      gone && "line-through",
                      reveal && !right && !wrong && !gone && "opacity-55"
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-xl border font-mono text-xs font-bold",
                        right ? "border-mint-400 bg-mint-400 text-ink-950" : wrong ? "border-red-400 bg-red-400 text-ink-950" : "border-hairline text-content-subtle"
                      )}
                    >
                      {right ? <CheckCircle2 className="h-4 w-4" /> : wrong ? <XCircle className="h-4 w-4" /> : LETTERS[i]}
                    </span>
                    <span className="min-w-0 flex-1">{o}</span>
                    {busy && isPicked && !reveal && <Loader2 className="h-4 w-4 animate-spin text-gold-300" />}
                  </motion.button>
                );
              })}
            </div>

            <AnimatePresence>
              {pop && (
                <motion.div
                  key={pop.id}
                  initial={{ opacity: 0, y: 10, scale: 0.8 }}
                  animate={{ opacity: 1, y: -18, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="pointer-events-none absolute right-6 top-16 font-display text-2xl font-bold text-mint-300 drop-shadow-[0_0_14px_rgba(52,227,161,0.6)]"
                >
                  {pop.text}
                </motion.div>
              )}
            </AnimatePresence>

            {reveal && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <div className={cn("mt-5 rounded-2xl border p-4", reveal.correct ? "border-mint-400/30 bg-mint-400/[0.05]" : "border-red-400/25 bg-red-400/[0.04]")}>
                  <div className={cn("flex items-center gap-2 text-sm font-semibold", reveal.correct ? "text-mint-300" : "text-red-300")}>
                    {reveal.correct ? <CheckCircle2 className="h-4 w-4" /> : reveal.timedOut ? <Timer className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {reveal.correct ? `Correct, +${reveal.points} points${reveal.assisted ? " (50:50)" : ""}` : reveal.timedOut ? "Time's up" : "Not quite"}
                    <span className="ml-auto flex items-center gap-1 font-mono text-[11px] font-normal text-content-subtle">
                      <Clock className="h-3 w-3" /> {(reveal.ms / 1000).toFixed(1)}s
                    </span>
                  </div>
                  {reveal.explanation && <p className="mt-2 text-sm leading-relaxed text-content-muted">{reveal.explanation}</p>}
                  {reveal.correct && !reveal.fresh && <p className="mt-2 text-[11px] text-content-subtle">Practice answer: you got this one right recently, so it scores but earns no XP this time.</p>}
                </div>
                <button type="button" onClick={() => void next()} disabled={busy} className="btn-primary mt-4 h-12 w-full justify-center text-base">
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                  {reveal.last ? "See results" : "Next question"} <ArrowRight className="h-5 w-5" />
                </button>
              </motion.div>
            )}
            {err && <div className="mt-4 text-sm text-red-300">{err}</div>}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
