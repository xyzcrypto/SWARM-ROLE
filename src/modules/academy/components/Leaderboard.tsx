"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Crown, Loader2, Search, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { getJson, useAcademyPing, useMe, useTicker, type Me } from "../client/hooks";
import { say, sfx, unlock } from "../client/audio";
import type { VoiceLine } from "../client/voice-lines";
import type { Board, BoardRow } from "./types";
import { Avatar, Empty, fmt, Movement, Skeleton } from "./ui";

export type Period = "daily" | "weekly" | "monthly" | "alltime";
const PERIODS: { id: Period; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "alltime", label: "All-Time" },
];

function resetsIn(end: number) {
  const ms = end - Date.now();
  if (ms <= 0) return "resetting now";
  const h = Math.floor(ms / 3_600_000);
  const d = Math.floor(h / 24);
  if (d >= 1) return `resets in ${d}d ${h % 24}h`;
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `resets in ${h}h ${String(m).padStart(2, "0")}m`;
}

function Podium({ rows, meId }: { rows: BoardRow[]; meId?: string }) {
  const order = [rows[1], rows[0], rows[2]].filter(Boolean) as BoardRow[];
  // With one or two people on the board the podium stays centred, not pinned left.
  const cols = order.length === 1 ? "mx-auto max-w-[11rem] grid-cols-1" : order.length === 2 ? "mx-auto max-w-md grid-cols-2" : "grid-cols-3";
  return (
    <div className={cn("grid items-end gap-2 sm:gap-4", cols)}>
      {order.map((r) => {
        const first = r.rank === 1;
        return (
          <motion.div
            layout
            key={r.userId}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: first ? 0.15 : r.rank === 2 ? 0.05 : 0.25, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              `acad-podium-${r.rank} relative flex min-w-0 flex-col items-center rounded-3xl border px-2 pb-4 text-center sm:px-4`,
              first ? "pt-8 sm:pt-10" : "pt-6",
              r.userId === meId && "ring-1 ring-gold-300/70"
            )}
          >
            {first && <Crown className="absolute -top-4 h-8 w-8 text-gold-300 drop-shadow-[0_0_14px_rgba(226,167,47,0.7)]" strokeWidth={1.6} />}
            <div className="relative">
              <Avatar src={r.image} alt={r.name} size={first ? 68 : 52} className={cn("ring-2", first ? "ring-gold-300" : r.rank === 2 ? "ring-zinc-300/80" : "ring-amber-600/80")} />
              <span
                className={cn(
                  "absolute -bottom-2 left-1/2 grid h-6 w-6 -translate-x-1/2 place-items-center rounded-full font-mono text-[11px] font-bold text-ink-950",
                  first ? "bg-gold-300" : r.rank === 2 ? "bg-zinc-300" : "bg-amber-600"
                )}
              >
                {r.rank}
              </span>
            </div>
            <div className="mt-4 w-full truncate text-sm font-semibold text-content sm:text-base">{r.name}</div>
            <div className="text-[11px] text-content-subtle">{r.levelName}</div>
            <div className={cn("mt-2 font-display text-lg font-bold sm:text-2xl", first ? "text-gold-200" : "text-content")}>{fmt(r.xp)}</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-content-subtle">XP</div>
          </motion.div>
        );
      })}
    </div>
  );
}

function Row({ r, me }: { r: BoardRow; me: boolean }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
      className={cn("grid grid-cols-[2.25rem_1fr_auto] items-center gap-3 rounded-2xl px-3 py-2.5 sm:grid-cols-[2.5rem_1fr_5rem_5rem_4.5rem_3rem]", me ? "acad-me-row" : "hover:bg-white/[0.03]")}
    >
      <span className={cn("text-center font-mono text-sm font-bold", r.rank <= 3 ? "text-gold-300" : "text-content-subtle")}>{r.rank}</span>
      <div className="flex min-w-0 items-center gap-3">
        <Avatar src={r.image} alt={r.name} size={34} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-content">
            {r.username ? (
              <Link href={`/u/${r.username}`} className="hover:text-gold-200">
                {r.name}
              </Link>
            ) : (
              r.name
            )}
            {me && <span className="ml-2 rounded-full bg-gold-400/20 px-1.5 py-0.5 text-[10px] font-bold text-gold-200">YOU</span>}
          </div>
          <div className="text-[11px] text-content-subtle">
            Lv {r.level} · {r.levelName}
            <span className="sm:hidden"> · {r.quizzes} quizzes{r.accuracy != null ? ` · ${r.accuracy}%` : ""}</span>
          </div>
        </div>
      </div>
      <span className="hidden text-right font-mono text-xs text-content-muted sm:block">{fmt(r.quizzes)}</span>
      <span className="hidden text-right font-mono text-xs text-content-muted sm:block">{r.accuracy == null ? "–" : `${r.accuracy}%`}</span>
      <span className="text-right font-mono text-sm font-semibold text-gold-200">{fmt(r.xp)}</span>
      <span className="hidden text-right sm:block">
        <Movement value={r.movement} />
      </span>
    </motion.li>
  );
}

function MyPosition({ me, period }: { me: Me; period: Period }) {
  const s = me.standing[period];
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gold-400/30 bg-gold-400/[0.06] px-4 py-3">
      <Avatar src={me.user?.image ?? null} alt={me.user?.name ?? "You"} size={36} />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-300">Your position</div>
        <div className="truncate text-sm text-content">
          {s?.rank ? (
            <>
              <span className="font-display text-lg font-bold">#{fmt(s.rank)}</span> <span className="text-content-subtle">of {fmt(s.size)}</span>
            </>
          ) : (
            <span className="text-content-muted">Not ranked yet. Answer a question correctly to join.</span>
          )}
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-sm font-semibold text-gold-200">{fmt(s?.xp ?? 0)}</div>
        <div className="text-[10px] uppercase tracking-wide text-content-subtle">XP</div>
      </div>
    </div>
  );
}

export function LeaderboardView({ initialPeriod = "weekly", compact = false }: { initialPeriod?: Period; compact?: boolean }) {
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [board, setBoard] = useState<Board | null>(null);
  const [extra, setExtra] = useState<BoardRow[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<BoardRow[] | null>(null);
  const { me, reload: reloadMe } = useMe();
  useTicker(!compact, 30_000);

  const load = useCallback(
    async (p: Period) => {
      try {
        const b = await getJson<Board>(`/api/academy/leaderboard?period=${p}`);
        setBoard(b);
        setExtra([]);
        setPage(1);
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    []
  );

  useEffect(() => {
    setBoard(null);
    void load(period);
  }, [period, load]);

  // Someone earned XP: refetch the (edge-cached) board and my standing.
  useAcademyPing(() => {
    void load(period);
    if (!compact) void reloadMe();
  });

  useEffect(() => {
    if (compact || !me) return;
    const r = me.standing[period]?.rank;
    if (r && r <= 10) say("top10", { auto: true });
    // once per board visit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact, !!me]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(null);
      return;
    }
    const id = setTimeout(async () => {
      try {
        const r = await getJson<{ results: BoardRow[] }>(`/api/academy/leaderboard?period=${period}&q=${encodeURIComponent(term)}`);
        setResults(r.results);
      } catch {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [q, period]);

  const more = async () => {
    setLoading(true);
    try {
      const b = await getJson<Board>(`/api/academy/leaderboard?period=${period}&page=${page + 1}`);
      setExtra((x) => [...x, ...b.rows]);
      setPage(page + 1);
    } finally {
      setLoading(false);
    }
  };

  const rows = useMemo(() => [...(board?.rows ?? []), ...extra], [board, extra]);
  const top = compact ? rows.slice(0, 3) : rows.slice(0, 3);
  const rest = compact ? rows.slice(3, 8) : rows.slice(3);
  const meId = me?.user?.id;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-full border border-hairline bg-ink-900/60 p-1" role="tablist" aria-label="Leaderboard period">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={period === p.id}
              onClick={() => {
                unlock();
                sfx("click");
                setPeriod(p.id);
                if (!compact) say(`board_${p.id}` as VoiceLine, { auto: true });
              }}
              className={cn("relative rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors", period === p.id ? "text-ink-950" : "text-content-muted hover:text-content")}
            >
              {period === p.id && <motion.span layoutId={compact ? "lb-tab-c" : "lb-tab"} className="absolute inset-0 rounded-full bg-gold-300" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
              <span className="relative">{p.label}</span>
            </button>
          ))}
        </div>
        {board && period !== "alltime" && <span className="text-[11px] text-content-subtle">UTC · {resetsIn(board.end)}</span>}
        {!compact && (
          <label className="relative ml-auto w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by username"
              aria-label="Search the leaderboard by username"
              className="w-full rounded-xl border border-hairline bg-ink-900/60 py-2 pl-9 pr-3 text-sm text-content placeholder:text-content-subtle focus:border-gold-400/50 focus:outline-none"
            />
          </label>
        )}
      </div>

      {!compact && me && (
        <div className="mt-4">
          <MyPosition me={me} period={period} />
        </div>
      )}

      {results ? (
        <div className="mt-5">
          {results.length ? (
            <ul className="space-y-1">
              {results.map((r) => (
                <Row key={r.userId} r={r} me={r.userId === meId} />
              ))}
            </ul>
          ) : (
            <Empty>No ranked learner matches “{q}” on this board.</Empty>
          )}
        </div>
      ) : error ? (
        <Empty className="mt-5">
          Could not load the leaderboard. {error}{" "}
          <button type="button" className="font-semibold text-gold-300" onClick={() => load(period)}>
            Retry
          </button>
        </Empty>
      ) : !board ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : rows.length === 0 ? (
        <Empty className="mt-6">
          <Trophy className="mx-auto mb-2 h-6 w-6 text-gold-300" />
          Nobody has earned XP {period === "daily" ? "today" : period === "weekly" ? "this week" : period === "monthly" ? "this month" : "yet"}. The first correct answer takes the top spot.
          <div className="mt-3">
            <Link href="/academy/quiz" className="btn-primary h-10 px-5 text-sm">
              Play a quiz
            </Link>
          </div>
        </Empty>
      ) : (
        <LayoutGroup>
          <div className={cn(compact ? "mt-8" : "mt-10")}>
            <Podium rows={top} meId={meId} />
          </div>
          {rest.length > 0 && (
            <>
              <div className="mt-6 hidden grid-cols-[2.5rem_1fr_5rem_5rem_4.5rem_3rem] gap-3 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-content-subtle sm:grid">
                <span className="text-center">#</span>
                <span>Learner</span>
                <span className="text-right">Quizzes</span>
                <span className="text-right">Accuracy</span>
                <span className="text-right">XP</span>
                <span className="text-right">Move</span>
              </div>
              <ul className="mt-2 space-y-1">
                <AnimatePresence initial={false}>
                  {rest.map((r) => (
                    <Row key={r.userId} r={r} me={r.userId === meId} />
                  ))}
                </AnimatePresence>
              </ul>
            </>
          )}
          {!compact && board.size > rows.length && (
            <div className="mt-5 flex justify-center">
              <button type="button" onClick={more} disabled={loading} className="btn-secondary h-10 px-5 text-sm">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Show more ({fmt(board.size - rows.length)} more)
              </button>
            </div>
          )}
          {compact && (
            <div className="mt-5 flex justify-center">
              <Link href={`/academy/leaderboard?period=${period}`} className="btn-ghost h-10 px-5 text-sm">
                Full leaderboard
              </Link>
            </div>
          )}
        </LayoutGroup>
      )}
    </div>
  );
}
