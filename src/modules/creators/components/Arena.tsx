"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarCheck, Check, Copy, Crown, Flame, Heart, Loader2, Medal, Music, Plus, RotateCcw, Share2, Swords, Target, Trophy, Users, Volume2, VolumeX, X as Close, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { mulberry32 } from "@shared/utils/rng";
import type { BoardRow, Profile } from "@modules/creators/lib/x-index";
import { rankYoutubeCreators, type YtCreator } from "@modules/creators/lib/scoring";
import { hapticError, hapticTap } from "@shared/utils/haptics";
import {
  DEFAULT_AUDIO,
  loadAudioSettings,
  playSfx,
  saveAudioSettings,
  setMusicTempo,
  startMusic,
  stopMusic,
  unlock,
  type ArenaSfx,
  type AudioSettings,
} from "@modules/creators/lib/arena-audio";

// Sound for every game, from one place. Games call sfx() on events and
// music() when a round starts; the settings decide whether anything is heard.
type ArenaAudio = { sfx: (k: ArenaSfx) => void; music: (fast?: boolean) => void };
const AudioCtx = createContext<ArenaAudio>({ sfx: () => {}, music: () => {} });
const useAudio = () => useContext(AudioCtx);
import { compact, full, pct } from "@modules/creators/lib/game";
import { validHandle } from "@modules/creators/lib/twitterapi";
import { Avatar, Chip, CountUp, Empty, Panel, PanelTitle, useLocalList } from "./ui";

// The Arena: games and tools built on the real leaderboard numbers.
//  - Higher or Lower: X or YouTube, six metrics each, three lives, combo XP.
//  - Daily Challenge: the same ten match-ups for everyone each UTC day.
//  - Rank Quiz: guess where a creator ranks.
//  - Head to Head: any two creators, up to twelve stats and a radar.
//  - Squad Builder: draft three creators on a budget, watch their live totals.
// Any X handle can be added by hand; it is looked up through the same profile
// route as the board, so the numbers are the real ones.
// Randomness is only ever drawn in click handlers or effects, never during
// render, so the server and the first client render always agree.

export type ArenaEntry = {
  id: string;
  name: string;
  sub: string;
  avatar: string | null;
  rank: number;
  points: number;
  views: number;
  posts: number;
  followers: number;
  likes: number;
  replies: number; // replies (X) or comments (YouTube)
  reposts: number | null; // X only
  score: number | null; // XYZ Score (X) or Creator Score (YouTube)
  engagement: number | null;
  avgViews: number;
  perPost: number;
  activeWeeks: number | null; // X only
  avgDuration: number | null; // YouTube only, seconds
  source: "x" | "yt";
  custom?: boolean;
};

const rate = (num: number, views: number) => (views > 0 ? num / views : null);

export function fromBoard(rows: BoardRow[]): ArenaEntry[] {
  return rows.map((r) => ({
    id: `x:${r.handle.toLowerCase()}`,
    name: `@${r.handle}`,
    sub: r.name,
    avatar: r.avatar,
    rank: r.rank,
    points: r.points,
    views: r.views,
    posts: r.posts,
    followers: r.followers,
    likes: r.likes,
    replies: r.replies,
    reposts: r.reposts,
    score: r.score,
    engagement: rate(r.likes + r.replies + r.reposts + r.quotes + r.bookmarks, r.views),
    avgViews: r.posts ? r.views / r.posts : 0,
    perPost: r.posts ? r.points / r.posts : 0,
    activeWeeks: r.activeWeeks,
    avgDuration: null,
    source: "x",
  }));
}

export function fromProfile(p: Profile): ArenaEntry {
  const t = p.totals;
  return {
    id: `x:${p.handle.toLowerCase()}`,
    name: `@${p.handle}`,
    sub: p.name,
    avatar: p.avatar,
    rank: p.rank ?? 0,
    points: t.points,
    views: t.views,
    posts: t.posts,
    followers: p.followers,
    likes: t.likes,
    replies: t.replies,
    reposts: t.reposts,
    score: p.score.total,
    engagement: t.views > 0 ? t.engagementRate : null,
    avgViews: t.avgViews,
    perPost: t.posts ? t.points / t.posts : 0,
    activeWeeks: p.activeWeeks,
    avgDuration: null,
    source: "x",
    custom: true,
  };
}

export function fromYoutube(list: YtCreator[]): ArenaEntry[] {
  return list.map((c, i) => ({
    id: `yt:${c.channelId}`,
    name: c.channelTitle,
    sub: `${c.videos} video${c.videos === 1 ? "" : "s"}`,
    avatar: c.channelAvatar,
    rank: i + 1,
    points: c.points,
    views: c.views,
    posts: c.videos,
    followers: c.channelSubs ?? 0,
    likes: c.likes,
    replies: c.comments,
    reposts: null,
    score: c.score.total,
    engagement: rate(c.likes + c.comments, c.views),
    avgViews: c.videos ? c.views / c.videos : 0,
    perPost: c.videos ? c.points / c.videos : 0,
    activeWeeks: null,
    avgDuration: c.videos ? c.durationSec / c.videos : null,
    source: "yt",
  }));
}

// ------------------------------------------------------------------ metrics

type MetricKey = "points" | "score" | "views" | "likes" | "replies" | "reposts" | "posts" | "followers" | "engagement" | "avgViews" | "perPost" | "activeWeeks" | "avgDuration";
type MetricDef = { key: MetricKey; label: string; fmt: (n: number) => string; log?: boolean };

const minutes = (s: number) => `${Math.round(s / 60)}m`;

const X_METRICS: MetricDef[] = [
  { key: "points", label: "Points", fmt: full, log: true },
  { key: "score", label: "XYZ Score", fmt: (n) => String(Math.round(n)) },
  { key: "views", label: "Views", fmt: compact, log: true },
  { key: "likes", label: "Likes", fmt: compact, log: true },
  { key: "replies", label: "Replies", fmt: compact, log: true },
  { key: "reposts", label: "Reposts", fmt: compact, log: true },
  { key: "posts", label: "Posts", fmt: full, log: true },
  { key: "followers", label: "Followers", fmt: compact, log: true },
  { key: "engagement", label: "Engagement", fmt: (n) => pct(n, 2) },
  { key: "avgViews", label: "Views / post", fmt: compact, log: true },
  { key: "perPost", label: "Points / post", fmt: compact, log: true },
  { key: "activeWeeks", label: "Active weeks", fmt: (n) => `${n}/12` },
];

const YT_METRICS: MetricDef[] = [
  { key: "points", label: "Points", fmt: compact, log: true },
  { key: "score", label: "Creator Score", fmt: (n) => String(Math.round(n)) },
  { key: "views", label: "Views", fmt: compact, log: true },
  { key: "likes", label: "Likes", fmt: compact, log: true },
  { key: "replies", label: "Comments", fmt: compact, log: true },
  { key: "posts", label: "Videos", fmt: full, log: true },
  { key: "followers", label: "Subscribers", fmt: compact, log: true },
  { key: "engagement", label: "Engagement", fmt: (n) => pct(n, 2) },
  { key: "avgViews", label: "Views / video", fmt: compact, log: true },
  { key: "avgDuration", label: "Avg length", fmt: minutes },
];

const val = (e: ArenaEntry, k: MetricKey) => Number(e[k] ?? 0);

// The game metrics: the ones a player can reason about.
const GAME_X: MetricKey[] = ["points", "views", "likes", "score", "followers", "avgViews"];
const GAME_YT: MetricKey[] = ["points", "views", "likes", "posts", "followers", "score"];
const defOf = (src: "x" | "yt", k: MetricKey) => (src === "x" ? X_METRICS : YT_METRICS).find((m) => m.key === k)!;

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function pickPair(pool: ArenaEntry[], m: MetricKey, rnd: () => number, keep?: ArenaEntry): [ArenaEntry, ArenaEntry] {
  const a = keep ?? pool[Math.floor(rnd() * pool.length)]!;
  let b = a;
  // Avoid ties (no right answer) and the same entry twice.
  for (let i = 0; i < 60 && (b.id === a.id || val(b, m) === val(a, m)); i++) b = pool[Math.floor(rnd() * pool.length)]!;
  return [a, b];
}

function Duel({ pair, metric, picked, onPick }: { pair: [ArenaEntry, ArenaEntry]; metric: MetricDef; picked: string | null; onPick: (id: string) => void }) {
  const top = Math.max(val(pair[0], metric.key), val(pair[1], metric.key));
  return (
    <div className="relative grid grid-cols-2 gap-3 sm:gap-5">
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-hairline bg-ink-900 text-xs font-black text-gold-300 shadow-lg">
        VS
      </div>
      <AnimatePresence mode="popLayout">
        {pair.map((e) => {
          const win = picked != null && val(e, metric.key) === top;
          const lose = picked != null && !win;
          return (
            <motion.button
              key={e.id}
              type="button"
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: win ? 1.02 : 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              whileHover={picked ? undefined : { y: -4 }}
              whileTap={picked ? undefined : { scale: 0.97 }}
              onClick={() => onPick(e.id)}
              disabled={picked != null}
              className={cn(
                "flex min-w-0 flex-col items-center rounded-3xl border p-4 text-center transition-colors sm:p-6",
                win ? "border-mint-400/70 bg-mint-400/10" : lose ? "border-red-400/40 bg-red-400/5" : "border-hairline bg-ink-900/40 hover:border-gold-400/40"
              )}
            >
              <Avatar src={e.avatar} alt={e.name} size={64} />
              <div className="mt-3 w-full truncate text-sm font-semibold text-content">{e.name}</div>
              <div className="w-full truncate text-xs text-content-subtle">{e.sub}</div>
              <div className="mt-3 h-8 font-display text-2xl font-bold tabular-nums text-gold-300">
                {picked ? <CountUp value={val(e, metric.key)} format={metric.fmt} duration={700} /> : "?"}
              </div>
              <div className="text-[0.625rem] uppercase tracking-wider text-content-subtle">{metric.label}</div>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ------------------------------------------------------------------ Higher or Lower

function HigherLower({ xPool, ytPool }: { xPool: ArenaEntry[]; ytPool: ArenaEntry[] }) {
  const audio = useAudio();
  // Follow whichever board has data until the player picks one: deciding once
  // at first render locked the game onto YouTube before the X board loaded.
  const [sourcePick, setSource] = useState<"x" | "yt" | null>(null);
  const source: "x" | "yt" = sourcePick ?? (xPool.length >= 2 || ytPool.length < 2 ? "x" : "yt");
  const [metricKey, setMetricKey] = useState<MetricKey>("points");
  const [pair, setPair] = useState<[ArenaEntry, ArenaEntry] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [xp, setXp] = useState(0);
  const [over, setOver] = useState(false);
  const [bests, saveBests] = useLocalList("xyz:creators:hilo-bests", 40);
  const [shared, setShared] = useState(false);
  const [rush, setRush] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [correct, setCorrect] = useState(0);
  const [burst, setBurst] = useState(0);

  // Rush: a 60-second clock, no lives - as many right as you can.
  const running = rush && pair != null && !over;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setOver(true);
          audio.sfx("over");
          return 0;
        }
        if (t <= 11) audio.sfx("tick");
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, audio]);

  const pool = source === "x" ? xPool : ytPool;
  const metric = defOf(source, metricKey);
  const key = `${rush ? "rush" : "classic"}:${source}:${metricKey}`;
  const best = Number(bests.find((b) => b.startsWith(`${key}=`))?.split("=")[1] ?? 0);
  const metrics = source === "x" ? GAME_X : GAME_YT;
  const combo = Math.min(5, 1 + Math.floor(streak / 3));

  const reset = () => {
    setPair(null);
    setPicked(null);
    setStreak(0);
    setLives(3);
    setXp(0);
    setOver(false);
    setTimeLeft(60);
    setCorrect(0);
  };

  const start = () => {
    reset();
    audio.music(rush);
    audio.sfx("start");
    setPair(pickPair(pool, metricKey, Math.random));
  };

  const choose = (id: string) => {
    if (!pair || picked) return;
    setPicked(id);
    const winner = val(pair[0], metricKey) > val(pair[1], metricKey) ? pair[0] : pair[1];
    const right = id === winner.id;
    if (right) {
      hapticTap();
      setBurst((b) => b + 1);
      audio.sfx((streak + 1) % 5 === 0 ? "combo" : "correct");
    } else {
      hapticError();
      audio.sfx("wrong");
    }
    setTimeout(() => {
      if (right) {
        const next = streak + 1;
        const total = correct + 1;
        setStreak(next);
        setCorrect(total);
        setXp((x) => x + 10 * combo);
        // Classic keeps your best streak; Rush keeps your best total in 60s.
        const score = rush ? total : next;
        if (score > best) saveBests([`${key}=${score}`, ...bests.filter((b) => !b.startsWith(`${key}=`))]);
        setPair(pickPair(pool, metricKey, Math.random, winner));
        setPicked(null);
      } else if (rush) {
        setStreak(0);
        setPair(pickPair(pool, metricKey, Math.random));
        setPicked(null);
      } else if (lives > 1) {
        setLives((l) => l - 1);
        setStreak(0);
        setPair(pickPair(pool, metricKey, Math.random));
        setPicked(null);
      } else {
        setLives(0);
        setOver(true);
        audio.sfx("over");
      }
    }, rush ? 650 : 1300);
  };

  if (xPool.length < 2 && ytPool.length < 2) return <Empty>The game unlocks once at least two creators are on a board.</Empty>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <Chip active={source === "x"} onClick={() => (setSource("x"), setMetricKey("points"), reset())}>
          X · Variational
        </Chip>
        <Chip active={source === "yt"} onClick={() => (setSource("yt"), setMetricKey("points"), reset())}>
          YouTube
        </Chip>
        <span className="mx-1 hidden h-4 w-px bg-hairline sm:block" />
        <Chip active={!rush} onClick={() => (setRush(false), reset())}>
          Classic
        </Chip>
        <Chip active={rush} onClick={() => (setRush(true), reset())} title="60 seconds, no lives">
          60s Rush
        </Chip>
      </div>
      <div className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {metrics.map((m) => (
          <Chip key={m} active={metricKey === m} onClick={() => (setMetricKey(m), reset())}>
            {defOf(source, m).label}
          </Chip>
        ))}
      </div>

      {pool.length < 2 ? (
        <Empty>Not enough creators on this board yet.</Empty>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-1 font-bold text-orange-300">
                <Flame className="h-3.5 w-3.5" /> {streak}
                {combo > 1 && <span className="ml-0.5 text-orange-200">×{combo}</span>}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-gold-400/15 px-2.5 py-1 font-bold text-gold-200">
                <Crown className="h-3.5 w-3.5" /> Best {best}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-mint-400/15 px-2.5 py-1 font-bold text-mint-300">
                <Zap className="h-3.5 w-3.5" /> {full(xp)} XP
              </span>
            </div>
            {rush ? (
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs tabular-nums text-content-muted">{correct} right</span>
                <span className={cn("rounded-full px-2.5 py-1 font-mono text-xs font-bold tabular-nums", timeLeft <= 10 ? "bg-red-400/15 text-red-300" : "bg-ink-700 text-content")}>
                  0:{String(timeLeft).padStart(2, "0")}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1" aria-label={`${lives} lives left`}>
                {[0, 1, 2].map((i) => (
                  <motion.span key={i} animate={{ scale: i < lives ? 1 : 0.8, opacity: i < lives ? 1 : 0.25 }}>
                    <Heart className={cn("h-4 w-4", i < lives ? "fill-red-400 text-red-400" : "text-content-subtle")} />
                  </motion.span>
                ))}
              </div>
            )}
          </div>

          {!pair ? (
            <div className="py-8 text-center">
              <p className="mx-auto max-w-md text-sm leading-relaxed text-content-muted">
                {rush
                  ? `Sixty seconds. Who has more ${metric.label.toLowerCase()}? Get as many right as you can.`
                  : `Two creators. Who has more ${metric.label.toLowerCase()}? Three lives, and every three in a row raises your combo.`}
              </p>
              <button type="button" onClick={start} className="btn-primary mt-5 inline-flex items-center gap-2">
                <Zap className="h-4 w-4" /> Play
              </button>
            </div>
          ) : over ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-6 text-center">
              <Trophy className="mx-auto h-10 w-10 text-gold-300" />
              <div className="mt-3 font-display text-3xl font-bold text-content">{rush ? `${correct} right` : `${full(xp)} XP`}</div>
              <p className="mt-1 text-sm text-content-muted">
                {rush ? `Best in 60 seconds: ${best}` : `Best streak in this mode: ${best}`}
                {(rush ? correct : streak) >= best && best > 0 ? " · new best!" : ""}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={start} className="btn-primary inline-flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" /> Play again
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await copy(
                      `I scored ${xp} XP (best streak ${best}) in Higher or Lower on XYZ Crypto's Creator Arena (${source === "x" ? "X · Variational" : "YouTube"}, ${metric.label}). Beat me: xyzcrypto.io/creators?tab=arena`
                    );
                    setShared(ok);
                    setTimeout(() => setShared(false), 1600);
                  }}
                  className="btn-ghost inline-flex items-center gap-2"
                >
                  {shared ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />} {shared ? "Copied" : "Share"}
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="relative">
              <Duel pair={pair} metric={metric} picked={picked} onPick={choose} />
              <Burst key={burst} on={burst > 0} big={streak > 0 && (streak + 1) % 5 === 0} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** A short celebratory burst over the duel. Pure decoration, pointer-transparent. */
function Burst({ on, big }: { on: boolean; big: boolean }) {
  if (!on) return null;
  const n = big ? 22 : 12;
  const colors = ["#ebbd52", "#22d692", "#f3d488", "#54e8ad"];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center overflow-visible">
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        const r = big ? 150 : 90;
        return (
          <motion.span
            key={i}
            className="absolute h-2 w-2 rounded-full"
            style={{ background: colors[i % colors.length] }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(a) * r, y: Math.sin(a) * r, opacity: 0, scale: 0.4 }}
            transition={{ duration: big ? 0.9 : 0.6, ease: "easeOut" }}
          />
        );
      })}
      {big && (
        <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1.15, opacity: [0, 1, 0] }} transition={{ duration: 1 }} className="absolute font-display text-2xl font-black text-gold-200">
          On fire!
        </motion.span>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Daily Challenge

const DAILY_ROUNDS = 10;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function Daily({ pool, source }: { pool: ArenaEntry[]; source: "x" | "yt" }) {
  const audio = useAudio();
  const [day, setDay] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [history, saveHistory] = useLocalList("xyz:creators:daily", 60);
  const [copied, setCopied] = useState(false);

  // The UTC day is read after mount so the static HTML never depends on it.
  useEffect(() => {
    const t = setTimeout(() => setDay(new Date().toISOString().slice(0, 10)), 0);
    return () => clearTimeout(t);
  }, []);

  // Same ten match-ups for every visitor today: the pool is sorted by id
  // before the seeded draw, so order on the page does not matter.
  const pairs = useMemo(() => {
    if (!day || pool.length < 2) return [] as [ArenaEntry, ArenaEntry][];
    const sorted = [...pool].sort((a, b) => a.id.localeCompare(b.id));
    const rnd = mulberry32(hash(`${day}:${sorted.length}`));
    return Array.from({ length: DAILY_ROUNDS }, () => pickPair(sorted, "points", rnd));
  }, [day, pool]);

  const done = day ? (history.find((h) => h.startsWith(`${day}=`))?.split("=")[1] ?? null) : null;

  if (pool.length < 2) return <Empty>The Daily Challenge unlocks once at least two creators are on the board.</Empty>;
  if (!day || !pairs.length) return null;

  const grid = (r: string) =>
    r
      .split("")
      .map((c) => (c === "1" ? "🟩" : "🟥"))
      .join("");

  if (done) {
    const score = done.split("").filter((c) => c === "1").length;
    return (
      <div className="py-4 text-center">
        <CalendarCheck className="mx-auto h-9 w-9 text-mint-300" />
        <div className="mt-2 font-display text-3xl font-bold text-content">
          {score}/{DAILY_ROUNDS}
        </div>
        <div className="mt-2 text-xl tracking-widest">{grid(done)}</div>
        <p className="mt-2 text-xs text-content-subtle">Today&apos;s challenge is done. A new one starts at 00:00 UTC.</p>
        <button
          type="button"
          onClick={async () => {
            const ok = await copy(`XYZ Creator Arena · Daily ${day}\n${score}/${DAILY_ROUNDS} ${grid(done)}\nxyzcrypto.io/creators?tab=arena`);
            setCopied(ok);
            setTimeout(() => setCopied(false), 1600);
          }}
          className="btn-ghost mt-4 inline-flex items-center gap-2"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy result"}
        </button>
        {history.length > 1 && (
          <p className="mt-3 text-[0.6875rem] text-content-subtle">
            Played {history.length} days · average {(history.reduce((s, h) => s + (h.split("=")[1] ?? "").split("").filter((c) => c === "1").length, 0) / history.length).toFixed(1)}/10
          </p>
        )}
      </div>
    );
  }

  const pair = pairs[round]!;
  const choose = (id: string) => {
    if (picked) return;
    setPicked(id);
    const right = id === (pair[0].points > pair[1].points ? pair[0] : pair[1]).id;
    if (round === 0) audio.music();
    audio.sfx(right ? "correct" : "wrong");
    setTimeout(() => {
      const next = [...results, right];
      setResults(next);
      setPicked(null);
      if (next.length >= DAILY_ROUNDS) {
        saveHistory([`${day}=${next.map((x) => (x ? "1" : "0")).join("")}`, ...history.filter((h) => !h.startsWith(`${day}=`))]);
      } else {
        setRound((r) => r + 1);
      }
    }, 1200);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between text-xs">
        <span className="text-content-muted">
          {source === "x" ? "X · Variational" : "YouTube"} · {day} · who has more points?
        </span>
        <span className="font-bold tabular-nums text-gold-200">
          {round + 1}/{DAILY_ROUNDS}
        </span>
      </div>
      <div className="mb-4 flex gap-1">
        {Array.from({ length: DAILY_ROUNDS }, (_, i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < results.length ? (results[i] ? "bg-mint-400" : "bg-red-400") : i === round ? "bg-gold-400" : "bg-ink-700")} />
        ))}
      </div>
      <Duel pair={pair} metric={defOf(source, "points")} picked={picked} onPick={choose} />
    </div>
  );
}

// ------------------------------------------------------------------ Rank Quiz

const QUIZ_ROUNDS = 5;

// Module-level so the randomness is plainly event-time, never render-time.
function randomItem<T>(list: T[]): T | undefined {
  return list[Math.floor(Math.random() * list.length)];
}
function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function brackets(n: number): { label: string; lo: number; hi: number }[] {
  if (n >= 60) return [{ label: "Top 3", lo: 1, hi: 3 }, { label: "4 to 10", lo: 4, hi: 10 }, { label: "11 to 50", lo: 11, hi: 50 }, { label: "51+", lo: 51, hi: Infinity }];
  const q = Math.max(1, Math.ceil(n / 4));
  return [0, 1, 2, 3].map((i) => ({ label: i === 3 ? `${3 * q + 1}+` : `${i * q + 1} to ${(i + 1) * q}`, lo: i * q + 1, hi: i === 3 ? Infinity : (i + 1) * q }));
}

function RankQuiz({ pool }: { pool: ArenaEntry[] }) {
  const audio = useAudio();
  const [q, setQ] = useState<ArenaEntry[] | null>(null);
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const ranked = pool.filter((p) => p.rank > 0);
  const bs = brackets(ranked.length);

  if (ranked.length < 8) return <Empty>The Rank Quiz unlocks once at least eight creators are ranked.</Empty>;

  const start = () => {
    const picks: ArenaEntry[] = [];
    const used = new Set<string>();
    // One from each bracket where possible, so the answer isn't always "51+".
    for (let k = 0; k < QUIZ_ROUNDS; k++) {
      const b = bs[k % bs.length]!;
      const inB = ranked.filter((p) => p.rank >= b.lo && p.rank <= b.hi && !used.has(p.id));
      const from = inB.length ? inB : ranked.filter((p) => !used.has(p.id));
      const pick = randomItem(from);
      if (pick) {
        picks.push(pick);
        used.add(pick.id);
      }
    }
    setQ(shuffle(picks));
    audio.music();
    audio.sfx("start");
    setI(0);
    setScore(0);
    setAnswer(null);
  };

  if (!q) {
    return (
      <div className="py-8 text-center">
        <p className="mx-auto max-w-md text-sm text-content-muted">Five creators. Where does each one rank? Read the stats, then make the call.</p>
        <button type="button" onClick={start} className="btn-primary mt-5 inline-flex items-center gap-2">
          <Target className="h-4 w-4" /> Start quiz
        </button>
      </div>
    );
  }

  if (i >= q.length) {
    return (
      <div className="py-6 text-center">
        <Medal className="mx-auto h-10 w-10 text-gold-300" />
        <div className="mt-3 font-display text-3xl font-bold text-content">
          {score}/{q.length}
        </div>
        <p className="mt-1 text-sm text-content-muted">{score === q.length ? "A perfect read of the board." : score >= 3 ? "You know this scene." : "The board has surprises."}</p>
        <button type="button" onClick={start} className="btn-primary mt-5 inline-flex items-center gap-2">
          <RotateCcw className="h-4 w-4" /> Again
        </button>
      </div>
    );
  }

  const e = q[i]!;
  const correct = bs.findIndex((b) => e.rank >= b.lo && e.rank <= b.hi);
  return (
    <div>
      <div className="mb-4 flex justify-between text-xs text-content-subtle">
        <span>
          Question {i + 1}/{q.length}
        </span>
        <span className="font-bold text-gold-200">Score {score}</span>
      </div>
      <motion.div key={e.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 rounded-2xl border border-hairline bg-ink-900/40 p-4">
        <Avatar src={e.avatar} alt={e.name} size={56} />
        <div className="min-w-0">
          <div className="truncate font-semibold text-content">{e.name}</div>
          <div className="mt-1 text-xs leading-relaxed text-content-subtle">
            {full(e.posts)} posts · {compact(e.views)} views · {compact(e.likes)} likes · {compact(e.followers)} followers
            {e.engagement != null ? ` · ${pct(e.engagement)} eng` : ""}
          </div>
        </div>
      </motion.div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {bs.map((b, k) => (
          <button
            key={b.label}
            type="button"
            disabled={answer != null}
            onClick={() => {
              setAnswer(k);
              if (k === correct) setScore((s) => s + 1);
              audio.sfx(k === correct ? "correct" : "wrong");
              setTimeout(() => {
                setAnswer(null);
                setI((x) => x + 1);
              }, 1300);
            }}
            className={cn(
              "rounded-xl border px-3 py-3 text-sm font-semibold transition-colors",
              answer == null
                ? "border-hairline text-content hover:border-gold-400/40"
                : k === correct
                  ? "border-mint-400/70 bg-mint-400/10 text-mint-200"
                  : k === answer
                    ? "border-red-400/50 bg-red-400/10 text-red-200"
                    : "border-hairline text-content-subtle"
            )}
          >
            Rank {b.label}
          </button>
        ))}
      </div>
      {answer != null && <p className="mt-3 text-center text-xs text-content-muted">Actual rank: #{e.rank}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ Head to Head

function Radar({ a, b, pool, metrics }: { a: ArenaEntry; b: ArenaEntry; pool: ArenaEntry[]; metrics: MetricDef[] }) {
  const size = 240;
  const c = size / 2;
  const R = c - 34;
  const norm = (e: ArenaEntry, k: MetricDef) => {
    const max = Math.max(1e-9, ...pool.map((p) => val(p, k.key)), val(a, k.key), val(b, k.key));
    const v = val(e, k.key);
    return k.log ? Math.log10(v + 1) / Math.log10(max + 1) : v / max;
  };
  const pt = (i: number, r: number) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / metrics.length;
    return [c + Math.cos(ang) * r, c + Math.sin(ang) * r] as const;
  };
  const poly = (e: ArenaEntry) => metrics.map((k, i) => pt(i, R * Math.max(0.04, Math.min(1, norm(e, k)))).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto h-60 w-60 max-w-full" role="img" aria-label="Radar comparison">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={metrics.map((_, i) => pt(i, R * f).join(",")).join(" ")} fill="none" stroke="currentColor" className="text-ink-600" strokeWidth={1} />
      ))}
      {metrics.map((k, i) => {
        const [x, y] = pt(i, R + 16);
        return (
          <text key={k.key} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-current text-content-subtle" fontSize={8.5}>
            {k.label}
          </text>
        );
      })}
      <motion.polygon initial={{ opacity: 0 }} animate={{ opacity: 1 }} points={poly(a)} fill="rgba(226,167,47,0.25)" stroke="#e2a72f" strokeWidth={2} />
      <motion.polygon initial={{ opacity: 0 }} animate={{ opacity: 1 }} points={poly(b)} fill="rgba(34,214,146,0.2)" stroke="#22d692" strokeWidth={2} />
    </svg>
  );
}

/**
 * Searchable creator picker. Types filter the pool by name; on the X side, a
 * handle that is not in the pool can be looked up on X and added on the spot.
 */
function CreatorPicker({
  pool,
  value,
  onChange,
  tone,
  onLookup,
}: {
  pool: ArenaEntry[];
  value: ArenaEntry | undefined;
  onChange: (id: string) => void;
  tone: "gold" | "mint";
  onLookup?: (handle: string) => Promise<string | null>;
}) {
  const audio = useAudio();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const needle = q.trim().replace(/^@/, "").toLowerCase();
  const matches = useMemo(
    () => (needle ? pool.filter((p) => p.name.toLowerCase().includes(needle) || p.sub.toLowerCase().includes(needle)) : pool).slice(0, 8),
    [pool, needle]
  );
  const handle = validHandle(q);
  const canLookup = !!onLookup && !!handle && !pool.some((p) => p.id === `x:${handle.toLowerCase()}`);

  const lookup = async () => {
    if (!onLookup || !handle) return;
    setBusy(true);
    setErr(null);
    const e = await onLookup(handle);
    setBusy(false);
    if (e) return setErr(e);
    onChange(`x:${handle.toLowerCase()}`);
    setOpen(false);
    setQ("");
  };

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "flex w-full min-w-0 items-center gap-2 rounded-xl border bg-ink-900/70 px-2.5 py-2 text-left text-sm",
          tone === "gold" ? "border-gold-400/40" : "border-mint-400/40"
        )}
      >
        {value ? <Avatar src={value.avatar} alt={value.name} size={24} /> : <span className="h-6 w-6 rounded-full bg-ink-700" />}
        <span className="min-w-0 flex-1 truncate text-content">{value ? value.name : "Pick a creator"}</span>
        <span className="text-[0.625rem] text-content-subtle">{value?.rank ? `#${value.rank}` : value?.custom ? "added" : ""}</span>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 min-w-[13.75rem] rounded-2xl border border-hairline bg-ink-900 p-2 shadow-2xl">
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setErr(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "Enter" && canLookup && !matches.length) lookup();
            }}
            placeholder={onLookup ? "Search, or type any @handle" : "Search channels"}
            aria-label="Search creators"
            className="w-full rounded-xl border border-hairline bg-ink-800/70 px-3 py-2 text-sm text-content placeholder:text-content-subtle focus:border-gold-400/50 focus:outline-none"
          />
          <ul className="mt-1.5 max-h-64 overflow-y-auto">
            {matches.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    audio.sfx("click");
                    onChange(p.id);
                    setOpen(false);
                    setQ("");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-ink-700/60"
                >
                  <Avatar src={p.avatar} alt={p.name} size={24} />
                  <span className="min-w-0 flex-1 truncate text-content">{p.name}</span>
                  <span className="shrink-0 text-[0.625rem] tabular-nums text-content-subtle">{p.rank ? `#${p.rank}` : p.custom ? "added" : ""}</span>
                </button>
              </li>
            ))}
            {!matches.length && !canLookup && <li className="px-2 py-2 text-xs text-content-subtle">No match.</li>}
          </ul>
          {canLookup && (
            <button
              type="button"
              onClick={lookup}
              disabled={busy}
              className="mt-1 flex w-full items-center gap-2 rounded-lg border border-dashed border-gold-400/40 px-2 py-2 text-left text-xs font-semibold text-gold-200 hover:bg-gold-400/5 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Look up @{handle} on X and add
            </button>
          )}
          {err && <p className="mt-1 px-1 text-[0.6875rem] text-red-300">{err}</p>}
        </div>
      )}
    </div>
  );
}

function HeadToHead({
  xPool,
  ytPool,
  initial,
  onLookup,
}: {
  xPool: ArenaEntry[];
  ytPool: ArenaEntry[];
  initial: string | null;
  onLookup: (handle: string) => Promise<string | null>;
}) {
  const [sourcePick, setSource] = useState<"x" | "yt" | null>(initial ? "x" : null);
  const source: "x" | "yt" = sourcePick ?? (xPool.length >= 2 || ytPool.length < 2 ? "x" : "yt");
  const pool = source === "x" ? xPool : ytPool;
  const metrics = source === "x" ? X_METRICS : YT_METRICS;
  const [a, setA] = useState<string>(initial && xPool.some((p) => p.id === initial) ? initial : (pool[0]?.id ?? ""));
  const [b, setB] = useState<string>(pool.find((p) => p.id !== a)?.id ?? "");
  const [copied, setCopied] = useState(false);
  const A = pool.find((p) => p.id === a) ?? pool[0];
  const B = pool.find((p) => p.id === b && p.id !== A?.id) ?? pool.find((p) => p.id !== A?.id);

  const wins = useMemo(() => {
    if (!A || !B) return [0, 0];
    let x = 0;
    let y = 0;
    for (const m of metrics) {
      const va = val(A, m.key);
      const vb = val(B, m.key);
      if (va > vb) x++;
      else if (vb > va) y++;
    }
    return [x, y];
  }, [A, B, metrics]);

  const switchSource = (s: "x" | "yt") => {
    const p = s === "x" ? xPool : ytPool;
    setSource(s);
    setA(p[0]?.id ?? "");
    setB(p[1]?.id ?? "");
  };

  return (
    <div>
      <div className="mb-4 flex gap-1.5">
        <Chip active={source === "x"} onClick={() => switchSource("x")}>
          X · Variational
        </Chip>
        <Chip active={source === "yt"} onClick={() => switchSource("yt")}>
          YouTube
        </Chip>
      </div>
      {pool.length < 2 ? (
        <Empty>Compare unlocks once at least two creators are on this board. Add any X handle above.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
            <CreatorPicker pool={pool} value={A} onChange={setA} tone="gold" onLookup={source === "x" ? onLookup : undefined} />
            <button type="button" onClick={() => (setA(B?.id ?? ""), setB(A?.id ?? ""))} aria-label="Swap" className="rounded-full p-1.5 text-gold-300 hover:bg-ink-700">
              <Swords className="h-5 w-5" />
            </button>
            <CreatorPicker pool={pool} value={B} onChange={setB} tone="mint" onLookup={source === "x" ? onLookup : undefined} />
          </div>
          {A && B && (
            <div className="mt-5">
              <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 text-center">
                <div className="flex min-w-0 flex-col items-center">
                  <Avatar src={A.avatar} alt={A.name} size={56} ring={wins[0]! > wins[1]! ? "ring-2 ring-gold-400" : undefined} />
                  <div className="mt-2 max-w-full truncate text-sm font-semibold text-gold-200">{A.name}</div>
                </div>
                <div className="font-display text-2xl font-bold tabular-nums text-content">
                  {wins[0]} <span className="text-content-subtle">:</span> {wins[1]}
                </div>
                <div className="flex min-w-0 flex-col items-center">
                  <Avatar src={B.avatar} alt={B.name} size={56} ring={wins[1]! > wins[0]! ? "ring-2 ring-mint-400" : undefined} />
                  <div className="mt-2 max-w-full truncate text-sm font-semibold text-mint-300">{B.name}</div>
                </div>
              </div>
              <Radar a={A} b={B} pool={pool} metrics={metrics.slice(0, 8)} />
              <div className="mt-2 grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
                {metrics.map((m) => {
                  const va = val(A, m.key);
                  const vb = val(B, m.key);
                  const total = va + vb || 1;
                  return (
                    <div key={m.key} className="min-w-0">
                      <div className="mb-1 flex justify-between gap-2 text-xs tabular-nums">
                        <span className={cn(va > vb ? "font-bold text-gold-200" : "text-content-muted")}>{m.fmt(va)}</span>
                        <span className="truncate text-content-subtle">{m.label}</span>
                        <span className={cn(vb > va ? "font-bold text-mint-300" : "text-content-muted")}>{m.fmt(vb)}</span>
                      </div>
                      <div className="flex h-2 overflow-hidden rounded-full bg-ink-700">
                        <motion.div className="h-full bg-gold-400" initial={{ width: "50%" }} animate={{ width: `${(va / total) * 100}%` }} transition={{ duration: 0.7 }} />
                        <motion.div className="h-full bg-mint-400" initial={{ width: "50%" }} animate={{ width: `${(vb / total) * 100}%` }} transition={{ duration: 0.7 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 text-center">
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await copy(`${A.name} vs ${B.name}: ${wins[0]}-${wins[1]} across ${metrics.length} stats on XYZ Crypto's Creator Arena. xyzcrypto.io/creators?tab=arena`);
                    setCopied(ok);
                    setTimeout(() => setCopied(false), 1600);
                  }}
                  className="btn-ghost inline-flex items-center gap-2"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />} {copied ? "Copied" : "Share result"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Squad Builder

const BUDGET = 100;
const SQUAD = 3;
/** What a creator costs in the draft: the higher they rank, the more of the budget they take. */
export function draftCost(rank: number): number {
  if (rank <= 0) return 15;
  if (rank <= 10) return 45;
  if (rank <= 30) return 30;
  if (rank <= 100) return 20;
  return 10;
}

function SquadBuilder({ pool, label }: { pool: ArenaEntry[]; label: string }) {
  const audio = useAudio();
  const [squad, saveSquad] = useLocalList("xyz:creators:squad", SQUAD);
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState(false);
  const members = squad.map((id) => pool.find((p) => p.id === id)).filter((x): x is ArenaEntry => !!x);
  const spent = members.reduce((s, m) => s + draftCost(m.rank), 0);
  const left = BUDGET - spent;
  const top3 = useMemo(() => [...pool].filter((p) => p.rank > 0).sort((a, b) => a.rank - b.rank).slice(0, 3), [pool]);
  const sum = (list: ArenaEntry[], k: MetricKey) => list.reduce((s, m) => s + val(m, k), 0);
  const options = useMemo(
    () =>
      pool
        .filter((p) => !squad.includes(p.id) && (!q || p.name.toLowerCase().includes(q.toLowerCase())))
        .sort((a, b) => (a.rank || 1e9) - (b.rank || 1e9))
        .slice(0, 40),
    [pool, squad, q]
  );

  if (pool.length < 4) return <Empty>The Squad Builder unlocks once a few creators are on the board.</Empty>;

  const pick = (e: ArenaEntry) => {
    if (members.length >= SQUAD || draftCost(e.rank) > left) return;
    audio.sfx(members.length === SQUAD - 1 ? "combo" : "click");
    saveSquad([...squad, e.id]);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="min-w-0">
        <p className="text-sm leading-relaxed text-content-muted">
          Draft {SQUAD} creators with {BUDGET} credits. Top 10 cost 45, ranks 11 to 30 cost 30, 31 to 100 cost 20, everyone else 10. Your squad&apos;s
          numbers are live, so check back as the board moves.
        </p>
        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="text-content-subtle">
            {members.length}/{SQUAD} picked
          </span>
          <span className={cn("font-bold tabular-nums", left < 10 ? "text-red-400" : "text-gold-200")}>{left} credits left</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-700">
          <motion.div className="h-full rounded-full bg-gold-400" animate={{ width: `${(spent / BUDGET) * 100}%` }} />
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find a creator"
          aria-label="Find a creator"
          className="mt-4 w-full rounded-xl border border-hairline bg-ink-900/60 px-3 py-2 text-sm text-content placeholder:text-content-subtle focus:border-gold-400/50 focus:outline-none"
        />
        <ul className="mt-2 max-h-72 divide-y divide-hairline overflow-y-auto pr-1">
          {options.map((e) => {
            const cost = draftCost(e.rank);
            const can = members.length < SQUAD && cost <= left;
            return (
              <li key={e.id} className="flex items-center gap-2.5 py-2">
                <Avatar src={e.avatar} alt={e.name} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-content">{e.name}</div>
                  <div className="truncate text-[0.6875rem] text-content-subtle">
                    {e.rank ? `#${e.rank}` : "Added"} · {compact(e.points)} pts
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!can}
                  onClick={() => pick(e)}
                  className={cn("shrink-0 rounded-full border px-2.5 py-1 text-[0.6875rem] font-bold tabular-nums", can ? "border-gold-400/40 text-gold-200 hover:bg-gold-400/10" : "border-hairline text-content-subtle")}
                >
                  {cost} cr
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="min-w-0 rounded-2xl border border-hairline bg-ink-900/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-content">Your squad · {label}</span>
          {members.length > 0 && (
            <button type="button" onClick={() => saveSquad([])} className="text-[0.6875rem] text-content-subtle hover:text-content">
              Clear
            </button>
          )}
        </div>
        <ul className="space-y-2">
          {Array.from({ length: SQUAD }, (_, i) => {
            const m = members[i];
            return (
              <li key={i} className={cn("flex items-center gap-3 rounded-xl border p-2.5", m ? "border-gold-400/30" : "border-dashed border-hairline")}>
                {m ? (
                  <>
                    <Avatar src={m.avatar} alt={m.name} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-content">{m.name}</div>
                      <div className="text-[0.6875rem] tabular-nums text-content-subtle">
                        {compact(m.points)} pts · {compact(m.views)} views · {draftCost(m.rank)} cr
                      </div>
                    </div>
                    <button type="button" onClick={() => saveSquad(squad.filter((id) => id !== m.id))} aria-label={`Remove ${m.name}`} className="rounded-full p-1 text-content-subtle hover:text-content">
                      <Close className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <span className="px-1 py-1.5 text-xs text-content-subtle">Empty slot</span>
                )}
              </li>
            );
          })}
        </ul>
        {members.length === SQUAD && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-2 border-t border-hairline pt-4">
            {(
              [
                ["Points", "points", compact],
                ["Views", "views", compact],
                ["Likes", "likes", compact],
                ["Posts", "posts", full],
              ] as const
            ).map(([l, k, f]) => {
              const mine = sum(members, k);
              const theirs = sum(top3, k);
              return (
                <div key={k} className="grid grid-cols-[5rem_minmax(0,1fr)_auto] items-center gap-2 text-xs">
                  <span className="text-content-muted">{l}</span>
                  <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
                    <motion.div className="h-full rounded-full bg-gold-400" animate={{ width: `${Math.min(100, (mine / Math.max(1, theirs)) * 100)}%` }} />
                  </div>
                  <span className="tabular-nums text-content">
                    {f(mine)} <span className="text-content-subtle">/ {f(theirs)}</span>
                  </span>
                </div>
              );
            })}
            <p className="pt-1 text-[0.6875rem] text-content-subtle">Bars compare your squad with the board&apos;s top 3 combined.</p>
            <button
              type="button"
              onClick={async () => {
                const ok = await copy(
                  `My XYZ Creator Arena squad: ${members.map((m) => m.name).join(", ")}. ${compact(sum(members, "points"))} points vs the top 3's ${compact(sum(top3, "points"))}. xyzcrypto.io/creators?tab=arena`
                );
                setCopied(ok);
                setTimeout(() => setCopied(false), 1600);
              }}
              className="btn-ghost mt-2 inline-flex items-center gap-2"
            >
              {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />} {copied ? "Copied" : "Share squad"}
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ manual add

function AddProfile({ custom, onAdd, onRemove, loading }: { custom: ArenaEntry[]; onAdd: (h: string) => Promise<string | null>; onRemove: (id: string) => void; loading: boolean }) {
  const [h, setH] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const handle = validHandle(h);
    if (!handle) return setMsg("That isn't an X handle.");
    setBusy(true);
    setMsg(null);
    const err = await onAdd(handle);
    setBusy(false);
    if (err) setMsg(err);
    else setH("");
  };

  return (
    <Panel>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="min-w-0 lg:w-72">
          <p className="text-sm font-semibold text-content">Add any X profile</p>
          <p className="mt-0.5 text-xs text-content-subtle">Bring in someone who isn&apos;t on the board yet. Their real Variational numbers join every game.</p>
        </div>
        <form onSubmit={submit} className="flex min-w-0 flex-1 gap-2">
          <input
            value={h}
            onChange={(e) => {
              setH(e.target.value);
              setMsg(null);
            }}
            placeholder="@handle"
            autoCapitalize="none"
            spellCheck={false}
            aria-label="X handle to add"
            className="min-w-0 flex-1 rounded-xl border border-hairline bg-ink-900/60 px-3 py-2 font-mono text-sm text-content placeholder:text-content-subtle focus:border-gold-400/50 focus:outline-none"
          />
          <button type="submit" disabled={busy} className="btn-secondary inline-flex shrink-0 items-center gap-1.5 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
          </button>
        </form>
      </div>
      {msg && <p className="mt-2 text-xs text-red-300">{msg}</p>}
      {(custom.length > 0 || loading) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-content-subtle" />}
          {custom.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/30 bg-gold-400/5 py-0.5 pl-0.5 pr-2 text-xs text-gold-100">
              <Avatar src={c.avatar} alt={c.name} size={20} />
              {c.name}
              <button type="button" onClick={() => onRemove(c.id)} aria-label={`Remove ${c.name}`} className="text-content-subtle hover:text-content">
                <Close className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ------------------------------------------------------------------ shell

type Mode = "hilo" | "daily" | "quiz" | "h2h" | "squad";
const MODES: { id: Mode; label: string; sub: string; Icon: typeof Zap }[] = [
  { id: "hilo", label: "Higher or Lower", sub: "Six metrics, three lives", Icon: Zap },
  { id: "daily", label: "Daily Challenge", sub: "Same ten duels for all", Icon: CalendarCheck },
  { id: "quiz", label: "Rank Quiz", sub: "Guess where they rank", Icon: Target },
  { id: "h2h", label: "Head to Head", sub: "Twelve stats, one radar", Icon: Swords },
  { id: "squad", label: "Squad Builder", sub: "Draft three on a budget", Icon: Users },
];

async function fetchProfile(handle: string): Promise<{ entry: ArenaEntry | null; error: string | null }> {
  const get = async (replies: boolean) => {
    const r = await fetch(`/api/creators/x/profile?handle=${encodeURIComponent(handle)}&venue=variational${replies ? "&replies=1" : ""}`);
    const body = await r.json().catch(() => null);
    return { ok: r.ok && !!body?.profile, profile: body?.profile as Profile | undefined, error: body?.error as string | undefined };
  };
  try {
    const first = await get(false);
    if (first.ok && first.profile && first.profile.totals.posts > 0) return { entry: fromProfile(first.profile), error: null };
    // Someone who mostly replies has no original posts: count their replies
    // rather than refusing them, and say so in the entry.
    const withReplies = await get(true);
    if (withReplies.ok && withReplies.profile) {
      const e = fromProfile(withReplies.profile);
      return { entry: { ...e, sub: `${e.sub} · replies counted` }, error: null };
    }
    return { entry: null, error: first.error || withReplies.error || "No Variational posts found for that account yet." };
  } catch {
    return { entry: null, error: "Network error. Please try again." };
  }
}

export function Arena({ xPool, ytPool, label, compareWith }: { xPool: ArenaEntry[]; ytPool: ArenaEntry[]; label: string; compareWith: string | null }) {
  const [mode, setMode] = useState<Mode>(compareWith ? "h2h" : "hilo");

  // ---- audio
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(DEFAULT_AUDIO);
  const settingsRef = useRef<AudioSettings>(DEFAULT_AUDIO);
  const wantMusic = useRef<{ on: boolean; fast: boolean }>({ on: false, fast: false });
  useEffect(() => {
    // Read after mount: storage is never a render input.
    const t = setTimeout(() => {
      const s = loadAudioSettings();
      settingsRef.current = s;
      setAudioSettings(s);
    }, 0);
    return () => clearTimeout(t);
  }, []);
  // Leaving the Arena (tab switch or page change) stops the music; hiding the
  // browser tab pauses it and coming back resumes it.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") stopMusic();
      else if (wantMusic.current.on) startMusic(settingsRef.current, wantMusic.current.fast);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      stopMusic();
    };
  }, []);
  const audio = useMemo<ArenaAudio>(
    () => ({
      sfx: (k) => {
        unlock();
        playSfx(k, settingsRef.current);
      },
      music: (fast = false) => {
        unlock();
        wantMusic.current = { on: true, fast };
        setMusicTempo(fast);
        startMusic(settingsRef.current, fast);
      },
    }),
    []
  );
  const toggle = useCallback((k: keyof AudioSettings) => {
    const next = { ...settingsRef.current, [k]: !settingsRef.current[k] };
    settingsRef.current = next;
    setAudioSettings(next);
    saveAudioSettings(next);
    unlock();
    if (k === "music") {
      if (!next.music) stopMusic();
      else if (wantMusic.current.on) startMusic(next, wantMusic.current.fast);
    }
    if (k === "sound" && next.sound) playSfx("click", next);
  }, []);
  const [customHandles, saveCustom] = useLocalList("xyz:creators:arena-custom", 8);
  const [custom, setCustom] = useState<ArenaEntry[]>([]);
  const [loadingCustom, setLoadingCustom] = useState(false);

  // Re-load saved custom profiles with today's numbers.
  useEffect(() => {
    if (!customHandles.length) return;
    let alive = true;
    const t = setTimeout(() => setLoadingCustom(true), 0);
    Promise.all(customHandles.map((h) => fetchProfile(h))).then((res) => {
      if (!alive) return;
      const fresh = res.flatMap((r) => (r.entry ? [r.entry] : []));
      // Keep anything added this visit that a slow re-load has not returned yet.
      setCustom((prev) => [...fresh, ...prev.filter((p) => !fresh.some((f) => f.id === p.id))]);
      setLoadingCustom(false);
    });
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [customHandles]);

  // The Arena's own YouTube pool covers every venue, not just the topic the
  // YouTube tab happens to show (edge-cached, so this is cheap).
  const [ytAll, setYtAll] = useState<ArenaEntry[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/creators/youtube?topic=all")
      .then((r) => r.json())
      .then((b) => {
        if (alive && Array.isArray(b?.videos)) setYtAll(fromYoutube(rankYoutubeCreators(b.videos)));
      })
      .catch(() => null);
    return () => {
      alive = false;
    };
  }, []);

  // Everyone on the board plus everyone added by hand. Hand-added profiles
  // are kept even at 0 points (they can still be compared and drafted);
  // a profile already on the board just uses its board row.
  const allX = useMemo(() => {
    const ids = new Set(xPool.map((p) => p.id));
    return [...xPool, ...custom.filter((c) => !ids.has(c.id))];
  }, [xPool, custom]);
  const usableX = useMemo(() => allX.filter((p) => p.points > 0), [allX]);
  const allYt = ytAll && ytAll.length ? ytAll : ytPool;
  const usableYt = useMemo(() => allYt.filter((p) => p.points > 0), [allYt]);
  const active = MODES.find((m) => m.id === mode)!;

  const add = async (h: string): Promise<string | null> => {
    if (customHandles.some((x) => x.toLowerCase() === h.toLowerCase()) || xPool.some((p) => p.id === `x:${h.toLowerCase()}`)) {
      return null; // already in the games
    }
    const r = await fetchProfile(h);
    if (!r.entry) return r.error;
    // Show it at once; the saved list re-loads it with fresh numbers later.
    setCustom((c) => [r.entry!, ...c.filter((x) => x.id !== r.entry!.id)]);
    saveCustom([h, ...customHandles]);
    return null;
  };

  return (
    <AudioCtx.Provider value={audio}>
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-content-muted">Games built on the live boards. Your scores stay on this device.</p>
        <div className="flex items-center gap-1.5" role="group" aria-label="Arena audio">
          <button
            type="button"
            onClick={() => toggle("sound")}
            aria-pressed={audioSettings.sound}
            title={audioSettings.sound ? "Sound effects on" : "Sound effects off"}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              audioSettings.sound ? "border-gold-400/50 bg-gold-400/10 text-gold-200" : "border-hairline text-content-subtle"
            )}
          >
            {audioSettings.sound ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />} Sound {audioSettings.sound ? "on" : "off"}
          </button>
          <button
            type="button"
            onClick={() => toggle("music")}
            aria-pressed={audioSettings.music}
            title={audioSettings.music ? "Background music on" : "Background music off"}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              audioSettings.music ? "border-mint-400/50 bg-mint-400/10 text-mint-300" : "border-hairline text-content-subtle"
            )}
          >
            <Music className={cn("h-3.5 w-3.5", !audioSettings.music && "opacity-50")} /> Music {audioSettings.music ? "on" : "off"}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {MODES.map(({ id, label: l, sub, Icon }) => (
          <motion.button
            key={id}
            type="button"
            onClick={() => {
              audio.sfx("click");
              setMode(id);
            }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            aria-pressed={mode === id}
            className={cn(
              "min-w-0 rounded-2xl border p-4 text-left transition-colors",
              mode === id ? "border-gold-400/60 bg-gold-400/10" : "border-hairline bg-ink-900/40 hover:border-gold-400/30"
            )}
          >
            <Icon className={cn("h-5 w-5", mode === id ? "text-gold-300" : "text-content-subtle")} />
            <div className={cn("mt-2 truncate text-sm font-bold", mode === id ? "text-gold-100" : "text-content")}>{l}</div>
            <div className="mt-0.5 truncate text-[0.6875rem] text-content-subtle">{sub}</div>
          </motion.button>
        ))}
      </div>

      <AddProfile custom={custom} loading={loadingCustom} onAdd={add} onRemove={(id) => saveCustom(customHandles.filter((h) => `x:${h.toLowerCase()}` !== id))} />

      <Panel>
        <PanelTitle title={active.label} sub={active.sub} right={<active.Icon className="h-4 w-4 text-gold-300" />} />
        {/* Enter-only, for the same reason as the page tabs: a stalled exit must never leave the old mode on screen. */}
        <motion.div key={mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {mode === "hilo" && <HigherLower xPool={usableX} ytPool={usableYt} />}
          {mode === "daily" && <Daily pool={usableX.filter((p) => !p.custom).length >= 2 ? usableX.filter((p) => !p.custom) : usableYt} source={usableX.filter((p) => !p.custom).length >= 2 ? "x" : "yt"} />}
          {mode === "quiz" && <RankQuiz pool={usableX.filter((p) => p.rank > 0).length >= 8 ? usableX : usableYt} />}
          {mode === "h2h" && (
            <HeadToHead key={compareWith ?? "none"} xPool={allX} ytPool={allYt} initial={compareWith ? `x:${compareWith.toLowerCase()}` : null} onLookup={add} />
          )}
          {mode === "squad" && <SquadBuilder pool={allX.length >= 4 ? allX : allYt} label={allX.length >= 4 ? label : "YouTube"} />}
        </motion.div>
      </Panel>
    </div>
    </AudioCtx.Provider>
  );
}
