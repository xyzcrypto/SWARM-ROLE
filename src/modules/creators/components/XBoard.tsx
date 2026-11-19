"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AtSign, BadgeCheck, ChevronRight, EyeOff, Loader2, Radar } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import type { Board, BoardRow, XWindow } from "@modules/creators/lib/x-index";
import { LEVELS, POINT_WEIGHTS, compact, full, scoreTier } from "@modules/creators/lib/game";
import { matchesQuery } from "@modules/creators/lib/scoring";
import { Avatar, Chip, CountUp, Empty, LevelChip, Panel, PanelTitle, RankMark, SearchBox, Stat } from "./ui";

export type BoardState = { status: "loading" } | { status: "ready"; board: Board } | { status: "error" };
type Sort = "points" | "score" | "views" | "posts" | "followers";

const SORTS: [Sort, string][] = [
  ["points", "Points"],
  ["score", "XYZ Score"],
  ["views", "Views"],
  ["posts", "Posts"],
  ["followers", "Followers"],
];

const TONE: Record<string, string> = {
  gold: "bg-gold-400/15 text-gold-200",
  mint: "bg-mint-400/15 text-mint-300",
  sky: "bg-sky-400/15 text-sky-300",
  muted: "bg-ink-700 text-content-muted",
};

function ScoreChip({ v }: { v: number }) {
  const t = scoreTier(v);
  return (
    <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums", TONE[t.tone])} title={`XYZ Score: ${t.label}`}>
      {v} XYZ
    </span>
  );
}

export function XBoard({
  state,
  win,
  setWin,
  onOpen,
  isAdmin,
  onHide,
}: {
  state: BoardState;
  win: XWindow;
  setWin: (w: XWindow) => void;
  onOpen: (handle: string) => void;
  isAdmin: boolean;
  onHide: (handle: string) => void;
}) {
  const [handle, setHandle] = useState("");
  const [bad, setBad] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("points");
  const [level, setLevel] = useState<number | null>(null);
  const [limit, setLimit] = useState(50);

  const board = state.status === "ready" ? state.board : null;

  const rows = useMemo(() => {
    if (!board) return [] as BoardRow[];
    const list = board.rows.filter((r) => (level ? r.level === level : true) && matchesQuery(q, r.handle, r.name));
    const by: Record<Sort, (a: BoardRow, b: BoardRow) => number> = {
      points: (a, b) => b.points - a.points,
      score: (a, b) => b.score - a.score || b.points - a.points,
      views: (a, b) => b.views - a.views,
      posts: (a, b) => b.posts - a.posts,
      followers: (a, b) => b.followers - a.followers,
    };
    return [...list].sort(by[sort]);
  }, [board, level, q, sort]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const h = handle.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "").split(/[/?#]/)[0] ?? "";
    if (!/^[A-Za-z0-9_]{1,15}$/.test(h)) return setBad(true);
    setBad(false);
    onOpen(h);
  };

  return (
    <div className="space-y-6">
      {/* Scan */}
      <Panel className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gold-400/10 blur-3xl" />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-mint-300">Proof of Variational</p>
          <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-content sm:text-3xl">How much has an account helped Variational grow on X?</h2>
          <p className="mt-2 max-w-2xl text-sm text-content-muted">
            Type any X handle and hit Scan, or tap anyone on the leaderboard. We read their Variational posts, score them, and give you a
            profile card to share.
          </p>
          <form onSubmit={submit} className="mt-5 flex flex-col gap-2 sm:flex-row">
            <label className="relative flex-1">
              <AtSign className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gold-300" />
              <input
                value={handle}
                onChange={(e) => {
                  setHandle(e.target.value);
                  setBad(false);
                }}
                placeholder="your_x_handle"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-label="X handle"
                className={cn(
                  "w-full rounded-2xl border bg-ink-900/70 py-3 pl-10 pr-3 font-mono text-base text-content placeholder:text-content-subtle focus:outline-none",
                  bad ? "border-red-400/60" : "border-hairline focus:border-gold-400/60"
                )}
              />
            </label>
            <button type="submit" className="btn-primary inline-flex items-center justify-center gap-2 px-6">
              <Radar className="h-4 w-4" /> Scan
            </button>
          </form>
          {bad && <p className="mt-2 text-xs text-red-300">That doesn&apos;t look like an X handle. Letters, numbers and _ only, up to 15.</p>}
          {board && (
            <div className="mt-4 inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-full border border-hairline bg-ink-900/60 px-3.5 py-1.5 font-mono text-[11px] text-content-subtle">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-mint-400" />
              </span>
              <span>Last index: {board.sync.lastIndexAt ? `${formatDateTime(board.sync.lastIndexAt)} UTC` : "not yet"}</span>
              <span>· Checked in 24h: {full(board.sync.checked24h)}</span>
              <span>· Older posts refresh in rotation</span>
            </div>
          )}
        </div>
      </Panel>

      {state.status === "loading" && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-content-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading the board
        </div>
      )}
      {state.status === "error" && <Empty>The board didn&apos;t load. Please refresh the page.</Empty>}

      {board && !board.configured && board.rows.length === 0 && (
        <Empty>X data isn&apos;t switched on yet. The board fills up as soon as the site&apos;s X data key is added. Until then it shows nothing rather than made-up numbers.</Empty>
      )}

      {board && (board.configured || board.rows.length > 0) && (
        <>
          {/* Totals */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Accounts ranked" value={<CountUp value={board.totals.accounts} format={full} />} />
            <Stat label="Posts indexed" value={<CountUp value={board.totals.posts} format={full} />} />
            <Stat label="Total views" value={<CountUp value={board.totals.views} format={compact} />} />
            <Stat label="Points earned" value={<CountUp value={board.totals.points} format={compact} />} accent />
          </div>

          {/* Levels */}
          <Panel>
            <PanelTitle title="Levels" sub="Tap a level to filter the leaderboard" right={level ? <Chip active onClick={() => setLevel(null)}>Clear filter</Chip> : null} />
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {board.levels.map((l, i) => (
                <motion.button
                  key={l.n}
                  type="button"
                  onClick={() => setLevel(level === l.n ? null : l.n)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{ y: -2 }}
                  className={cn(
                    "rounded-2xl border p-3.5 text-left transition-colors",
                    level === l.n ? "border-gold-400/60 bg-gold-400/10" : "border-hairline bg-ink-900/40 hover:border-gold-400/30"
                  )}
                >
                  <div className="text-sm font-semibold text-gold-200">
                    Level {l.n} · {l.name}
                  </div>
                  <div className="mt-0.5 text-xs tabular-nums text-content-subtle">
                    {full(l.min)}
                    {l.max != null ? `-${full(l.max)}` : "+"} pts
                  </div>
                  <div className="mt-2 font-display text-lg font-bold text-mint-300">
                    {full(l.accounts)} <span className="text-xs font-semibold text-content-subtle">accounts</span>
                  </div>
                </motion.button>
              ))}
            </div>
          </Panel>

          {/* Leaderboard */}
          <Panel>
            <PanelTitle
              title="Top Variational creators"
              sub={`${full(rows.length)} accounts${level ? ` at Level ${level}` : ""}`}
              right={
                <div className="flex flex-wrap gap-1.5">
                  {(["7d", "30d", "all"] as XWindow[]).map((w) => (
                    <Chip key={w} active={win === w} onClick={() => setWin(w)}>
                      {w === "all" ? "All time" : w}
                    </Chip>
                  ))}
                </div>
              }
            />
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SearchBox value={q} onChange={setQ} placeholder="Find a handle" />
              <div className="flex flex-wrap gap-1.5">
                {SORTS.map(([k, l]) => (
                  <Chip key={k} active={sort === k} onClick={() => setSort(k)}>
                    {l}
                  </Chip>
                ))}
              </div>
            </div>

            {rows.length === 0 ? (
              <Empty>{q || level ? "Nobody matches that filter." : "No posts in this window yet. Scan a handle above to add one."}</Empty>
            ) : (
              <ol className="divide-y divide-hairline">
                <AnimatePresence initial={false}>
                  {rows.slice(0, limit).map((r, i) => (
                    <motion.li
                      key={r.handle}
                      layout
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25, delay: Math.min(i, 12) * 0.02 }}
                      className="group relative"
                    >
                      <button type="button" onClick={() => onOpen(r.handle)} className="flex w-full items-center gap-3 rounded-xl px-1 py-2.5 text-left transition-colors hover:bg-ink-800/50">
                        <RankMark rank={sort === "points" && !level && !q ? r.rank : i + 1} />
                        <Avatar src={r.avatar} alt={r.handle} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-semibold text-content group-hover:text-gold-200">@{r.handle}</span>
                            {r.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-sky-400" aria-label="Verified" />}
                            <span className="hidden sm:inline">
                              <LevelChip n={r.level} compact />
                            </span>
                            <ScoreChip v={r.score} />
                          </div>
                          <div className="truncate text-xs text-content-subtle">
                            {full(r.posts)} posts · {compact(r.views)} views · {compact(r.followers)} followers
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-display text-base font-bold tabular-nums text-gold-300">{full(r.points)}</div>
                          <div className="text-[10px] uppercase tracking-wider text-content-subtle">points</div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-content-subtle transition-transform group-hover:translate-x-0.5 group-active:translate-x-0.5" />
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => onHide(r.handle)}
                          title="Remove from board"
                          className="absolute right-8 top-1/2 hidden -translate-y-1/2 rounded-full p-1.5 text-content-subtle hover:text-red-300 group-hover:block"
                        >
                          <EyeOff className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ol>
            )}
            {rows.length > limit && (
              <div className="mt-4 text-center">
                <button type="button" className="btn-ghost" onClick={() => setLimit((n) => n + 100)}>
                  Show more ({full(rows.length - limit)} left)
                </button>
              </div>
            )}
          </Panel>

          <p className="text-xs leading-relaxed text-content-subtle">
            Posts that mention Variational, @variational_io or variational.io on X, read through twitterapi.io. Reposts don&apos;t count, and
            Variational&apos;s own accounts aren&apos;t ranked. Points = views × {POINT_WEIGHTS.views} + likes + replies × {POINT_WEIGHTS.replies} +
            reposts × {POINT_WEIGHTS.reposts} + quotes × {POINT_WEIGHTS.quotes} + bookmarks × {POINT_WEIGHTS.bookmarks}. Levels:{" "}
            {LEVELS.map((l) => `L${l.n} ${l.name} ${full(l.min)}+`).join(", ")}. XYZ Score (0-1000) adds four equal parts: reach (followers),
            resonance (engagement per view), consistency (active weeks of the last 12) and impact (average views per post).
          </p>
        </>
      )}
    </div>
  );
}
