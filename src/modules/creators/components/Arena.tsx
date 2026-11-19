"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, Flame, RotateCcw, Swords, Trophy, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BoardRow } from "@modules/creators/lib/x-index";
import { compact, full, pct } from "@modules/creators/lib/game";
import { Avatar, Empty, Panel, PanelTitle } from "./ui";

// The Arena: two small games built on the real leaderboard numbers.
//  - Higher or Lower: guess which creator has more points. Streak + best.
//  - Head to Head: put any two creators side by side.
// Randomness is only ever drawn in click handlers, never during render, so
// the server and the first client render always agree.

export type ArenaEntry = {
  id: string;
  name: string;
  sub: string;
  avatar: string | null;
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
    points: r.points,
    views: r.views,
    posts: r.posts,
    followers: r.followers,
    score: r.score,
    engagement: r.views > 0 ? (r.likes + r.replies + r.reposts + r.quotes + r.bookmarks) / r.views : null,
    source: "x",
  }));
}

const BEST_KEY = "xyz:creators:hilo-best";

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function pickPair(pool: ArenaEntry[], keep?: ArenaEntry): [ArenaEntry, ArenaEntry] {
  const a = keep ?? pool[Math.floor(Math.random() * pool.length)]!;
  let b = a;
  // Avoid ties (no right answer) and the same entry twice.
  for (let i = 0; i < 40 && (b.id === a.id || b.points === a.points); i++) b = pool[Math.floor(Math.random() * pool.length)]!;
  return [a, b];
}

function HigherLower({ pool }: { pool: ArenaEntry[] }) {
  const [pair, setPair] = useState<[ArenaEntry, ArenaEntry] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [over, setOver] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBest(readBest()), 0);
    return () => clearTimeout(t);
  }, []);

  if (pool.length < 2) return <Empty>The game unlocks once at least two creators are on the board.</Empty>;

  const start = () => {
    setPair(pickPair(pool));
    setPicked(null);
    setStreak(0);
    setOver(false);
  };

  const choose = (id: string) => {
    if (!pair || picked) return;
    setPicked(id);
    const winner = pair[0].points > pair[1].points ? pair[0] : pair[1];
    const right = id === winner.id;
    setTimeout(() => {
      if (right) {
        const next = streak + 1;
        setStreak(next);
        if (next > best) {
          setBest(next);
          try {
            localStorage.setItem(BEST_KEY, String(next));
          } catch {
            /* storage blocked: best just isn't remembered */
          }
        }
        // The winner stays on as the next challenger's opponent.
        setPair(pickPair(pool, winner));
        setPicked(null);
      } else {
        setOver(true);
      }
    }, 1300);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-1 font-bold text-orange-300">
            <Flame className="h-3.5 w-3.5" /> Streak {streak}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-gold-400/15 px-2.5 py-1 font-bold text-gold-200">
            <Crown className="h-3.5 w-3.5" /> Best {best}
          </span>
        </div>
        {pair && (
          <button type="button" onClick={start} className="inline-flex items-center gap-1 text-xs text-content-subtle hover:text-content">
            <RotateCcw className="h-3.5 w-3.5" /> Restart
          </button>
        )}
      </div>

      {!pair ? (
        <div className="py-8 text-center">
          <p className="mx-auto max-w-md text-sm text-content-muted">Two creators. One question: who has more Variational points? Build the longest streak you can.</p>
          <button type="button" onClick={start} className="btn-primary mt-5 inline-flex items-center gap-2">
            <Zap className="h-4 w-4" /> Play
          </button>
        </div>
      ) : over ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-8 text-center">
          <Trophy className="mx-auto h-10 w-10 text-gold-300" />
          <div className="mt-3 font-display text-3xl font-bold text-content">{streak} in a row</div>
          <p className="mt-1 text-sm text-content-muted">{streak >= best && streak > 0 ? "New personal best." : `Your best is ${best}.`}</p>
          <button type="button" onClick={start} className="btn-primary mt-5 inline-flex items-center gap-2">
            <RotateCcw className="h-4 w-4" /> Play again
          </button>
        </motion.div>
      ) : (
        <div className="relative grid grid-cols-2 gap-3 sm:gap-5">
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-hairline bg-ink-900 text-xs font-black text-gold-300">
            VS
          </div>
          <AnimatePresence mode="popLayout">
            {pair.map((e) => {
              const win = picked && e.points === Math.max(pair[0].points, pair[1].points);
              const lose = picked && !win;
              return (
                <motion.button
                  key={e.id}
                  type="button"
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={picked ? undefined : { y: -4 }}
                  whileTap={picked ? undefined : { scale: 0.97 }}
                  onClick={() => choose(e.id)}
                  className={cn(
                    "flex flex-col items-center rounded-3xl border p-4 text-center transition-colors sm:p-6",
                    win ? "border-mint-400/70 bg-mint-400/10" : lose ? "border-red-400/40 bg-red-400/5" : "border-hairline bg-ink-900/40 hover:border-gold-400/40"
                  )}
                >
                  <Avatar src={e.avatar} alt={e.name} size={64} />
                  <div className="mt-3 w-full truncate text-sm font-semibold text-content">{e.name}</div>
                  <div className="w-full truncate text-xs text-content-subtle">{e.sub}</div>
                  <div className="mt-3 h-8 font-display text-2xl font-bold tabular-nums text-gold-300">{picked ? full(e.points) : "?"}</div>
                  <div className="text-[10px] uppercase tracking-wider text-content-subtle">points</div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

const METRICS: { key: keyof ArenaEntry; label: string; fmt: (n: number) => string }[] = [
  { key: "points", label: "Points", fmt: full },
  { key: "score", label: "XYZ Score", fmt: (n) => String(n) },
  { key: "views", label: "Views", fmt: compact },
  { key: "posts", label: "Posts", fmt: full },
  { key: "followers", label: "Followers", fmt: compact },
  { key: "engagement", label: "Engagement", fmt: (n) => pct(n, 2) },
];

function HeadToHead({ pool, initial }: { pool: ArenaEntry[]; initial: string | null }) {
  const [a, setA] = useState<string>(initial ?? pool[0]?.id ?? "");
  const [b, setB] = useState<string>(pool.find((p) => p.id !== (initial ?? pool[0]?.id))?.id ?? "");
  const A = pool.find((p) => p.id === a);
  const B = pool.find((p) => p.id === b);

  const wins = useMemo(() => {
    if (!A || !B) return [0, 0];
    let x = 0;
    let y = 0;
    for (const m of METRICS) {
      const va = (A[m.key] as number | null) ?? -1;
      const vb = (B[m.key] as number | null) ?? -1;
      if (va > vb) x++;
      else if (vb > va) y++;
    }
    return [x, y];
  }, [A, B]);

  if (pool.length < 2) return <Empty>Compare unlocks once at least two creators are on the board.</Empty>;

  const select = (value: string, set: (v: string) => void) => (
    <select
      value={value}
      onChange={(e) => set(e.target.value)}
      className="w-full rounded-xl border border-hairline bg-ink-900/70 px-3 py-2.5 text-sm text-content focus:border-gold-400/50 focus:outline-none"
    >
      {pool.slice(0, 300).map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );

  return (
    <div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {select(a, setA)}
        <Swords className="h-5 w-5 text-gold-300" />
        {select(b, setB)}
      </div>
      {A && B && (
        <div className="mt-5">
          <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
            <div className="flex flex-col items-center">
              <Avatar src={A.avatar} alt={A.name} size={56} ring={wins[0]! > wins[1]! ? "ring-2 ring-gold-400" : undefined} />
              <div className="mt-2 truncate text-sm font-semibold text-content">{A.name}</div>
            </div>
            <div className="font-display text-2xl font-bold tabular-nums text-content">
              {wins[0]} <span className="text-content-subtle">:</span> {wins[1]}
            </div>
            <div className="flex flex-col items-center">
              <Avatar src={B.avatar} alt={B.name} size={56} ring={wins[1]! > wins[0]! ? "ring-2 ring-gold-400" : undefined} />
              <div className="mt-2 truncate text-sm font-semibold text-content">{B.name}</div>
            </div>
          </div>
          <div className="space-y-3">
            {METRICS.map((m) => {
              const va = (A[m.key] as number | null) ?? 0;
              const vb = (B[m.key] as number | null) ?? 0;
              const total = va + vb || 1;
              return (
                <div key={m.key}>
                  <div className="mb-1 flex justify-between text-xs tabular-nums">
                    <span className={cn(va > vb ? "font-bold text-gold-200" : "text-content-muted")}>{m.fmt(va)}</span>
                    <span className="text-content-subtle">{m.label}</span>
                    <span className={cn(vb > va ? "font-bold text-gold-200" : "text-content-muted")}>{m.fmt(vb)}</span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-ink-700">
                    <motion.div className="h-full bg-gold-400" initial={{ width: "50%" }} animate={{ width: `${(va / total) * 100}%` }} transition={{ duration: 0.7 }} />
                    <motion.div className="h-full bg-mint-400" initial={{ width: "50%" }} animate={{ width: `${(vb / total) * 100}%` }} transition={{ duration: 0.7 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function Arena({ pool, compareWith }: { pool: ArenaEntry[]; compareWith: string | null }) {
  const usable = useMemo(() => pool.filter((p) => p.points > 0), [pool]);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel>
        <PanelTitle title="Higher or Lower" sub="Who has more Variational points?" right={<Zap className="h-4 w-4 text-gold-300" />} />
        <HigherLower pool={usable} />
      </Panel>
      <Panel>
        <PanelTitle title="Head to Head" sub="Any two creators, six stats" right={<Swords className="h-4 w-4 text-gold-300" />} />
        <HeadToHead key={compareWith ?? "none"} pool={usable} initial={compareWith ? `x:${compareWith}` : null} />
      </Panel>
    </div>
  );
}
