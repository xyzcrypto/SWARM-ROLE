"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Award, CheckCircle2, Crown, Loader2, Lock, LogIn, Pause, Radio, Users, WifiOff, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRealtime } from "@/lib/useRealtime";
import { liveChannel } from "@/lib/realtime-channels";
import { livePhase, type LivePhase } from "@modules/academy/lib/engine";
import { duck, play, say, sayOneOf, sfx, unlock, type Piece } from "../client/audio";
import { VOICE_LINES, type VoiceLine } from "../client/voice-lines";

const vline = (k: VoiceLine): Piece => ({ url: `/academy/voice/${k}.mp3`, text: VOICE_LINES[k] });
import { getJson, postJson, useAudio, useServerClock, useTicker } from "../client/hooks";
import { COMMAND_EVENT, type Parsed } from "../client/commands";
import { clearTalkContext, setTalkContext } from "../client/talk";
import type { LiveMe, LiveState } from "./types";
import { Avatar, burstConfetti, DIFF_LABEL, DIFF_TONE, Empty, fmt, Panel, Pill } from "./ui";

const LETTERS = ["A", "B", "C", "D"];
const phaseKey = (p: LivePhase | null | undefined) => (p ? `${p.kind}:${"index" in p ? p.index : ""}` : "");

export function LiveArena({ id }: { id: string }) {
  const [state, setState] = useState<LiveState | null>(null);
  const [me, setMe] = useState<LiveMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [joining, setJoining] = useState(false);
  const [sending, setSending] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const clock = useServerClock();
  const audio = useAudio();
  const lastKey = useRef("");
  const announced = useRef<Set<string>>(new Set());

  const loadMe = useCallback(async () => {
    const sent = Date.now();
    try {
      const m = await getJson<LiveMe & { guest?: boolean }>(`/api/academy/live/${id}/me`);
      clock.sync(m.serverNow, sent);
      setMe(m);
      setOffline(false);
    } catch {
      setOffline(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadState = useCallback(async () => {
    try {
      const s = await getJson<LiveState>(`/api/academy/live/${id}`);
      setState(s);
      setError(null);
      setOffline(false);
      return s;
    } catch (e) {
      if ((e as { status?: number }).status === 404) setError("This live quiz does not exist.");
      else setOffline(true);
      throw e;
    }
  }, [id]);

  const loadAll = useCallback(async () => {
    await Promise.allSettled([loadMe(), loadState()]);
  }, [loadMe, loadState]);

  useEffect(() => {
    void loadAll();
    return () => duck(1);
  }, [loadAll]);

  // Host actions and joins arrive here; fall back to a slow poll if realtime is down.
  useRealtime({ channel: liveChannel(id), event: "live", pollMs: 15_000, onMessage: () => loadAll() });

  // Local phase from the shared schedule and the server-synced clock.
  const now = clock.now();
  const phase = state ? livePhase(state.clock, now) : null;
  useTicker(!!state && phase?.kind !== "ended" && phase?.kind !== "cancelled", 250);

  // Play mode while a question is up: same one-screen frame as solo quizzes.
  const playing = phase?.kind === "question" || phase?.kind === "reveal";
  useEffect(() => {
    if (!playing) return;
    document.documentElement.dataset.acadPlaying = "1";
    return () => {
      delete document.documentElement.dataset.acadPlaying;
    };
  }, [playing]);

  // When our clock crosses into a new phase, fetch what it contains (the
  // question, or the reveal). The public state is edge-cached for 2s, so a full
  // room costs one origin call; a small jitter spreads the burst.
  //
  // Keyed on the phase STRING, not the phase object: the object is rebuilt on
  // every 250ms tick, and depending on it cancelled the pending fetch before it
  // ever fired, so the reveal never arrived.
  const localKey = phaseKey(phase);
  const serverKey = phaseKey(state?.phase);
  useEffect(() => {
    if (!localKey || localKey === lastKey.current) return;
    lastKey.current = localKey;
    if (serverKey === localKey) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const attempt = () => {
      tries++;
      loadState()
        .then((s) => {
          const local = livePhase(s.clock, clock.now());
          if (phaseKey(s.phase) !== phaseKey(local) && tries < 6) timer = setTimeout(attempt, 900);
          else if (local.kind === "reveal" || local.kind === "ended") void loadMe();
        })
        .catch(() => {
          if (tries < 6) timer = setTimeout(attempt, 1500);
        });
    };
    timer = setTimeout(attempt, 150 + Math.random() * 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localKey]);

  // Sound + voice cues, once per phase.
  useEffect(() => {
    if (!phase) return;
    const key = phaseKey(phase);
    if (announced.current.has(key)) return;
    announced.current.add(key);
    if (phase.kind === "countdown") say("live_soon", { auto: true });
    if (phase.kind === "reveal") sfx("reveal");
    if (phase.kind === "ended" && state?.status === "ended") {
      sfx("winner");
      burstConfetti();
      const mine = me?.joined ? me.rank : null;
      const pieces = [vline("live_winner")];
      if (mine === 1 && (me?.score ?? 0) > 0) pieces.push(vline("live_you_won"));
      else if (mine && mine <= 3 && (me?.score ?? 0) > 0) pieces.push(vline("live_podium"));
      else if (me?.joined) pieces.push(vline("live_thanks"));
      if (audio.settings.guide) play(pieces);
    }
    duck(phase.kind === "question" ? 0.25 : 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, state?.status]);

  // Each question: a cue (first / halfway / last / next), then AneQue reads it.
  const readFor = useRef(-1);
  useEffect(() => {
    if (phase?.kind !== "question" || !state?.question || state.question.index !== phase.index || readFor.current === phase.index) return;
    readFor.current = phase.index;
    sfx("go");
    const q = state.question;
    const pieces = [];
    if (audio.settings.guide) {
      if (phase.index === 0) pieces.push(vline("live_go"));
      else if (phase.index === state.count - 1) pieces.push(vline("live_last"));
      else if (state.count >= 6 && phase.index === Math.floor(state.count / 2)) pieces.push(vline("live_half"));
      else pieces.push(vline("live_next"));
    }
    if (audio.settings.readQuestions) pieces.push({ url: q.voice.prompt, text: q.prompt });
    if (pieces.length) play(pieces, { caption: q.prompt });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase?.kind, phase && "index" in phase ? phase.index : -1, state?.question?.index]);

  // AneQue must never give an open live question away in Live Talk.
  const openQ = phase?.kind === "question" && state?.question && state.question.index === phase.index ? state.question.prompt : null;
  useEffect(() => {
    setTalkContext(openQ ? { questionOpen: true, question: openQ } : { questionOpen: false, question: null });
  }, [openQ]);
  useEffect(() => () => clearTalkContext(["questionOpen", "question"]), []);

  // Pause / resume announcements
  const wasPaused = useRef(false);
  const pausedNow = !!phase && "paused" in phase && phase.paused;
  useEffect(() => {
    if (pausedNow && !wasPaused.current) say("live_paused", { auto: true });
    if (!pausedNow && wasPaused.current) say("live_resumed", { auto: true });
    wasPaused.current = pausedNow;
  }, [pausedNow]);

  // Countdown ticks
  const lastTick = useRef(-1);
  useEffect(() => {
    if (phase?.kind !== "countdown") return;
    const s = Math.ceil((phase.startsAt - now) / 1000);
    if (s !== lastTick.current && s <= 5 && s > 0) {
      lastTick.current = s;
      sfx("count");
      if (s <= 3) say(`count_${s}` as VoiceLine, { auto: true });
    }
  }, [phase, now]);

  const join = async () => {
    unlock();
    setJoining(true);
    setMsg(null);
    try {
      await postJson(`/api/academy/live/${id}/me`, { action: "join" });
      sfx("achievement");
      say("live_join", { auto: true });
      await loadAll();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setJoining(false);
    }
  };

  const myAnswer = (index: number) => me?.answers.find((a) => a.index === index) ?? null;

  const answer = useCallback(
    async (index: number, choice: number) => {
      if (!me?.joined || sending != null || myAnswer(index)) return;
      unlock();
      sfx("select");
      setSending(choice);
      setMsg(null);
      try {
        await postJson(`/api/academy/live/${id}/me`, { action: "answer", index, choice });
        setMe((m) => (m ? { ...m, answers: [...m.answers, { index, choice, correct: null, points: null }] } : m));
        sfx("lock");
        sayOneOf("live_lock", 2, { auto: true });
      } catch (e) {
        setMsg((e as Error).message);
        void loadMe();
      } finally {
        setSending(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [me, sending, id, loadMe]
  );

  // Voice: "option B"
  useEffect(() => {
    const on = (e: Event) => {
      const p = (e as CustomEvent<NonNullable<Parsed>>).detail;
      if (p.cmd === "answer" && p.option != null && phase?.kind === "question") void answer(phase.index, p.option);
    };
    window.addEventListener(COMMAND_EVENT, on);
    return () => window.removeEventListener(COMMAND_EVENT, on);
  }, [answer, phase]);

  // Reveal sound for my own answer
  const revealedFor = useRef(-1);
  useEffect(() => {
    if (phase?.kind !== "reveal" || revealedFor.current === phase.index) return;
    const a = me?.answers.find((x) => x.index === phase.index);
    if (a && a.correct != null) {
      revealedFor.current = phase.index;
      sfx(a.correct ? "correct" : "wrong");
      const q = state?.question;
      const pieces = audio.settings.guide ? [vline(Math.random() < 0.5 ? "live_reveal" : "live_reveal_2")] : [];
      if (!a.correct && audio.settings.explainWrong && q?.explanation) pieces.push({ url: q.voiceExplanation ?? null, text: q.explanation });
      if (pieces.length) play(pieces, { caption: q?.explanation ?? undefined });
    }
  }, [phase, me]);

  const top = state?.leaderboard ?? [];
  const myRow = useMemo(() => top.find((r) => r.userId === me?.userId), [top, me]);

  if (error) return <Empty>{error}</Empty>;
  if (!state || !phase)
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold-300" />
      </div>
    );

  const q = state.question && phase && "index" in phase && state.question.index === phase.index ? state.question : null;
  const guest = (me as { guest?: boolean } | null)?.guest;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/academy/live" className="text-xs font-semibold text-content-subtle hover:text-gold-300">
          ← All live quizzes
        </Link>
        <span className="ml-auto flex items-center gap-2 text-xs text-content-subtle">
          {offline && (
            <span className="flex items-center gap-1 text-red-300">
              <WifiOff className="h-3.5 w-3.5" /> Reconnecting…
            </span>
          )}
          <Users className="h-3.5 w-3.5" /> {state.participants} players
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-xl font-semibold tracking-tight text-content sm:text-3xl">{state.title}</h1>
        {(phase.kind === "question" || phase.kind === "reveal" || phase.kind === "countdown") && (
          <Pill tone="border-mint-400/50 text-mint-300">
            <span className="acad-live-dot h-1.5 w-1.5 rounded-full bg-mint-400 text-mint-400" /> LIVE
          </Pill>
        )}
      </div>

      <div className="mt-3 grid gap-5 sm:mt-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          {phase.kind === "scheduled" || phase.kind === "countdown" ? (
            <WaitingRoom state={state} phase={phase} now={now} joined={!!me?.joined} guest={!!guest} joining={joining} onJoin={join} />
          ) : phase.kind === "cancelled" ? (
            <Empty>This live quiz was cancelled by the host.</Empty>
          ) : phase.kind === "ended" ? (
            <Final state={state} me={me} />
          ) : q ? (
            <QuestionStage
              phase={phase}
              q={q}
              now={now}
              count={state.count}
              questionSec={state.questionSec}
              mine={myAnswer(phase.index)}
              sending={sending}
              canAnswer={!!me?.joined}
              guest={!!guest}
              onAnswer={(c) => answer(phase.index, c)}
              onJoin={join}
              joining={joining}
            />
          ) : (
            <div className="grid min-h-[40vh] place-items-center">
              <Loader2 className="h-8 w-8 animate-spin text-gold-300" />
            </div>
          )}
          {msg && <div className="mt-3 rounded-xl border border-red-400/30 bg-red-400/[0.05] px-4 py-2.5 text-sm text-red-300">{msg}</div>}
        </div>

        <aside className="space-y-4">
          {me?.joined && (
            <div className="rounded-3xl border border-gold-400/30 bg-gold-400/[0.05] p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-300">You</div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="font-display text-2xl font-bold text-content">{fmt(me.score)}</span>
                <span className="text-sm text-content-muted">{me.rank ? `#${me.rank}` : "unranked"}</span>
              </div>
              <div className="text-[11px] text-content-subtle">{me.correct} correct</div>
            </div>
          )}
          <Panel className="!p-4">
            <div className="mb-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-content-subtle">
              <span>Live leaderboard</span>
              {phase.kind === "question" && <span className="normal-case tracking-normal">updates on reveal</span>}
            </div>
            {top.length ? (
              <ol className="space-y-1">
                <AnimatePresence initial={false}>
                  {top.map((r) => (
                    <motion.li
                      layout
                      key={r.userId}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 34 }}
                      className={cn("flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm", r.rank === 1 && "bg-gold-400/10", myRow?.userId === r.userId && "acad-me-row")}
                    >
                      <span className={cn("w-5 text-center font-mono text-xs font-bold", r.rank <= 3 ? "text-gold-300" : "text-content-subtle")}>{r.rank}</span>
                      <Avatar src={r.image} alt={r.name} size={24} />
                      <span className="min-w-0 flex-1 truncate text-content">{r.name}</span>
                      <span className="font-mono text-xs text-gold-200">{fmt(r.score)}</span>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ol>
            ) : (
              <p className="text-sm text-content-subtle">Scores appear after the first reveal.</p>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function WaitingRoom({ state, phase, now, joined, guest, joining, onJoin }: { state: LiveState; phase: LivePhase; now: number; joined: boolean; guest: boolean; joining: boolean; onJoin: () => void }) {
  const startsAt = phase.kind === "scheduled" || phase.kind === "countdown" ? phase.startsAt : now;
  const ms = Math.max(0, startsAt - now);
  const s = Math.floor(ms / 1000);
  const big = phase.kind === "countdown" || ms < 10_000;
  return (
    <Panel className="relative overflow-hidden text-center">
      <div className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-64 w-64 rounded-full bg-gold-500/10 blur-3xl" aria-hidden />
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-300">{big ? "Get ready" : "Starts in"}</div>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={big ? Math.ceil(ms / 1000) : "clock"}
          initial={big ? { scale: 1.6, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ duration: 0.35 }}
          className={cn("mt-3 font-display font-bold tabular-nums text-content", big ? "text-7xl text-gold-200 sm:text-8xl" : "text-5xl sm:text-6xl")}
        >
          {big ? Math.max(1, Math.ceil(ms / 1000)) : `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`}
        </motion.div>
      </AnimatePresence>
      <p className="mt-2 text-sm text-content-muted">
        {state.count} questions · {state.questionSec}s each · answers revealed together
      </p>
      {state.description && <p className="mx-auto mt-3 max-w-lg text-sm text-content-subtle">{state.description}</p>}

      <div className="mt-6">
        {joined ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-mint-400/40 bg-mint-400/10 px-4 py-2 text-sm font-semibold text-mint-200">
            <CheckCircle2 className="h-4 w-4" /> You&apos;re in. Stay on this page.
          </div>
        ) : guest ? (
          <Link href={`/login?callbackUrl=/academy/live/${state.id}`} className="btn-gold h-12 px-6 text-sm">
            <LogIn className="h-4 w-4" /> Sign in to join
          </Link>
        ) : (
          <button type="button" onClick={onJoin} disabled={joining} className="btn-primary h-12 px-8 text-base">
            {joining ? <Loader2 className="h-5 w-5 animate-spin" /> : <Radio className="h-5 w-5" />} Join Quiz
          </button>
        )}
      </div>

      <div className="mt-8 border-t border-hairline pt-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-content-subtle">Waiting room · {state.participants} joined</div>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {state.faces.map((f) => (
            <motion.span key={f.id} initial={{ scale: 0 }} animate={{ scale: 1 }} title={f.name}>
              <Avatar src={f.image} alt={f.name} size={32} className="ring-2 ring-ink-950" />
            </motion.span>
          ))}
          {state.participants > state.faces.length && <span className="grid h-8 place-items-center rounded-full bg-white/5 px-2.5 text-xs text-content-subtle">+{state.participants - state.faces.length}</span>}
          {!state.participants && <span className="text-sm text-content-subtle">No one yet. Be the first.</span>}
        </div>
      </div>
    </Panel>
  );
}

function QuestionStage({
  phase,
  q,
  now,
  count,
  questionSec,
  mine,
  sending,
  canAnswer,
  guest,
  onAnswer,
  onJoin,
  joining,
}: {
  phase: Extract<LivePhase, { kind: "question" | "reveal" }>;
  q: NonNullable<LiveState["question"]>;
  now: number;
  count: number;
  questionSec: number;
  mine: LiveMe["answers"][number] | null;
  sending: number | null;
  canAnswer: boolean;
  guest: boolean;
  onAnswer: (choice: number) => void;
  onJoin: () => void;
  joining: boolean;
}) {
  const revealing = phase.kind === "reveal" && q.answer != null;
  const left = phase.kind === "question" ? Math.max(0, phase.closesAt - now) : 0;
  const pct = phase.kind === "question" ? left / (questionSec * 1000) : 0;
  const total = (q.distribution ?? [0, 0, 0, 0]).reduce((a, b) => a + b, 0);
  const locked = !!mine || sending != null;
  return (
    <motion.div key={phase.index} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="surface relative overflow-hidden rounded-3xl p-4 sm:p-8">
      <div className="absolute inset-x-0 top-0 h-1 bg-white/5">
        <div className={cn("h-full transition-[width] duration-200 ease-linear", left < 5000 ? "bg-red-400" : "bg-gold-300")} style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-content-subtle">
          Q{phase.index + 1}/{count}
        </span>
        <Pill tone={DIFF_TONE[q.difficulty]}>{DIFF_LABEL[q.difficulty]}</Pill>
        <span className="text-[11px] text-content-subtle">{q.category}</span>
        <span className="ml-auto font-mono text-lg font-bold tabular-nums text-content">
          {phase.paused ? (
            <span className="flex items-center gap-1 text-sm text-gold-300">
              <Pause className="h-4 w-4" /> Paused
            </span>
          ) : phase.kind === "question" ? (
            `${Math.ceil(left / 1000)}s`
          ) : (
            <span className="text-sm text-gold-300">Reveal</span>
          )}
        </span>
      </div>
      <h2 className="acad-play-prompt mt-3 font-display font-semibold leading-snug text-content sm:mt-4">{q.prompt}</h2>
      <div className="mt-4 grid gap-2 sm:mt-6 sm:grid-cols-2 sm:gap-2.5">
        {q.options.map((o, i) => {
          const right = revealing && q.answer === i;
          const picked = mine?.choice === i || sending === i;
          const wrong = revealing && picked && !right;
          const share = total ? Math.round(((q.distribution?.[i] ?? 0) / total) * 100) : 0;
          return (
            <button
              key={i}
              type="button"
              disabled={!canAnswer || locked || phase.kind !== "question" || phase.paused}
              onClick={() => onAnswer(i)}
              className={cn(
                "acad-option acad-play-option relative flex items-center gap-3 overflow-hidden rounded-2xl border border-hairline bg-ink-900/40 px-4 text-left text-content sm:min-h-[4rem]",
                picked && !revealing && "is-picked",
                right && "is-right",
                wrong && "is-wrong",
                revealing && !right && !picked && "opacity-55"
              )}
            >
              {revealing && <motion.span className="absolute inset-y-0 left-0 bg-white/[0.05]" initial={{ width: 0 }} animate={{ width: `${share}%` }} transition={{ duration: 0.8 }} />}
              <span className={cn("relative grid h-8 w-8 shrink-0 place-items-center rounded-xl border font-mono text-xs font-bold", right ? "border-mint-400 bg-mint-400 text-ink-950" : wrong ? "border-red-400 bg-red-400 text-ink-950" : "border-hairline text-content-subtle")}>
                {right ? <CheckCircle2 className="h-4 w-4" /> : wrong ? <XCircle className="h-4 w-4" /> : LETTERS[i]}
              </span>
              <span className="relative min-w-0 flex-1">{o}</span>
              {revealing && <span className="relative font-mono text-xs text-content-subtle">{share}%</span>}
              {sending === i && <Loader2 className="relative h-4 w-4 animate-spin text-gold-300" />}
            </button>
          );
        })}
      </div>
      <div className="mt-5 min-h-[2.5rem] text-sm">
        {revealing ? (
          <div className={cn("rounded-2xl border p-4", mine?.correct ? "border-mint-400/30 bg-mint-400/[0.05]" : "border-hairline bg-ink-900/40")}>
            <div className={cn("font-semibold", mine?.correct ? "text-mint-300" : mine ? "text-red-300" : "text-content-muted")}>
              {mine?.correct ? `Correct, +${mine.points ?? 0} points` : mine ? "Not this time" : canAnswer ? "No answer this round" : "Answer revealed"}
            </div>
            {q.explanation && <p className="mt-1.5 leading-relaxed text-content-muted">{q.explanation}</p>}
            <p className="mt-2 text-[11px] text-content-subtle">Next question in {Math.max(0, Math.ceil(((phase.kind === "reveal" ? phase.nextAt : now) - now) / 1000))}s</p>
          </div>
        ) : mine ? (
          <div className="flex items-center gap-2 text-content-muted">
            <Lock className="h-4 w-4 text-gold-300" /> Answer locked in. Results are revealed to everyone at once.
          </div>
        ) : !canAnswer ? (
          guest ? (
            <Link href="/login" className="inline-flex items-center gap-2 font-semibold text-gold-300">
              <LogIn className="h-4 w-4" /> Sign in to play along
            </Link>
          ) : (
            <button type="button" onClick={onJoin} disabled={joining} className="btn-primary h-10 px-5 text-sm">
              {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Join now (late entries score from the next question)
            </button>
          )
        ) : null}
      </div>
    </motion.div>
  );
}

function Final({ state, me }: { state: LiveState; me: LiveMe | null }) {
  const podium = state.leaderboard.slice(0, 3);
  return (
    <Panel className="text-center">
      <Crown className="mx-auto h-10 w-10 text-gold-300 drop-shadow-[0_0_18px_rgba(226,167,47,0.7)]" />
      <h2 className="mt-3 font-display text-3xl font-bold text-content">
        <span className="text-shine">We have our winners</span>
      </h2>
      {podium.length ? (
        <div className="mt-8 grid grid-cols-3 items-end gap-3">
          {[podium[1], podium[0], podium[2]].map((r, i) =>
            r ? (
              <motion.div
                key={r.userId}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.15 }}
                className={cn(`acad-podium-${r.rank} flex flex-col items-center rounded-3xl border px-2 pb-4`, r.rank === 1 ? "pt-8" : "pt-5")}
              >
                <Avatar src={r.image} alt={r.name} size={r.rank === 1 ? 64 : 48} />
                <div className="mt-2 w-full truncate text-sm font-semibold text-content">{r.name}</div>
                <div className="font-mono text-sm text-gold-200">{fmt(r.score)}</div>
                <div className="text-[10px] uppercase tracking-wide text-content-subtle">#{r.rank}</div>
              </motion.div>
            ) : (
              <div key={i} />
            )
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-content-muted">No one scored in this quiz.</p>
      )}
      {me?.joined && (
        <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-gold-400/30 bg-gold-400/[0.05] p-4">
          <div className="text-sm text-content-muted">
            You finished <span className="font-semibold text-content">{me.rank ? `#${me.rank}` : "unranked"}</span> with {fmt(me.score)} points ({me.correct} correct).
          </div>
          <div className="mt-1 text-[11px] text-content-subtle">XP from this quiz has been added to your profile.</div>
          {me.rank && me.rank <= 3 && me.score > 0 && (
            <Link href="/academy/certificates" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-300">
              <Award className="h-4 w-4" /> View your certificate
            </Link>
          )}
        </div>
      )}
      <Link href="/academy/live" className="btn-ghost mt-6 h-11 px-5 text-sm">
        More live quizzes
      </Link>
    </Panel>
  );
}
