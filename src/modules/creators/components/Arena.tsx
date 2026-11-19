"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarCheck, Check, Copy, Crown, Flame, Heart, Medal, RotateCcw, Share2, Swords, Target, Trophy, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { mulberry32 } from "@shared/utils/rng";
import type { BoardRow } from "@modules/creators/lib/x-index";
import type { YtCreator } from "@modules/creators/lib/scoring";
import { compact, full, pct } from "@modules/creators/lib/game";
import { Avatar, Chip, CountUp, Empty, Panel, PanelTitle, useLocalList } from "./ui";

// The Arena: games built on the real leaderboard numbers.
//  - Higher or Lower: X or YouTube, four metrics, three lives, combo XP.
//  - Daily Challenge: the same ten match-ups for everyone each UTC day.
//  - Rank Quiz: guess where a creator ranks.
//  - Head to Head: any two creators, six stats and a radar.
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
  score: number | null;
  engagement: number | null;
  source: "x" | "yt";
};

export function fromBoard(rows: BoardRow[]): ArenaEntry[] {
  return rows.map((r) => ({
    id: `x:${r.handle}`,
    name: `@${r.handle}`,
    sub: r.name,
    avatar: r.avatar,
    rank: r.rank,
    points: r.points,
    views: r.views,
    posts: r.posts,
    followers: r.followers,
    score: r.score,
    engagement: r.views > 0 ? (r.likes + r.replies + r.reposts + r.quotes + r.bookmarks) / r.views : null,
    source: "x",
  }));
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
    score: null,
    engagement: c.views > 0 ? (c.likes + c.comments) / c.views : null,
    source: "yt",
  }));
}

type Metric = "points" | "views" | "score" | "followers";
const METRIC_LABEL: Record<Metric, string> = { points: "points", views: "views", score: "XYZ Score", followers: "followers" };
const metricVal = (e: ArenaEntry, m: Metric) => (m === "score" ? (e.score ?? 0) : e[m]);
const fmtMetric = (m: Metric, n: number) => (m === "points" || m === "score" ? full(n) : compact(n));

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function pickPair(pool: ArenaEntry[], m: Metric, rnd: () => number, keep?: ArenaEntry): [ArenaEntry, ArenaEntry] {
  const a = keep ?? pool[Math.floor(rnd() * pool.length)]!;
  let b = a;
  // Avoid ties (no right answer) and the same entry twice.
  for (let i = 0; i < 60 && (b.id === a.id || metricVal(b, m) === metricVal(a, m)); i++) b = pool[Math.floor(rnd() * pool.length)]!;
  return [a, b];
}

function Duel({
  pair,
  metric,
  picked,
  onPick,
}: {
  pair: [ArenaEntry, ArenaEntry];
  metric: Metric;
  picked: string | null;
  onPick: (id: string) => void;
}) {
  const top = Math.max(metricVal(pair[0], metric), metricVal(pair[1], metric));
  return (
    <div className="relative grid grid-cols-2 gap-3 sm:gap-5">
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-hairline bg-ink-900 text-xs font-black text-gold-300 shadow-lg">
        VS
      </div>
      <AnimatePresence mode="popLayout">
        {pair.map((e) => {
          const win = picked != null && metricVal(e, metric) === top;
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
                "flex flex-col items-center rounded-3xl border p-4 text-center transition-colors sm:p-6",
                win ? "border-mint-400/70 bg-mint-400/10" : lose ? "border-red-400/40 bg-red-400/5" : "border-hairline bg-ink-900/40 hover:border-gold-400/40"
              )}
            >
              <Avatar src={e.avatar} alt={e.name} size={64} />
              <div className="mt-3 w-full truncate text-sm font-semibold text-content">{e.name}</div>
              <div className="w-full truncate text-xs text-content-subtle">{e.sub}</div>
              <div className="mt-3 h-8 font-display text-2xl font-bold tabular-nums text-gold-300">
                {picked ? <CountUp value={metricVal(e, metric)} format={(n) => fmtMetric(metric, n)} duration={700} /> : "?"}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-content-subtle">{METRIC_LABEL[metric]}</div>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ------------------------------------------------------------------ Higher or Lower

function HigherLower({ xPool, ytPool, label }: { xPool: ArenaEntry[]; ytPool: ArenaEntry[]; label: string }) {
  const [source, setSource] = useState<"x" | "yt">(xPool.length >= 2 ? "x" : "yt");
  const [metric, setMetric] = useState<Metric>("points");
  const [pair, setPair] = useState<[ArenaEntry, ArenaEntry] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [xp, setXp] = useState(0);
  const [over, setOver] = useState(false);
  const [bests, saveBests] = useLocalList("xyz:creators:hilo-bests", 40);
  const [shared, setShared] = useState(false);

  const pool = source === "x" ? xPool : ytPool;
  const key = `${source}:${metric}`;
  const best = Number(bests.find((b) => b.startsWith(`${key}=`))?.split("=")[1] ?? 0);
  const metrics: Metric[] = source === "x" ? ["points", "views", "score", "followers"] : ["points", "views", "followers"];
  const combo = Math.min(5, 1 + Math.floor(streak / 3));

  const reset = () => {
    setPair(null);
    setPicked(null);
    setStreak(0);
    setLives(3);
    setXp(0);
    setOver(false);
  };

  const start = () => {
    reset();
    setPair(pickPair(pool, metric, Math.random));
  };

  const choose = (id: string) => {
    if (!pair || picked) return;
    setPicked(id);
    const winner = metricVal(pair[0], metric) > metricVal(pair[1], metric) ? pair[0] : pair[1];
    const right = id === winner.id;
    setTimeout(() => {
      if (right) {
        const next = streak + 1;
        setStreak(next);
        setXp((x) => x + 10 * combo);
        if (next > best) saveBests([`${key}=${next}`, ...bests.filter((b) => !b.startsWith(`${key}=`))]);
        setPair(pickPair(pool, metric, Math.random, winner));
        setPicked(null);
      } else if (lives > 1) {
        setLives((l) => l - 1);
        setStreak(0);
        setPair(pickPair(pool, metric, Math.random));
        setPicked(null);
      } else {
        setLives(0);
        setOver(true);
      }
    }, 1300);
  };

  if (xPool.length < 2 && ytPool.length < 2) return <Empty>The game unlocks once at least two creators are on a board.</Empty>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <Chip active={source === "x"} onClick={() => (setSource("x"), setMetric("points"), reset())}>
          X · {label}
        </Chip>
        <Chip active={source === "yt"} onClick={() => (setSource("yt"), setMetric("points"), reset())}>
          YouTube
        </Chip>
        <span className="mx-1 h-4 w-px bg-hairline" />
        {metrics.map((m) => (
          <Chip key={m} active={metric === m} onClick={() => (setMetric(m), reset())}>
            {METRIC_LABEL[m][0]!.toUpperCase() + METRIC_LABEL[m].slice(1)}
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
            <div className="flex items-center gap-1" aria-label={`${lives} lives left`}>
              {[0, 1, 2].map((i) => (
                <motion.span key={i} animate={{ scale: i < lives ? 1 : 0.8, opacity: i < lives ? 1 : 0.25 }}>
                  <Heart className={cn("h-4 w-4", i < lives ? "fill-red-400 text-red-400" : "text-content-subtle")} />
                </motion.span>
              ))}
            </div>
          </div>

          {!pair ? (
            <div className="py-8 text-center">
              <p className="mx-auto max-w-md text-sm leading-relaxed text-content-muted">
                Two creators. Who has more {METRIC_LABEL[metric]}? Three lives, and every three in a row raises your combo.
              </p>
              <button type="button" onClick={start} className="btn-primary mt-5 inline-flex items-center gap-2">
                <Zap className="h-4 w-4" /> Play
              </button>
            </div>
          ) : over ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-6 text-center">
              <Trophy className="mx-auto h-10 w-10 text-gold-300" />
              <div className="mt-3 font-display text-3xl font-bold text-content">{full(xp)} XP</div>
              <p className="mt-1 text-sm text-content-muted">Best streak this mode: {best}</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={start} className="btn-primary inline-flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" /> Play again
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await copy(
                      `I scored ${xp} XP (best streak ${best}) in Higher or Lower on XYZ Crypto's Creator Arena (${source === "x" ? `X · ${label}` : "YouTube"}, ${METRIC_LABEL[metric]}). Beat me: xyzcrypto.io/creators?tab=arena`
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
            <Duel pair={pair} metric={metric} picked={picked} onPick={choose} />
          )}
        </>
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

function Daily({ pool, label }: { pool: ArenaEntry[]; label: string }) {
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

  const done = day ? history.find((h) => h.startsWith(`${day}=`))?.split("=")[1] ?? null : null;

  if (pool.length < 2) return <Empty>The Daily Challenge unlocks once at least two creators are on the board.</Empty>;
  if (!day || !pairs.length) return null;

  const grid = (r: string) => r.split("").map((c) => (c === "1" ? "🟩" : "🟥")).join("");

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
          <p className="mt-3 text-[11px] text-content-subtle">
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
          {label} · {day} · who has more points?
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
      <Duel pair={pair} metric="points" picked={picked} onPick={choose} />
    </div>
  );
}

// ------------------------------------------------------------------ Rank Quiz

const QUIZ_ROUNDS = 5;

function brackets(n: number): { label: string; lo: number; hi: number }[] {
  if (n >= 60) return [{ label: "Top 3", lo: 1, hi: 3 }, { label: "4 to 10", lo: 4, hi: 10 }, { label: "11 to 50", lo: 11, hi: 50 }, { label: "51+", lo: 51, hi: Infinity }];
  const q = Math.max(1, Math.ceil(n / 4));
  return [0, 1, 2, 3].map((i) => ({ label: i === 3 ? `${3 * q + 1}+` : `${i * q + 1} to ${(i + 1) * q}`, lo: i * q + 1, hi: i === 3 ? Infinity : (i + 1) * q }));
}

function RankQuiz({ pool }: { pool: ArenaEntry[] }) {
  const [q, setQ] = useState<ArenaEntry[] | null>(null);
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const bs = brackets(pool.length);

  if (pool.length < 8) return <Empty>The Rank Quiz unlocks once at least eight creators are ranked.</Empty>;

  const start = () => {
    const picks: ArenaEntry[] = [];
    const used = new Set<string>();
    // One from each bracket where possible, so the answer isn't always "51+".
    for (let k = 0; k < QUIZ_ROUNDS; k++) {
      const b = bs[k % bs.length]!;
      const options = pool.filter((p) => p.rank >= b.lo && p.rank <= b.hi && !used.has(p.id));
      const pick = (options.length ? options : pool.filter((p) => !used.has(p.id)))[Math.floor(Math.random() * Math.max(1, options.length || pool.length - used.size))];
      if (pick) {
        picks.push(pick);
        used.add(pick.id);
      }
    }
    setQ(picks.sort(() => Math.random() - 0.5));
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
        <p className="mt-1 text-sm text-content-muted">{score === q.length ? "Perfect read of the board." : score >= 3 ? "You know this scene." : "The board has surprises."}</p>
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
          <div className="mt-1 text-xs text-content-subtle">
            {full(e.posts)} posts · {compact(e.views)} views · {compact(e.followers)} followers
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

const H2H: { key: keyof ArenaEntry; label: string; fmt: (n: number) => string; log?: boolean }[] = [
  { key: "points", label: "Points", fmt: full, log: true },
  { key: "score", label: "XYZ Score", fmt: (n) => String(n) },
  { key: "views", label: "Views", fmt: compact, log: true },
  { key: "posts", label: "Posts", fmt: full, log: true },
  { key: "followers", label: "Followers", fmt: compact, log: true },
  { key: "engagement", label: "Engagement", fmt: (n) => pct(n, 2) },
];

function Radar({ a, b, pool }: { a: ArenaEntry; b: ArenaEntry; pool: ArenaEntry[] }) {
  const size = 220;
  const c = size / 2;
  const R = c - 28;
  const norm = (e: ArenaEntry, k: (typeof H2H)[number]) => {
    const max = Math.max(1e-9, ...pool.map((p) => Number(p[k.key] ?? 0)));
    const v = Number(e[k.key] ?? 0);
    return k.log ? Math.log10(v + 1) / Math.log10(max + 1) : v / max;
  };
  const pt = (i: number, r: number) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / H2H.length;
    return [c + Math.cos(ang) * r, c + Math.sin(ang) * r] as const;
  };
  const poly = (e: ArenaEntry) => H2H.map((k, i) => pt(i, R * Math.max(0.04, Math.min(1, norm(e, k)))).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto h-56 w-56" role="img" aria-label="Radar comparison">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={H2H.map((_, i) => pt(i, R * f).join(",")).join(" ")} fill="none" stroke="currentColor" className="text-ink-600" strokeWidth={1} />
      ))}
      {H2H.map((k, i) => {
        const [x, y] = pt(i, R + 14);
        return (
          <text key={k.label} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-current text-content-subtle" fontSize={9}>
            {k.label}
          </text>
        );
      })}
      <motion.polygon initial={{ opacity: 0 }} animate={{ opacity: 1 }} points={poly(a)} fill="rgba(226,167,47,0.25)" stroke="#e2a72f" strokeWidth={2} />
      <motion.polygon initial={{ opacity: 0 }} animate={{ opacity: 1 }} points={poly(b)} fill="rgba(34,214,146,0.2)" stroke="#22d692" strokeWidth={2} />
    </svg>
  );
}

function HeadToHead({ pool, initial }: { pool: ArenaEntry[]; initial: string | null }) {
  const [a, setA] = useState<string>(initial && pool.some((p) => p.id === initial) ? initial : (pool[0]?.id ?? ""));
  const [b, setB] = useState<string>(pool.find((p) => p.id !== a)?.id ?? "");
  const [copied, setCopied] = useState(false);
  const A = pool.find((p) => p.id === a);
  const B = pool.find((p) => p.id === b);

  const wins = useMemo(() => {
    if (!A || !B) return [0, 0];
    let x = 0;
    let y = 0;
    for (const m of H2H) {
      const va = (A[m.key] as number | null) ?? -1;
      const vb = (B[m.key] as number | null) ?? -1;
      if (va > vb) x++;
      else if (vb > va) y++;
    }
    return [x, y];
  }, [A, B]);

  if (pool.length < 2) return <Empty>Compare unlocks once at least two creators are on the board.</Empty>;

  const select = (value: string, set: (v: string) => void, tone: string) => (
    <select
      value={value}
      onChange={(e) => set(e.target.value)}
      className={cn("w-full rounded-xl border bg-ink-900/70 px-3 py-2.5 text-sm text-content focus:outline-none", tone)}
      aria-label="Pick a creator"
    >
      {pool.slice(0, 500).map((p) => (
        <option key={p.id} value={p.id}>
          #{p.rank} {p.name}
        </option>
      ))}
    </select>
  );

  return (
    <div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {select(a, setA, "border-gold-400/40")}
        <button type="button" onClick={() => (setA(b), setB(a))} aria-label="Swap" className="rounded-full p-1.5 text-gold-300 hover:bg-ink-700">
          <Swords className="h-5 w-5" />
        </button>
        {select(b, setB, "border-mint-400/40")}
      </div>
      {A && B && (
        <div className="mt-5">
          <div className="mb-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
            <div className="flex flex-col items-center">
              <Avatar src={A.avatar} alt={A.name} size={56} ring={wins[0]! > wins[1]! ? "ring-2 ring-gold-400" : undefined} />
              <div className="mt-2 max-w-full truncate text-sm font-semibold text-gold-200">{A.name}</div>
            </div>
            <div className="font-display text-2xl font-bold tabular-nums text-content">
              {wins[0]} <span className="text-content-subtle">:</span> {wins[1]}
            </div>
            <div className="flex flex-col items-center">
              <Avatar src={B.avatar} alt={B.name} size={56} ring={wins[1]! > wins[0]! ? "ring-2 ring-mint-400" : undefined} />
              <div className="mt-2 max-w-full truncate text-sm font-semibold text-mint-300">{B.name}</div>
            </div>
          </div>
          <Radar a={A} b={B} pool={pool} />
          <div className="mt-2 space-y-3">
            {H2H.map((m) => {
              const va = (A[m.key] as number | null) ?? 0;
              const vb = (B[m.key] as number | null) ?? 0;
              const total = va + vb || 1;
              return (
                <div key={m.key}>
                  <div className="mb-1 flex justify-between text-xs tabular-nums">
                    <span className={cn(va > vb ? "font-bold text-gold-200" : "text-content-muted")}>{m.fmt(va)}</span>
                    <span className="text-content-subtle">{m.label}</span>
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
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={async () => {
                const ok = await copy(`${A.name} vs ${B.name}: ${wins[0]}-${wins[1]} across points, XYZ Score, views, posts, followers and engagement. xyzcrypto.io/creators?tab=arena`);
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
    </div>
  );
}

// ------------------------------------------------------------------ shell

type Mode = "hilo" | "daily" | "quiz" | "h2h";
const MODES: { id: Mode; label: string; sub: string; Icon: typeof Zap }[] = [
  { id: "hilo", label: "Higher or Lower", sub: "Streaks, combos, three lives", Icon: Zap },
  { id: "daily", label: "Daily Challenge", sub: "Same ten duels for everyone", Icon: CalendarCheck },
  { id: "quiz", label: "Rank Quiz", sub: "Guess where they rank", Icon: Target },
  { id: "h2h", label: "Head to Head", sub: "Six stats and a radar", Icon: Swords },
];

export function Arena({ xPool, ytPool, label, compareWith }: { xPool: ArenaEntry[]; ytPool: ArenaEntry[]; label: string; compareWith: string | null }) {
  const [mode, setMode] = useState<Mode>(compareWith ? "h2h" : "hilo");
  const usableX = useMemo(() => xPool.filter((p) => p.points > 0), [xPool]);
  const usableYt = useMemo(() => ytPool.filter((p) => p.points > 0), [ytPool]);
  const active = MODES.find((m) => m.id === mode)!;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {MODES.map(({ id, label: l, sub, Icon }) => (
          <motion.button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            aria-pressed={mode === id}
            className={cn(
              "relative overflow-hidden rounded-2xl border p-4 text-left transition-colors",
              mode === id ? "border-gold-400/60 bg-gold-400/10" : "border-hairline bg-ink-900/40 hover:border-gold-400/30"
            )}
          >
            <Icon className={cn("h-5 w-5", mode === id ? "text-gold-300" : "text-content-subtle")} />
            <div className={cn("mt-2 text-sm font-bold", mode === id ? "text-gold-100" : "text-content")}>{l}</div>
            <div className="mt-0.5 text-[11px] text-content-subtle">{sub}</div>
          </motion.button>
        ))}
      </div>

      <Panel>
        <PanelTitle title={active.label} sub={active.sub} right={<active.Icon className="h-4 w-4 text-gold-300" />} />
        {/* Enter-only, for the same reason as the page tabs: a stalled exit must never leave the old mode on screen. */}
        <motion.div key={mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            {mode === "hilo" && <HigherLower xPool={usableX} ytPool={usableYt} label={label} />}
            {mode === "daily" && <Daily pool={usableX.length >= 2 ? usableX : usableYt} label={usableX.length >= 2 ? `X · ${label}` : "YouTube"} />}
            {mode === "quiz" && <RankQuiz pool={usableX.length >= 8 ? usableX : usableYt} />}
            {mode === "h2h" && <HeadToHead key={compareWith ?? "none"} pool={usableX.length >= 2 ? usableX : usableYt} initial={compareWith ? `x:${compareWith}` : null} />}
        </motion.div>
      </Panel>
    </div>
  );
}
