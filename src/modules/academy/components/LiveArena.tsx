"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Award, BarChart3, CheckCircle2, ChevronDown, Crown, Flame, Gauge, ListChecks, Loader2, Lock, LogIn, Pause, Radio, Target, Timer, Trophy, TrendingDown, TrendingUp, Users, WifiOff, XCircle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRealtime } from "@/lib/useRealtime";
import { liveChannel } from "@/lib/realtime-channels";
import { livePhase, type LivePhase } from "@modules/academy/lib/engine";
import { lineFor, duck, play, say, sayOneOf, sfx, unlock, type Piece } from "../client/audio";
import { type VoiceLine } from "../client/voice-lines";
import { getJson, postJson, useAudio, useLang, useServerClock, useTicker, withRetry } from "../client/hooks";
import { COMMAND_EVENT, type Parsed } from "../client/commands";
import { optionOrder } from "../client/option-order";
import { clearTalkContext, setTalkContext } from "../client/talk";
import type { LiveMe, LiveResults, LiveState } from "./types";
import { Avatar, burstConfetti, CountUp, DIFF_LABEL, DIFF_TONE, Empty, fmt, Panel, Pill } from "./ui";

const vline = (k: VoiceLine): Piece => lineFor(k);
/**
 * Live requests must fail FAST. A question is open for 10-20 seconds; with the
 * general 15s timeout one hung request on a mobile network used up the whole
 * window, so the player saw the question only at the reveal, or not at all.
 * Retries (below) do the waiting instead, a few hundred ms apart.
 */
export const LIVE_TIMEOUT_MS = 4_000;
const LETTERS = ["A", "B", "C", "D"];
const phaseKey = (p: LivePhase | null | undefined) => (p ? `${p.kind}:${"index" in p ? p.index : ""}` : "");
const secs = (ms: number | null | undefined) => (ms == null ? "–" : `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`);

type Answer = LiveMe["answers"][number];

/** Current and best run of consecutive correct answers, in question order. Pure. */
export function streaks(answers: Pick<Answer, "index" | "correct">[]): { current: number; best: number } {
  const sorted = [...answers].filter((a) => a.correct != null).sort((a, b) => a.index - b.index);
  let current = 0;
  let best = 0;
  let prev = -2;
  for (const a of sorted) {
    if (a.correct && a.index === prev + 1) current += 1;
    else current = a.correct ? 1 : 0;
    best = Math.max(best, current);
    prev = a.index;
  }
  return { current, best };
}

export function LiveArena({ id }: { id: string }) {
  const [state, setState] = useState<LiveState | null>(null);
  const [me, setMe] = useState<LiveMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [joining, setJoining] = useState(false);
  const [sending, setSending] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [rankMove, setRankMove] = useState<{ id: number; by: number } | null>(null);
  const clock = useServerClock();
  const audio = useAudio();
  const lang = useLang();
  const lastKey = useRef("");
  const announced = useRef<Set<string>>(new Set());

  // Rank movement between two reads of my seat: "up 3" with a fanfare, or "down 1".
  const rankRef = useRef<number | null>(null);
  const rankTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadMe = useCallback(async () => {
    const sent = Date.now();
    try {
      const m = await getJson<LiveMe & { guest?: boolean }>(`/api/academy/live/${id}/me`, { timeoutMs: LIVE_TIMEOUT_MS });
      clock.sync(m.serverNow, sent);
      const before = rankRef.current;
      const after = m.joined ? m.rank : null;
      rankRef.current = after;
      if (before != null && after != null && before !== after) {
        setRankMove({ id: Date.now(), by: before - after });
        if (after < before) setTimeout(() => sfx("rankup"), 700);
        if (rankTimer.current) clearTimeout(rankTimer.current);
        rankTimer.current = setTimeout(() => setRankMove(null), 3200);
      }
      setMe(m);
      setOffline(false);
    } catch {
      setOffline(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadState = useCallback(async (tries = 1) => {
    try {
      const s = await withRetry(() => getJson<LiveState>(`/api/academy/live/${id}`, { timeoutMs: LIVE_TIMEOUT_MS }), tries);
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

  const loadAll = useCallback(async (tries = 1) => {
    await Promise.allSettled([loadMe(), loadState(tries)]);
  }, [loadMe, loadState]);

  useEffect(() => {
    // The first read retries a few times: without it there is nothing on
    // screen but a spinner until the next 15s poll.
    void loadAll(4);
    return () => duck(1);
  }, [loadAll]);

  // Back from a locked phone or another app: the room moved on meanwhile, so
  // re-read it at once instead of waiting for the next phase or poll.
  useEffect(() => {
    const on = () => {
      if (document.visibilityState === "visible") void loadAll(2);
    };
    document.addEventListener("visibilitychange", on);
    window.addEventListener("online", on);
    return () => {
      document.removeEventListener("visibilitychange", on);
      window.removeEventListener("online", on);
    };
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
    // ⚠️ Keep trying until the server's answer matches the phase we are in.
    // This gave up after 6 tries, and one try could hang for 15s, so on a weak
    // connection a whole question was missed (seen only at the reveal, or the
    // quiz jumped straight to the results). The phase itself bounds the loop:
    // when our clock moves on, this effect is cleaned up and the next starts.
    let alive = true;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const attempt = () => {
      if (!alive) return;
      tries++;
      loadState()
        .then((s) => {
          if (!alive) return;
          const local = livePhase(s.clock, clock.now());
          if (phaseKey(s.phase) !== phaseKey(local)) {
            if (tries < 60) timer = setTimeout(attempt, 450 + Math.random() * 450);
          } else if (local.kind === "reveal" || local.kind === "ended") void loadMe();
        })
        .catch(() => {
          if (alive && tries < 60) timer = setTimeout(attempt, Math.min(2000, 350 + tries * 250));
        });
    };
    timer = setTimeout(attempt, 150 + Math.random() * 600);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localKey]);

  // Sound + voice cues, once per phase.
  useEffect(() => {
    if (!phase) return;
    const key = phaseKey(phase);
    if (announced.current.has(key)) return;
    announced.current.add(key);
    if (phase.kind === "countdown") say("live_soon", { auto: true });
    if (phase.kind === "reveal") {
      sfx("reveal");
      sfx("stinger");
    }
    if (phase.kind === "ended" && state?.status === "ended") {
      sfx("winner");
      burstConfetti();
      // Two more bursts from the sides for the finale.
      setTimeout(() => burstConfetti({ x: window.innerWidth * 0.2, y: window.innerHeight * 0.45 }), 450);
      setTimeout(() => burstConfetti({ x: window.innerWidth * 0.8, y: window.innerHeight * 0.45 }), 800);
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
    sfx("impact");
    sfx("go");
    const q = state.question;
    const pieces = [];
    if (audio.settings.guide) {
      if (phase.index === 0) pieces.push(vline("live_go"));
      else if (phase.index === state.count - 1) pieces.push(vline("live_last"));
      else if (state.count >= 6 && phase.index === Math.floor(state.count / 2)) pieces.push(vline("live_half"));
      else pieces.push(vline("live_next"));
    }
    if (audio.settings.readQuestions) pieces.push({ url: lang.vx(q.voice.prompt, q.hi?.prompt), text: lang.tx(q.prompt, q.hi?.prompt) });
    if (pieces.length) play(pieces, { caption: lang.tx(q.prompt, q.hi?.prompt) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase?.kind, phase && "index" in phase ? phase.index : -1, state?.question?.index]);

  // The last seconds of a question: ticks, then a heartbeat, then a drumroll
  // into the reveal. Once per second, never while paused.
  const lastQTick = useRef("");
  useEffect(() => {
    if (phase?.kind !== "question" || phase.paused) return;
    const left = phase.closesAt - now;
    const rolled = lastQTick.current === `${phase.index}:roll`;
    if (left <= 1500 && left > 900 && !rolled) {
      lastQTick.current = `${phase.index}:roll`;
      sfx("drumroll");
      return;
    }
    const s = Math.ceil(left / 1000);
    const k = `${phase.index}:${s}`;
    if (rolled || lastQTick.current === k) return;
    if (s > 1 && s <= 5) {
      lastQTick.current = k;
      sfx(s <= 3 ? "heartbeat" : "tick");
    }
  }, [phase, now]);

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

  // Anti-cheat 1: this player's own option order for the open question.
  const phaseIndex = phase && "index" in phase ? phase.index : -1;
  const order = useMemo(() => optionOrder(id, me?.userId, phaseIndex), [id, me?.userId, phaseIndex]);

  // Anti-cheat 2: leaving the tab or window while a question is open and not
  // yet answered is reported once per question. Staff see the count; it never
  // touches the score, so a call or a notification costs nothing.
  const openUnanswered = phase?.kind === "question" && !!me?.joined && !me.answers.some((a) => a.index === phaseIndex);
  const blurSent = useRef(-1);
  useEffect(() => {
    if (!openUnanswered) return;
    const report = () => {
      if (blurSent.current === phaseIndex) return;
      blurSent.current = phaseIndex;
      void postJson(`/api/academy/live/${id}/me`, { action: "blur", index: phaseIndex }).catch(() => undefined);
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") report();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", report);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", report);
    };
  }, [openUnanswered, phaseIndex, id]);

  const answer = useCallback(
    async (index: number, choice: number) => {
      if (!me?.joined || sending != null || myAnswer(index)) return;
      unlock();
      sfx("select");
      setSending(choice);
      setMsg(null);
      try {
        await withRetry(() => postJson(`/api/academy/live/${id}/me`, { action: "answer", index, choice }, { timeoutMs: LIVE_TIMEOUT_MS + 1000 }));
        setMe((m) => (m ? { ...m, answers: [...m.answers, { index, choice, correct: null, points: null, ms: null }] } : m));
        sfx("lock");
        sayOneOf("live_lock", 2, { auto: true });
      } catch (e) {
        // "Already answered" means an earlier try of this same answer landed
        // and only its reply was lost: the answer IS locked in, so re-sync
        // quietly instead of telling the player something went wrong.
        const already = (e as { status?: number }).status === 409 && /already answered/i.test((e as Error).message);
        if (already) setMe((m) => (m && !m.answers.some((a) => a.index === index) ? { ...m, answers: [...m.answers, { index, choice, correct: null, points: null, ms: null }] } : m));
        else setMsg((e as Error).message);
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
      if (p.cmd === "answer" && p.option != null && phase?.kind === "question") void answer(phase.index, order[p.option] ?? p.option);
    };
    window.addEventListener(COMMAND_EVENT, on);
    return () => window.removeEventListener(COMMAND_EVENT, on);
  }, [answer, phase, order]);

  const { current: streak, best: bestStreak } = useMemo(() => streaks(me?.answers ?? []), [me?.answers]);

  // The reveal for my own answer: sound, "+points" fly-up, streak sparkle.
  const revealedFor = useRef(-1);
  useEffect(() => {
    if (phase?.kind !== "reveal" || revealedFor.current === phase.index) return;
    const a = me?.answers.find((x) => x.index === phase.index);
    if (a && a.correct != null) {
      revealedFor.current = phase.index;
      sfx(a.correct ? "correct" : "wrong");
      if (a.correct && a.points) setTimeout(() => sfx("coin"), 280);
      if (a.correct && streak >= 2) setTimeout(() => sfx(streak >= 3 ? "fire" : "streak"), 520);
      const q = state?.question;
      const pieces = audio.settings.guide ? [vline(Math.random() < 0.5 ? "live_reveal" : "live_reveal_2")] : [];
      const explain = a.correct ? audio.settings.explainRight : audio.settings.explainWrong;
      if (explain && q?.explanation) pieces.push({ url: lang.vx(q.voiceExplanation ?? null, q.hi?.explanation), text: lang.tx(q.explanation, q.hi?.explanation) });
      if (pieces.length) play(pieces, { caption: q?.explanation ? lang.tx(q.explanation, q.hi?.explanation) : undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, me]);

  const top = state?.leaderboard ?? [];
  const myRow = useMemo(() => top.find((r) => r.userId === me?.userId), [top, me]);
  const graded = me?.answers.filter((a) => a.correct != null).length ?? 0;
  const accuracy = graded ? Math.round(((me?.correct ?? 0) / graded) * 100) : null;

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

      <div className="mt-3 grid grid-cols-1 gap-5 sm:mt-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {phase.kind === "scheduled" || phase.kind === "countdown" ? (
            <WaitingRoom state={state} phase={phase} now={now} joined={!!me?.joined} guest={!!guest} joining={joining} onJoin={join} />
          ) : phase.kind === "cancelled" ? (
            <Empty>This live quiz was cancelled by the host.</Empty>
          ) : phase.kind === "ended" ? (
            <Final state={state} me={me} id={id} bestStreak={bestStreak} />
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
              order={order}
              onAnswer={(c) => answer(phase.index, c)}
              onJoin={join}
              joining={joining}
              streak={streak}
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
            <div className="relative overflow-hidden rounded-3xl border border-gold-400/30 bg-gold-400/[0.05] p-4">
              <div className="flex items-center justify-between text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-gold-300">
                <span>You</span>
                <AnimatePresence>
                  {rankMove && rankMove.by !== 0 && (
                    <motion.span
                      key={rankMove.id}
                      initial={{ opacity: 0, y: 8, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: "spring", stiffness: 420, damping: 22 }}
                      className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 normal-case tracking-normal", rankMove.by > 0 ? "bg-mint-400/15 text-mint-300" : "bg-red-400/15 text-red-300")}
                    >
                      {rankMove.by > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {rankMove.by > 0 ? `up ${rankMove.by}` : `down ${-rankMove.by}`}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <motion.span key={me.score} initial={{ scale: 1.25 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 16 }} className="font-display text-2xl font-bold text-content">
                  {fmt(me.score)}
                </motion.span>
                <span className="text-sm text-content-muted">{me.rank ? `#${me.rank}` : "unranked"}</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <Stat icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Correct" value={String(me.correct)} />
                <Stat icon={<Target className="h-3.5 w-3.5" />} label="Accuracy" value={accuracy == null ? "–" : `${accuracy}%`} />
                <Stat icon={<Flame className={cn("h-3.5 w-3.5", streak >= 3 && "text-orange-300")} />} label="Streak" value={streak ? `x${streak}` : "0"} hot={streak >= 3} />
              </div>
            </div>
          )}
          <Panel className="!p-4">
            <div className="mb-3 flex items-center justify-between text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-content-subtle">
              <span>Live leaderboard</span>
              {phase.kind === "question" && <span className="normal-case tracking-normal">updates on reveal</span>}
            </div>
            {top.length ? (
              <ol className="space-y-1">
                <AnimatePresence initial={false}>
                  {top.map((r) => (
                    <motion.li
                      key={r.userId}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 34 }}
                      className={cn("flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm", r.rank === 1 && "bg-gold-400/10", myRow?.userId === r.userId && "acad-me-row")}
                    >
                      <span className={cn("w-5 text-center font-mono text-xs font-bold", r.rank <= 3 ? "text-gold-300" : "text-content-subtle")}>{r.rank === 1 ? <Crown className="mx-auto h-3.5 w-3.5" /> : r.rank}</span>
                      <Avatar src={r.image} alt={r.name} size={24} />
                      <span className="min-w-0 flex-1 truncate text-content">{r.name}</span>
                      <span className="font-mono text-xs text-gold-200">{fmt(r.score)}</span>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ol>
            ) : (
              <p className="text-sm text-content-subtle">{phase?.kind === "ended" ? "Nobody scored in this quiz." : "Scores appear after the first reveal."}</p>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, hot }: { icon: React.ReactNode; label: string; value: string; hot?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-hairline bg-ink-900/40 px-1.5 py-1.5", hot && "border-orange-400/40 bg-orange-400/10")}>
      <div className="flex items-center justify-center gap-1 text-[0.625rem] text-content-subtle">
        {icon} {label}
      </div>
      <motion.div key={value} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={cn("font-mono text-sm font-bold text-content", hot && "text-orange-200")}>
        {value}
      </motion.div>
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
      {big && (
        <motion.div
          key={`ring-${Math.ceil(ms / 1000)}`}
          className="pointer-events-none absolute left-1/2 top-[5.5rem] h-40 w-40 -translate-x-1/2 rounded-full border-2 border-gold-300/50"
          initial={{ scale: 0.6, opacity: 0.8 }}
          animate={{ scale: 1.8, opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          aria-hidden
        />
      )}
      <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-gold-300">{big ? "Get ready" : "Starts in"}</div>
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

      <div className="mx-auto mt-5 grid max-w-md grid-cols-3 gap-2 text-left text-[0.6875rem] text-content-muted">
        <div className="rounded-xl border border-hairline bg-ink-900/40 p-2.5">
          <Zap className="mb-1 h-3.5 w-3.5 text-gold-300" /> Faster right answers score more
        </div>
        <div className="rounded-xl border border-hairline bg-ink-900/40 p-2.5">
          <Flame className="mb-1 h-3.5 w-3.5 text-orange-300" /> Keep a streak going
        </div>
        <div className="rounded-xl border border-hairline bg-ink-900/40 p-2.5">
          <Award className="mb-1 h-3.5 w-3.5 text-mint-300" /> Top 3 get a certificate
        </div>
      </div>

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
          <button type="button" onClick={onJoin} disabled={joining} className="acad-join-pulse btn-primary h-12 px-8 text-base">
            {joining ? <Loader2 className="h-5 w-5 animate-spin" /> : <Radio className="h-5 w-5" />} Join Quiz
          </button>
        )}
      </div>

      <div className="mt-8 border-t border-hairline pt-5">
        <div className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-content-subtle">Waiting room · {state.participants} joined</div>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {state.faces.map((f, i) => (
            <motion.span key={f.id} initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 500, damping: 18, delay: Math.min(i, 12) * 0.03 }} title={f.name}>
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

/** A circular countdown: the ring drains, and pulses red in the last 5 seconds. */
function TimerRing({ left, total, paused }: { left: number; total: number; paused: boolean }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const k = Math.max(0, Math.min(1, total ? left / total : 0));
  const hot = left < 5000 && !paused;
  return (
    <div className={cn("relative grid h-14 w-14 place-items-center", hot && "acad-timer-hot")}>
      <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-white/10" />
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - k)} className={cn("transition-[stroke-dashoffset] duration-200 ease-linear", hot ? "stroke-red-400" : "stroke-gold-300")} />
      </svg>
      <span className={cn("font-mono text-base font-bold tabular-nums", hot ? "text-red-300" : "text-content")} aria-label={paused ? "Paused" : `${Math.ceil(left / 1000)} seconds left`}>
        {paused ? <Pause className="h-4 w-4 text-gold-300" /> : Math.ceil(left / 1000)}
      </span>
    </div>
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
  order,
  onAnswer,
  onJoin,
  joining,
  streak,
}: {
  phase: Extract<LivePhase, { kind: "question" | "reveal" }>;
  q: NonNullable<LiveState["question"]>;
  now: number;
  count: number;
  questionSec: number;
  mine: Answer | null;
  sending: number | null;
  canAnswer: boolean;
  guest: boolean;
  order: number[];
  onAnswer: (choice: number) => void;
  onJoin: () => void;
  joining: boolean;
  streak: number;
}) {
  const lang = useLang();
  const revealing = phase.kind === "reveal" && q.answer != null;
  const left = phase.kind === "question" ? Math.max(0, phase.closesAt - now) : 0;
  const total = (q.distribution ?? [0, 0, 0, 0]).reduce((a, b) => a + b, 0);
  const locked = !!mine || sending != null;
  const stats = revealing ? q.stats : null;
  return (
    <motion.div
      key={phase.index}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      // Anti-cheat 3: the question cannot be selected or copied into a search
      // box or an AI chat while it is open.
      onCopy={(e) => phase.kind === "question" && e.preventDefault()}
      onContextMenu={(e) => phase.kind === "question" && e.preventDefault()}
      className={cn("surface relative overflow-hidden rounded-3xl p-4 sm:p-8", phase.kind === "question" && "select-none")}
    >
      {/* The first second of each question: a big "Q3 / 10" that lands and fades. */}
      {phase.kind === "question" && now - phase.opensAt < 1000 && (
        <div key={`qsplash-${phase.index}`} className="acad-qsplash pointer-events-none absolute inset-0 z-20 grid place-items-center" aria-hidden>
          <span className="font-display font-bold tracking-tight">
            Q{phase.index + 1}
            <span className="text-content-subtle"> / {count}</span>
          </span>
        </div>
      )}
      {/* Progress through the quiz, one segment per question. */}
      <div className="absolute inset-x-0 top-0 flex h-1 gap-0.5" aria-hidden>
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className={cn("h-full flex-1", i < phase.index ? "bg-gold-400/70" : i === phase.index ? "bg-gold-300" : "bg-white/5")} />
        ))}
      </div>
      <AnimatePresence>
        {revealing && mine?.correct && !!mine.points && (
          <motion.div
            key={`gain-${phase.index}`}
            className="pointer-events-none absolute right-8 top-24 z-10 font-display text-3xl font-bold text-mint-300 drop-shadow-[0_0_18px_rgba(52,227,161,0.6)]"
            initial={{ opacity: 0, y: 20, scale: 0.6 }}
            animate={{ opacity: [0, 1, 1, 0], y: [20, -10, -30, -60], scale: [0.6, 1.2, 1, 1] }}
            transition={{ duration: 1.6, times: [0, 0.2, 0.7, 1] }}
          >
            +{mine.points}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-content-subtle">
          Q{phase.index + 1}/{count}
        </span>
        <Pill tone={DIFF_TONE[q.difficulty]}>{DIFF_LABEL[q.difficulty]}</Pill>
        <span className="text-[0.6875rem] text-content-subtle">{q.category}</span>
        {streak >= 2 && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1 rounded-full bg-orange-400/15 px-2 py-0.5 text-[0.6875rem] font-semibold text-orange-200">
            <Flame className="h-3 w-3" /> x{streak}
          </motion.span>
        )}
        <span className="ml-auto">
          {phase.kind === "question" ? (
            <TimerRing left={left} total={questionSec * 1000} paused={!!phase.paused} />
          ) : (
            <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-flex h-14 items-center gap-1 text-sm font-semibold text-gold-300">
              <Zap className="h-4 w-4" /> Reveal
            </motion.span>
          )}
        </span>
      </div>
      <h2 className="acad-play-prompt mt-3 font-display font-semibold leading-snug text-content sm:mt-4">{lang.tx(q.prompt, q.hi?.prompt)}</h2>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:mt-6 sm:grid-cols-2 sm:gap-2.5">
        {/* Shown in this player's own order (`order[position]` = original index);
            everything below still speaks in original indexes, so the answer,
            the vote split and what is sent to the server are unchanged. */}
        {order.map((i, pos) => {
          const o = q.options[i];
          const right = revealing && q.answer === i;
          const picked = mine?.choice === i || sending === i;
          const wrong = revealing && picked && !right;
          const share = total ? Math.round(((q.distribution?.[i] ?? 0) / total) * 100) : 0;
          return (
            <motion.button
              key={i}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * pos, type: "spring", stiffness: 380, damping: 28 }}
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
              {revealing && <motion.span className={cn("absolute inset-y-0 left-0", right ? "bg-mint-400/[0.12]" : "bg-white/[0.05]")} initial={{ width: 0 }} animate={{ width: `${share}%` }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />}
              <span className={cn("relative grid h-8 w-8 shrink-0 place-items-center rounded-xl border font-mono text-xs font-bold", right ? "border-mint-400 bg-mint-400 text-ink-950" : wrong ? "border-red-400 bg-red-400 text-ink-950" : "border-hairline text-content-subtle")}>
                {right ? <CheckCircle2 className="h-4 w-4" /> : wrong ? <XCircle className="h-4 w-4" /> : LETTERS[pos]}
              </span>
              <span className="relative min-w-0 flex-1">{lang.tx(o, q.hi?.options?.[i])}</span>
              {revealing && <span className="relative font-mono text-xs text-content-subtle">{share}%</span>}
              {picked && !revealing && sending == null && <Lock className="relative h-3.5 w-3.5 text-gold-300" />}
              {sending === i && <Loader2 className="relative h-4 w-4 animate-spin text-gold-300" />}
            </motion.button>
          );
        })}
      </div>
      <div className="mt-5 min-h-[2.5rem] text-sm">
        {revealing ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className={cn("rounded-2xl border p-4", mine?.correct ? "border-mint-400/30 bg-mint-400/[0.05]" : "border-hairline bg-ink-900/40")}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className={cn("font-semibold", mine?.correct ? "text-mint-300" : mine ? "text-red-300" : "text-content-muted")}>
                {mine?.correct ? `Correct, +${mine.points ?? 0} points` : mine ? "Not this time" : canAnswer ? "No answer this round" : "Answer revealed"}
              </span>
              {mine?.ms != null && <span className="text-[0.6875rem] text-content-subtle">your time {secs(mine.ms)}</span>}
            </div>
            {stats && (
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-hairline bg-ink-950/30 p-2">
                  <div className="font-mono text-base font-bold text-content">{stats.correctPct}%</div>
                  <div className="text-[0.625rem] text-content-subtle">got it right</div>
                </div>
                <div className="rounded-xl border border-hairline bg-ink-950/30 p-2">
                  <div className="font-mono text-base font-bold text-content">{stats.answered}</div>
                  <div className="text-[0.625rem] text-content-subtle">answered</div>
                </div>
                <div className="rounded-xl border border-hairline bg-ink-950/30 p-2">
                  {stats.fastest ? (
                    <>
                      <div className="flex items-center justify-center gap-1">
                        <Avatar src={stats.fastest.image} alt={stats.fastest.name} size={16} />
                        <span className="font-mono text-base font-bold text-gold-200">{secs(stats.fastest.ms)}</span>
                      </div>
                      <div className="truncate text-[0.625rem] text-content-subtle">fastest: {stats.fastest.name}</div>
                    </>
                  ) : (
                    <>
                      <div className="font-mono text-base font-bold text-content">–</div>
                      <div className="text-[0.625rem] text-content-subtle">no correct answer</div>
                    </>
                  )}
                </div>
              </div>
            )}
            {q.explanation && <p className="mt-3 leading-relaxed text-content-muted">{lang.tx(q.explanation, q.hi?.explanation)}</p>}
            <p className="mt-2 text-[0.6875rem] text-content-subtle">Next question in {Math.max(0, Math.ceil(((phase.kind === "reveal" ? phase.nextAt : now) - now) / 1000))}s</p>
          </motion.div>
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
        ) : phase.kind === "question" ? (
          <p className="text-[0.6875rem] text-content-subtle">Fair play: options are shuffled for every player, and leaving this screen before you answer is recorded.</p>
        ) : null}
      </div>
    </motion.div>
  );
}

type Tab = "podium" | "answers" | "standings";

function Final({ state, me, id, bestStreak }: { state: LiveState; me: LiveMe | null; id: string; bestStreak: number }) {
  const podium = state.leaderboard.slice(0, 3);
  // Arriving from "Answers & results" in the list opens straight on the answers.
  // (This only renders after the quiz state has loaded on the client, so
  // reading the URL here cannot differ from a server render.)
  const [tab, setTab] = useState<Tab>(() => {
    try {
      return new URLSearchParams(window.location.search).get("view") === "results" ? "answers" : "podium";
    } catch {
      return "podium";
    }
  });
  const [results, setResults] = useState<LiveResults | null>(null);
  const [rErr, setRErr] = useState<string | null>(null);
  const loadResults = useCallback(async () => {
    try {
      setResults(await withRetry(() => getJson<LiveResults>(`/api/academy/live/${id}/results`), 3));
    } catch (e) {
      setRErr((e as Error).message);
    }
  }, [id]);
  // Opened straight on Answers (from the list): fetch once after mount.
  useEffect(() => {
    if (tab === "podium") return;
    const t = setTimeout(() => void loadResults(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const open = (t: Tab) => {
    setTab(t);
    sfx("click");
    if (t !== "podium" && !results) {
      setRErr(null);
      void loadResults();
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "podium", label: "Podium", icon: <Trophy className="h-4 w-4" /> },
    { id: "answers", label: "Answers", icon: <ListChecks className="h-4 w-4" /> },
    { id: "standings", label: "Standings", icon: <BarChart3 className="h-4 w-4" /> },
  ];
  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-2xl border border-hairline bg-ink-900/40 p-1" role="tablist" aria-label="Results">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => open(t.id)}
            className={cn("relative flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors duration-200", tab === t.id ? "bg-gold-300 text-ink-950" : "text-content-muted hover:text-content")}
          >
            <span className="relative flex items-center gap-1.5">
              {t.icon} {t.label}
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
          {tab === "podium" ? (
            <Panel className="text-center">
              <motion.div initial={{ rotate: -20, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 14 }}>
                <Crown className="mx-auto h-10 w-10 text-gold-300 drop-shadow-[0_0_18px_rgba(226,167,47,0.7)]" />
              </motion.div>
              <h2 className="mt-3 font-display text-3xl font-bold text-content">
                {/* No scorers, no winners: the old heading said "We have our
                    winners" right above "No one scored in this quiz." */}
                {podium.length ? <span className="text-shine">We have our winners</span> : "This quiz has ended"}
              </h2>
              {podium.length ? (
                // The finale: three pillars rise in order (3rd, 2nd, 1st), each
                // winner on top of theirs, a crown drops on #1 under a spotlight.
                <div className="acad-podium-stage relative mt-8 grid grid-cols-3 items-end gap-2 sm:gap-4">
                  <span className="acad-spotlight" aria-hidden />
                  {[podium[1], podium[0], podium[2]].map((r, i) => {
                    if (!r) return <div key={i} />;
                    const at = [0.55, 1.0, 0.15][i];
                    const tall = r.rank === 1 ? 150 : r.rank === 2 ? 108 : 78;
                    return (
                      <div key={r.userId} className="relative flex flex-col items-center">
                        <motion.div
                          initial={{ opacity: 0, y: 24, scale: 0.6 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ delay: at + 0.35, type: "spring", stiffness: 320, damping: 16 }}
                          className="relative flex w-full flex-col items-center px-1"
                        >
                          {r.rank === 1 && (
                            <motion.span
                              initial={{ y: -40, opacity: 0, rotate: -25 }}
                              animate={{ y: 0, opacity: 1, rotate: 0 }}
                              transition={{ delay: at + 0.75, type: "spring", stiffness: 260, damping: 12 }}
                              className="absolute -top-7 z-10"
                            >
                              <Crown className="h-7 w-7 text-gold-300 drop-shadow-[0_0_14px_rgba(226,167,47,0.9)]" />
                            </motion.span>
                          )}
                          <span className={`acad-medal-ring acad-medal-${r.rank}`}>
                            <Avatar src={r.image} alt={r.name} size={r.rank === 1 ? 68 : 52} />
                          </span>
                          <div className="mt-2 w-full truncate text-sm font-semibold text-content">{r.name}</div>
                          <div className="font-mono text-sm font-bold text-gold-200">
                            <CountUp value={r.score} duration={1400} />
                          </div>
                        </motion.div>
                        <motion.div
                          initial={{ scaleY: 0 }}
                          animate={{ scaleY: 1 }}
                          transition={{ delay: at, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                          style={{ height: tall, transformOrigin: "bottom" }}
                          className={cn(`acad-podium-${r.rank} acad-pillar mt-3 grid w-full place-items-center rounded-t-2xl border`)}
                        >
                          <span className="font-display text-4xl font-bold opacity-80 sm:text-5xl">{r.rank}</span>
                        </motion.div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-4 text-sm text-content-muted">Nobody scored in this one. The next live quiz is on the Live page.</p>
              )}
              {me?.joined && (
                <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-gold-400/30 bg-gold-400/[0.05] p-4">
                  <div className="text-sm text-content-muted">
                    You finished <span className="font-semibold text-content">{me.rank ? `#${me.rank}` : "unranked"}</span> with {fmt(me.score)} points ({me.correct} correct).
                  </div>
                  <div className="mt-1 text-[0.6875rem] text-content-subtle">XP from this quiz has been added to your profile.</div>
                  {me.rank && me.rank <= 3 && me.score > 0 && (
                    <Link href="/academy/certificates" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-300">
                      <Award className="h-4 w-4" /> View your certificate
                    </Link>
                  )}
                </div>
              )}
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => open("answers")} className="btn-primary h-11 px-5 text-sm">
                  <ListChecks className="h-4 w-4" /> See all answers
                </button>
                <Link href="/academy/live" className="btn-ghost h-11 px-5 text-sm">
                  More live quizzes
                </Link>
              </div>
            </Panel>
          ) : !results ? (
            rErr ? (
              <Empty>
                {rErr}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setRErr(null);
                    void loadResults();
                  }}
                  className="font-semibold text-gold-300"
                >
                  Try again
                </button>
              </Empty>
            ) : (
              <div className="grid min-h-[30vh] place-items-center">
                <Loader2 className="h-7 w-7 animate-spin text-gold-300" />
              </div>
            )
          ) : tab === "answers" ? (
            <AnswersReview results={results} me={me} bestStreak={bestStreak} />
          ) : (
            <Standings results={results} meId={me?.userId ?? null} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function ReportCard({ results, me, bestStreak }: { results: LiveResults; me: LiveMe; bestStreak: number }) {
  const timed = me.answers.filter((a) => a.choice >= 0 && a.ms != null);
  const avg = timed.length ? Math.round(timed.reduce((n, a) => n + (a.ms ?? 0), 0) / timed.length) : null;
  const acc = results.count ? Math.round((me.correct / results.count) * 100) : 0;
  const maxPts = Math.max(1, ...me.answers.map((a) => a.points ?? 0));
  const cards = [
    { icon: <Trophy className="h-4 w-4 text-gold-300" />, v: me.rank ? `#${me.rank}` : "–", l: "Final rank" },
    { icon: <Target className="h-4 w-4 text-mint-300" />, v: `${acc}%`, l: `${me.correct}/${results.count} right` },
    { icon: <Gauge className="h-4 w-4 text-sky-300" />, v: secs(avg), l: "Average speed" },
    { icon: <Flame className="h-4 w-4 text-orange-300" />, v: bestStreak ? `x${bestStreak}` : "0", l: "Best streak" },
  ];
  return (
    <Panel className="!p-5">
      <div className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-gold-300">Your report card</div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cards.map((c, i) => (
          <motion.div key={c.l} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 * i }} className="rounded-2xl border border-hairline bg-ink-900/40 p-3">
            {c.icon}
            <div className="mt-1 font-mono text-xl font-bold text-content">{c.v}</div>
            <div className="text-[0.6875rem] text-content-subtle">{c.l}</div>
          </motion.div>
        ))}
      </div>
      <div className="mt-4">
        <div className="mb-1.5 text-[0.6875rem] text-content-subtle">Points per question</div>
        <div className="flex h-16 items-end gap-1" role="img" aria-label="Points per question">
          {Array.from({ length: results.count }, (_, i) => {
            const a = me.answers.find((x) => x.index === i);
            const pts = a?.points ?? 0;
            return (
              <motion.div
                key={i}
                title={`Q${i + 1}: ${a ? (a.correct ? `+${pts}` : "wrong") : "no answer"}`}
                className={cn("flex-1 rounded-t-md", !a ? "bg-white/[0.06]" : a.correct ? "bg-mint-400/80" : "bg-red-400/60")}
                initial={{ height: 0 }}
                animate={{ height: `${a?.correct ? Math.max(12, (pts / maxPts) * 100) : 10}%` }}
                transition={{ delay: 0.15 + i * 0.04, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              />
            );
          })}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[0.625rem] text-content-subtle">
          <span>Q1</span>
          <span>Q{results.count}</span>
        </div>
      </div>
    </Panel>
  );
}

function AnswersReview({ results, me, bestStreak }: { results: LiveResults; me: LiveMe | null; bestStreak: number }) {
  const lang = useLang();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-3">
      {me?.joined && <ReportCard results={results} me={me} bestStreak={bestStreak} />}
      {results.questions.map((q, n) => {
        const a = me?.answers.find((x) => x.index === q.index) ?? null;
        const isOpen = open === q.index;
        const total = q.distribution.reduce((s, v) => s + v, 0);
        return (
          <motion.div key={q.index} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(n, 10) * 0.04 }} className="surface overflow-hidden rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setOpen(isOpen ? null : q.index);
                sfx("click");
              }}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-xl font-mono text-xs font-bold", !a ? "bg-white/[0.06] text-content-subtle" : a.correct ? "bg-mint-400 text-ink-950" : "bg-red-400 text-ink-950")}>
                {!a ? q.index + 1 : a.correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-sm font-semibold text-content">{lang.tx(q.prompt, q.hi?.prompt)}</span>
                <span className="mt-0.5 block text-[0.6875rem] text-content-subtle">
                  Q{q.index + 1} · {q.correctPct}% right · {q.answered} answered{a?.correct && a.points ? ` · you +${a.points}` : ""}
                </span>
              </span>
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-content-subtle transition-transform", isOpen && "rotate-180")} />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                  <div className="space-y-2 border-t border-hairline px-4 pb-4 pt-3">
                    <div className="flex flex-wrap items-center gap-2 text-[0.6875rem] text-content-subtle">
                      <Pill tone={DIFF_TONE[q.difficulty]}>{DIFF_LABEL[q.difficulty]}</Pill>
                      <span>{q.category}</span>
                      {q.avgMs != null && (
                        <span className="flex items-center gap-1">
                          <Timer className="h-3 w-3" /> avg {secs(q.avgMs)}
                        </span>
                      )}
                    </div>
                    {q.options.map((o, i) => {
                      const right = q.answer === i;
                      const mineHere = a?.choice === i;
                      const share = total ? Math.round((q.distribution[i] / total) * 100) : 0;
                      return (
                        <div key={i} className={cn("relative flex items-center gap-3 overflow-hidden rounded-xl border px-3 py-2.5 text-sm", right ? "border-mint-400/60" : mineHere ? "border-red-400/60" : "border-hairline")}>
                          <motion.span className={cn("absolute inset-y-0 left-0", right ? "bg-mint-400/[0.12]" : "bg-white/[0.04]")} initial={{ width: 0 }} animate={{ width: `${share}%` }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
                          <span className={cn("relative grid h-6 w-6 shrink-0 place-items-center rounded-lg font-mono text-[0.6875rem] font-bold", right ? "bg-mint-400 text-ink-950" : mineHere ? "bg-red-400 text-ink-950" : "border border-hairline text-content-subtle")}>
                            {right ? <CheckCircle2 className="h-3.5 w-3.5" /> : LETTERS[i]}
                          </span>
                          <span className="relative min-w-0 flex-1 text-content">{lang.tx(o, q.hi?.options?.[i])}</span>
                          {mineHere && <span className={cn("relative rounded-full px-2 py-0.5 text-[0.625rem] font-semibold", right ? "bg-mint-400/15 text-mint-300" : "bg-red-400/15 text-red-300")}>you</span>}
                          <span className="relative font-mono text-xs text-content-subtle">{share}%</span>
                        </div>
                      );
                    })}
                    {q.fastest && (
                      <div className="flex items-center gap-2 rounded-xl border border-gold-400/25 bg-gold-400/[0.05] px-3 py-2 text-[0.75rem] text-content-muted">
                        <Zap className="h-3.5 w-3.5 shrink-0 text-gold-300" />
                        <Avatar src={q.fastest.image} alt={q.fastest.name} size={18} />
                        <span className="min-w-0 truncate">
                          Fastest correct: <span className="font-semibold text-content">{q.fastest.name}</span> in {secs(q.fastest.ms)}
                        </span>
                      </div>
                    )}
                    {q.explanation && <p className="rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm leading-relaxed text-content-muted">{lang.tx(q.explanation, q.hi?.explanation)}</p>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

function Standings({ results, meId }: { results: LiveResults; meId: string | null }) {
  return (
    <Panel className="!p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-sm">
          <thead>
            <tr className="text-left text-[0.625rem] uppercase tracking-[0.14em] text-content-subtle">
              <th className="px-4 py-3 font-semibold">#</th>
              <th className="px-2 py-3 font-semibold">Player</th>
              <th className="px-2 py-3 text-right font-semibold">Score</th>
              <th className="px-2 py-3 text-right font-semibold">Right</th>
              <th className="px-4 py-3 text-right font-semibold">Avg time</th>
            </tr>
          </thead>
          <tbody>
            {results.standings.map((r, i) => (
              <motion.tr key={r.userId} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 15) * 0.03 }} className={cn("border-t border-hairline", r.userId === meId && "acad-me-row", r.rank === 1 && "bg-gold-400/[0.06]")}>
                <td className={cn("px-4 py-2.5 font-mono text-xs font-bold", r.rank <= 3 ? "text-gold-300" : "text-content-subtle")}>{r.rank === 1 ? <Crown className="h-4 w-4" /> : r.rank}</td>
                <td className="px-2 py-2.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar src={r.image} alt={r.name} size={24} />
                    <span className="truncate text-content">{r.name}</span>
                  </span>
                </td>
                <td className="px-2 py-2.5 text-right font-mono text-gold-200">{fmt(r.score)}</td>
                <td className="px-2 py-2.5 text-right font-mono text-content-muted">
                  {r.correct}/{results.count}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-content-muted">{secs(r.avgMs)}</td>
              </motion.tr>
            ))}
            {!results.standings.length && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-content-subtle">
                  No one played this quiz.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
