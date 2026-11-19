"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, ArrowUpRight, BadgeCheck, ChevronRight, Download, EyeOff, Flame, Loader2, Star, TrendingUp, X as Close } from "lucide-react";
import { cn, formatDate, formatDateTime, csvCell } from "@/lib/utils";
import type { Board, BoardRow, VenueFilter, XWindow } from "@modules/creators/lib/x-index";
import { VENUES, type VenueId } from "@modules/creators/lib/twitterapi";
import { LEVELS, POINT_WEIGHTS, compact, full, pct, scoreTier } from "@modules/creators/lib/game";
import { matchesQuery } from "@modules/creators/lib/scoring";
import { Avatar, Chip, CountUp, Empty, LevelChip, Panel, PanelTitle, RankMark, Refreshing, SearchBox, Sparkbars, Stat } from "./ui";

export type BoardState = { status: "loading" } | { status: "ready"; board: Board; refreshing: boolean } | { status: "error" };
type Sort = "points" | "score" | "views" | "posts" | "followers" | "engagement";

const SORTS: [Sort, string][] = [
  ["points", "Points"],
  ["score", "XYZ Score"],
  ["views", "Views"],
  ["engagement", "Engagement"],
  ["posts", "Posts"],
  ["followers", "Followers"],
];

const TONE: Record<string, string> = {
  gold: "bg-gold-400/15 text-gold-200",
  mint: "bg-mint-400/15 text-mint-300",
  sky: "bg-sky-400/15 text-sky-300",
  muted: "bg-ink-700 text-content-muted",
};

const engRate = (r: BoardRow) => (r.views > 0 ? (r.likes + r.replies + r.reposts + r.quotes + r.bookmarks) / r.views : 0);

function ScoreChip({ v }: { v: number }) {
  const t = scoreTier(v);
  return (
    <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums", TONE[t.tone])} title={`XYZ Score: ${t.label}`}>
      {v} XYZ
    </span>
  );
}

/** Rank change against a week ago. */
function Move({ m }: { m: number | null }) {
  if (m == null) return <span className="hidden w-10 shrink-0 text-center text-[10px] font-bold uppercase tracking-wider text-sky-300 sm:inline">New</span>;
  if (m === 0) return <span className="hidden w-10 shrink-0 text-center text-xs text-content-subtle sm:inline">-</span>;
  return (
    <span className={cn("inline-flex w-10 shrink-0 items-center justify-center gap-0.5 text-xs font-bold tabular-nums", m > 0 ? "text-mint-300" : "text-red-400")} title={`${m > 0 ? "Up" : "Down"} ${Math.abs(m)} since last week`}>
      {m > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(m)}
    </span>
  );
}

export function venueLabel(v: VenueFilter): string {
  return v === "all" ? "All venues" : (VENUES.find((x) => x.id === v)?.label ?? v);
}

function exportCsv(rows: BoardRow[], venue: VenueFilter, win: XWindow) {
  const head = ["rank", "handle", "name", "points", "xyz_score", "level", "posts", "views", "likes", "replies", "reposts", "quotes", "bookmarks", "followers"];
  const lines = rows.map((r) =>
    [r.rank, r.handle, r.name, r.points, r.score, r.level, r.posts, r.views, r.likes, r.replies, r.reposts, r.quotes, r.bookmarks, r.followers].map(csvCell).join(",")
  );
  const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `xyz-creators-${venue}-${win}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function XBoard({
  state,
  venue,
  win,
  setWin,
  replies,
  setReplies,
  onOpen,
  isAdmin,
  onHide,
  watch,
  toggleWatch,
  recents,
  clearRecents,
}: {
  state: BoardState;
  venue: VenueFilter;
  win: XWindow;
  setWin: (w: XWindow) => void;
  replies: boolean;
  setReplies: (v: boolean) => void;
  onOpen: (handle: string) => void;
  isAdmin: boolean;
  onHide: (handle: string) => void;
  watch: string[];
  toggleWatch: (handle: string) => void;
  recents: string[];
  clearRecents: () => void;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("points");
  const [level, setLevel] = useState<number | null>(null);
  const [onlyWatch, setOnlyWatch] = useState(false);
  const [limit, setLimit] = useState(50);
  const [postLimit, setPostLimit] = useState(6);

  const board = state.status === "ready" ? state.board : null;
  const watchSet = useMemo(() => new Set(watch.map((h) => h.toLowerCase())), [watch]);

  const rows = useMemo(() => {
    if (!board) return [] as BoardRow[];
    const list = board.rows.filter(
      (r) => (level ? r.level === level : true) && (!onlyWatch || watchSet.has(r.handle.toLowerCase())) && matchesQuery(q, r.handle, r.name)
    );
    const by: Record<Sort, (a: BoardRow, b: BoardRow) => number> = {
      points: (a, b) => b.points - a.points,
      score: (a, b) => b.score - a.score || b.points - a.points,
      views: (a, b) => b.views - a.views,
      posts: (a, b) => b.posts - a.posts,
      followers: (a, b) => b.followers - a.followers,
      engagement: (a, b) => engRate(b) - engRate(a),
    };
    return [...list].sort(by[sort]);
  }, [board, level, q, sort, onlyWatch, watchSet]);

  const spotlight = useMemo(() => {
    const r = board?.rising[0];
    if (!r) return null;
    const h = r.handle.toLowerCase();
    return {
      r,
      row: board?.rows.find((x) => x.handle.toLowerCase() === h) ?? null,
      post: board?.topPosts.find((p) => p.handle.toLowerCase() === h) ?? board?.latest.find((p) => p.handle.toLowerCase() === h) ?? null,
    };
  }, [board]);

  const plain = sort === "points" && !level && !q && !onlyWatch;
  const avgEng = board && board.totals.views > 0 ? board.totals.engagements / board.totals.views : 0;
  const today = board?.daily[board.daily.length - 1];

  return (
    <div className="space-y-6">
      {/* Status: what the board is built from and how fresh it is */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {board ? (
          <div className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-full border border-hairline bg-ink-900/60 px-3.5 py-1.5 font-mono text-[11px] text-content-subtle">
            <span className="relative flex h-2 w-2">
              <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-60", board.configured ? "animate-ping bg-mint-400" : "bg-content-subtle")} />
              <span className={cn("relative inline-flex h-2 w-2 rounded-full", board.configured ? "bg-mint-400" : "bg-content-subtle")} />
            </span>
            <span>Indexed {board.sync.lastIndexAt ? `${formatDateTime(board.sync.lastIndexAt)} UTC` : "not yet"}</span>
            <span>· {full(board.sync.checked24h)} posts re-read in 24h</span>
            {board.sync.backfilledTo && <span>· history back to {formatDate(board.sync.backfilledTo)}</span>}
            <span>· refreshes itself</span>
          </div>
        ) : (
          <span />
        )}
        {recents.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-content-subtle">Recent</span>
            {recents.slice(0, 6).map((h) => (
              <button key={h} type="button" onClick={() => onOpen(h)} className="rounded-full border border-hairline px-2.5 py-1 text-[11px] text-content-muted transition-colors hover:border-gold-400/40 hover:text-content">
                @{h}
              </button>
            ))}
            <button type="button" onClick={clearRecents} aria-label="Clear recent scans" className="rounded-full p-1 text-content-subtle hover:text-content">
              <Close className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {board?.sync.lastError && (
        <p className="rounded-xl border border-red-400/30 bg-red-400/5 px-3 py-2 text-xs text-red-300">
          The X data feed reported a problem, so numbers may be behind: <span className="font-mono">{board.sync.lastError}</span>
        </p>
      )}

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
        <div className={cn("space-y-6 transition-opacity duration-300", state.status === "ready" && state.refreshing && "opacity-70")}>
          <Refreshing on={state.status === "ready" && state.refreshing} />

          {/* Totals */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat label="Posts indexed" value={<CountUp value={board.totals.posts} format={full} />} />
            <Stat label="Views per post" value={board.totals.posts ? compact(board.totals.views / board.totals.posts) : "-"} />
            <Stat label="Active this week" value={<CountUp value={board.active7d ?? 0} format={full} />} sub="creators who posted" />
            <Stat label="Engagement" value={pct(avgEng, 2)} sub="per view, all posts" />
            <Stat label="Points earned" value={<CountUp value={board.totals.points} format={compact} />} accent />
          </div>

          {/* Spotlight + conversation */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {spotlight ? (
              <Panel className="flex flex-col lg:col-span-3">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-4">
                    <Avatar src={spotlight.row?.avatar ?? spotlight.r.avatar} alt={spotlight.r.handle} size={64} ring="ring-1 ring-gold-400/50" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-400">Creator of the week</p>
                      <button type="button" onClick={() => onOpen(spotlight.r.handle)} className="mt-0.5 block max-w-full truncate text-left font-display text-xl font-bold tracking-tight text-content hover:text-gold-200">
                        {spotlight.r.name}
                      </button>
                      <p className="truncate text-xs text-content-subtle">@{spotlight.r.handle}</p>
                    </div>
                  </div>
                  <div className="grid flex-1 grid-cols-3 gap-2 sm:ml-auto sm:max-w-sm">
                    <div className="rounded-2xl bg-ink-800/60 px-3 py-2.5 text-center">
                      <div className="font-display text-lg font-bold tabular-nums text-mint-300">+{compact(spotlight.r.points)}</div>
                      <div className="text-[10px] uppercase tracking-wider text-content-subtle">pts 7d</div>
                    </div>
                    <div className="rounded-2xl bg-ink-800/60 px-3 py-2.5 text-center">
                      <div className="font-display text-lg font-bold tabular-nums text-content">{full(spotlight.r.posts)}</div>
                      <div className="text-[10px] uppercase tracking-wider text-content-subtle">posts 7d</div>
                    </div>
                    <div className="rounded-2xl bg-ink-800/60 px-3 py-2.5 text-center">
                      <div className="font-display text-lg font-bold tabular-nums text-gold-300">{spotlight.row ? `#${spotlight.row.rank}` : "-"}</div>
                      <div className="text-[10px] uppercase tracking-wider text-content-subtle">rank</div>
                    </div>
                  </div>
                </div>
                {spotlight.post && (
                  <figure className="mt-5 flex-1 rounded-2xl border border-hairline bg-ink-900/40 p-4">
                    <figcaption className="mb-2 flex items-center justify-between gap-2 text-[11px] text-content-subtle">
                      <span>Their best post in this window</span>
                      <span className="font-semibold tabular-nums text-gold-300">{compact(spotlight.post.points)} pts</span>
                    </figcaption>
                    <blockquote className="line-clamp-4 whitespace-pre-line break-words text-sm leading-relaxed text-content-muted">{spotlight.post.text}</blockquote>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tabular-nums text-content-subtle">
                      <span>{compact(spotlight.post.views)} views</span>
                      <span>{compact(spotlight.post.likes)} likes</span>
                      <span>{compact(spotlight.post.replies)} replies</span>
                      <a href={spotlight.post.url} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-gold-300 hover:text-gold-200">
                        Open on X <ArrowUpRight className="h-3 w-3" />
                      </a>
                    </div>
                  </figure>
                )}
                <button type="button" onClick={() => onOpen(spotlight.r.handle)} className="btn-ghost mt-4 self-start">
                  View full profile
                </button>
              </Panel>
            ) : (
              <div className="hidden lg:col-span-3 lg:block" />
            )}
            <Panel className="lg:col-span-2">
              <PanelTitle title="What people talk about" sub="Posts mentioning each topic, last 30 days" />
              {board.topics.every((t) => t.posts === 0) ? (
                <p className="text-sm text-content-muted">Not enough posts yet.</p>
              ) : (
                <div className="space-y-2">
                  {board.topics.slice(0, 6).map((t) => {
                    const max = Math.max(1, board.topics[0]!.posts);
                    return (
                      <div key={t.term} className="grid grid-cols-[72px_minmax(0,1fr)_40px] items-center gap-2 text-xs">
                        <span className="truncate font-semibold text-content-muted">{t.term}</span>
                        <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
                          <motion.div className="h-full rounded-full bg-gold-400" initial={{ width: 0 }} animate={{ width: `${(t.posts / max) * 100}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
                        </div>
                        <span className="text-right tabular-nums text-content-subtle">{full(t.posts)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>

          {/* Activity + rising */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <Panel className="flex flex-col lg:col-span-3">
              <PanelTitle
                title="Activity"
                sub={`Posts per day about ${venueLabel(venue)}, last 30 days (UTC)`}
                right={today ? <span className="text-xs text-content-subtle">Today: {full(today.posts)} posts · {full(today.creators)} creators</span> : null}
              />
              <Sparkbars
                values={board.daily.map((d) => d.posts)}
                titles={board.daily.map((d) => `${d.day}: ${full(d.posts)} posts, ${compact(d.views)} views, ${full(d.creators)} creators`)}
                height={190}
              />
              <div className="mt-2 flex justify-between text-[10px] text-content-subtle">
                <span>{board.daily[0]?.day}</span>
                <span>{board.daily[board.daily.length - 1]?.day}</span>
              </div>
              <div className="mt-auto grid grid-cols-3 gap-3 border-t border-hairline pt-4">
                {(
                  [
                    ["Posts, 30d", full(board.daily.reduce((a, d) => a + d.posts, 0))],
                    ["Views, 30d", compact(board.daily.reduce((a, d) => a + d.views, 0))],
                    ["Busiest day", (() => { const d = [...board.daily].sort((x, y) => y.posts - x.posts)[0]; return d && d.posts ? `${d.day.slice(5)} · ${d.posts}` : "-"; })()],
                  ] as const
                ).map(([l, v]) => (
                  <div key={l} className="min-w-0">
                    <div className="truncate text-[11px] text-content-subtle">{l}</div>
                    <div className="mt-0.5 truncate font-display text-base font-bold tabular-nums text-content">{v}</div>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel className="lg:col-span-2">
              <PanelTitle title="Rising this week" sub="Most points earned in the last 7 days" right={<TrendingUp className="h-4 w-4 text-mint-300" />} />
              {board.rising.length === 0 ? (
                <p className="text-sm text-content-muted">No posts in the last 7 days yet.</p>
              ) : (
                <ol className="space-y-1">
                  {board.rising.slice(0, 7).map((r, i) => (
                    <li key={r.handle}>
                      <button type="button" onClick={() => onOpen(r.handle)} className="flex w-full items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-left hover:bg-ink-800/50">
                        <span className="w-4 text-xs font-bold tabular-nums text-content-subtle">{i + 1}</span>
                        <Avatar src={r.avatar} alt={r.handle} size={28} />
                        <span className="min-w-0 flex-1 truncate text-sm text-content">@{r.handle}</span>
                        <span className="inline-flex items-center gap-1 text-xs font-bold tabular-nums text-mint-300">
                          <Flame className="h-3 w-3" />+{compact(r.points)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </div>

          {/* Share of voice */}
          {board.rows.length > 1 && board.totals.points > 0 && (
            <Panel>
              <PanelTitle title="Share of voice" sub="Each creator's share of all points earned in this window" />
              {(() => {
                const top = board.rows.slice(0, 8);
                const others = Math.max(0, board.totals.points - top.reduce((a, r) => a + r.points, 0));
                const segs = [...top.map((r) => ({ k: r.handle, v: r.points })), ...(others > 0 ? [{ k: "Everyone else", v: others }] : [])];
                const tones = ["bg-gold-300", "bg-gold-400", "bg-gold-500", "bg-gold-600", "bg-mint-300", "bg-mint-400", "bg-mint-500", "bg-mint-600", "bg-ink-500"];
                return (
                  <>
                    <div className="flex h-3 w-full overflow-hidden rounded-full bg-ink-700">
                      {segs.map((sg, i) => (
                        <motion.div
                          key={sg.k}
                          title={`${sg.k}: ${pct(sg.v / board.totals.points)}`}
                          className={cn("h-full", sg.k === "Everyone else" ? tones[8] : tones[i])}
                          initial={{ width: 0 }}
                          animate={{ width: `${(sg.v / board.totals.points) * 100}%` }}
                          transition={{ duration: 0.8, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                        />
                      ))}
                    </div>
                    <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                      {segs.map((sg, i) => (
                        <li key={sg.k} className="flex min-w-0 items-center gap-2 text-xs">
                          <span className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", sg.k === "Everyone else" ? tones[8] : tones[i])} />
                          {sg.k === "Everyone else" ? (
                            <span className="min-w-0 flex-1 truncate text-content-muted">Everyone else</span>
                          ) : (
                            <button type="button" onClick={() => onOpen(sg.k)} className="min-w-0 flex-1 truncate text-left text-content hover:text-gold-200">
                              @{sg.k}
                            </button>
                          )}
                          <span className="shrink-0 tabular-nums text-content-subtle">{pct(sg.v / board.totals.points)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                );
              })()}
            </Panel>
          )}

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
                  whileTap={{ scale: 0.98 }}
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
              title={`Top ${venue === "all" ? "perp DEX" : venueLabel(venue)} creators`}
              sub={`${full(rows.length)} accounts${level ? ` at Level ${level}` : ""}${onlyWatch ? " on your watchlist" : ""}`}
              right={
                <div className="flex flex-wrap items-center gap-1.5">
                  {(["7d", "30d", "all"] as XWindow[]).map((w) => (
                    <Chip key={w} active={win === w} onClick={() => setWin(w)}>
                      {w === "all" ? "All time" : w}
                    </Chip>
                  ))}
                  <button type="button" onClick={() => exportCsv(rows, venue, win)} title="Download as CSV" className="rounded-full border border-hairline p-1.5 text-content-subtle hover:text-content">
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </div>
              }
            />
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <SearchBox value={q} onChange={setQ} placeholder="Find a handle" />
              <div className="flex flex-wrap gap-1.5">
                <Chip active={replies} onClick={() => setReplies(!replies)} title="Count replies too (off: original posts and quotes only)">
                  {replies ? "Replies counted" : "Originals only"}
                </Chip>
                <Chip active={onlyWatch} onClick={() => setOnlyWatch((x) => !x)} title="Creators you starred">
                  <span className="inline-flex items-center gap-1">
                    <Star className={cn("h-3 w-3", onlyWatch && "fill-current")} /> Watchlist {watch.length ? `(${watch.length})` : ""}
                  </span>
                </Chip>
                {SORTS.map(([k, l]) => (
                  <Chip key={k} active={sort === k} onClick={() => setSort(k)}>
                    {l}
                  </Chip>
                ))}
              </div>
            </div>

            {rows.length === 0 ? (
              <Empty>
                {onlyWatch
                  ? "Your watchlist is empty here. Tap the star on any creator to follow them."
                  : q || level
                    ? "Nobody matches that filter."
                    : "No posts in this window yet. Scan a handle above to add one."}
              </Empty>
            ) : (
              <ol className="divide-y divide-hairline">
                <AnimatePresence initial={false}>
                  {rows.slice(0, limit).map((r, i) => {
                    const starred = watchSet.has(r.handle.toLowerCase());
                    return (
                      <motion.li
                        key={r.handle}
                        layout
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25, delay: Math.min(i, 12) * 0.02 }}
                        className="group relative flex items-center"
                      >
                        <button
                          type="button"
                          onClick={() => toggleWatch(r.handle)}
                          aria-label={starred ? `Unstar @${r.handle}` : `Star @${r.handle}`}
                          className={cn("shrink-0 rounded-full p-1.5 transition-colors", starred ? "text-gold-300" : "text-content-subtle/50 hover:text-gold-300")}
                        >
                          <Star className={cn("h-3.5 w-3.5", starred && "fill-current")} />
                        </button>
                        <button type="button" onClick={() => onOpen(r.handle)} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-2.5 text-left transition-colors hover:bg-ink-800/50">
                          <RankMark rank={plain ? r.rank : i + 1} />
                          <Avatar src={r.avatar} alt={r.handle} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="min-w-0 truncate text-sm font-semibold text-content group-hover:text-gold-200">@{r.handle}</span>
                              {r.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-sky-400" aria-label="Verified" />}
                              <span className="hidden sm:inline">
                                <LevelChip n={r.level} compact />
                              </span>
                              <ScoreChip v={r.score} />
                            </div>
                            <div className="truncate text-xs text-content-subtle">
                              {full(r.posts)} posts · {compact(r.views)} views · {pct(engRate(r))} eng · {compact(r.followers)} followers
                            </div>
                          </div>
                          <Move m={r.move} />
                          <div className="w-[72px] shrink-0 text-right sm:w-20">
                            <div className="font-display text-base font-bold tabular-nums text-gold-300">{full(r.points)}</div>
                            <div className="text-[10px] uppercase tracking-wider text-content-subtle">{plain ? "points" : `#${r.rank} · pts`}</div>
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
                    );
                  })}
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
            {board.totals.accounts > board.rows.length && (
              <p className="mt-3 text-center text-[11px] text-content-subtle">
                Showing the top {full(board.rows.length)} of {full(board.totals.accounts)}. Scan any handle to see its exact rank.
              </p>
            )}
          </Panel>

          {/* Live feed */}
          {board.latest.length > 0 && (
            <Panel>
              <PanelTitle title="Latest posts" sub="Newest Variational posts we have indexed" right={<span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-mint-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint-400" />Live</span>} />
              <ul className="divide-y divide-hairline">
                {board.latest.slice(0, 8).map((p) => (
                  <li key={p.tweetId} className="flex items-start gap-3 py-3">
                    <button type="button" onClick={() => onOpen(p.handle)} className="shrink-0">
                      <Avatar src={p.avatar} alt={p.handle} size={32} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs">
                        <button type="button" onClick={() => onOpen(p.handle)} className="min-w-0 truncate font-semibold text-content hover:text-gold-200">
                          @{p.handle}
                        </button>
                        <span className="shrink-0 text-content-subtle">{formatDateTime(p.createdAt)} UTC</span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 break-words text-sm text-content-muted">{p.text}</p>
                      <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] tabular-nums text-content-subtle">
                        <span>{compact(p.views)} views</span>
                        <span>{compact(p.likes)} likes</span>
                        <span>{compact(p.replies)} replies</span>
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-gold-300 hover:text-gold-200">
                          Open <ArrowUpRight className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-gold-400/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-gold-300">{compact(p.points)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {/* Top posts */}
          {board.topPosts.length > 0 && (
            <section>
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-content">Top posts</h2>
                  <p className="text-xs text-content-subtle">Highest-scoring posts in this window</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {board.topPosts.slice(0, postLimit).map((p, i) => (
                  <motion.article
                    key={p.tweetId}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 8) * 0.04 }}
                    className="surface flex flex-col gap-3 rounded-2xl p-4"
                  >
                    <button type="button" onClick={() => onOpen(p.handle)} className="flex items-center gap-2.5 text-left">
                      <Avatar src={p.avatar} alt={p.handle} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 truncate text-sm font-semibold text-content">
                          <span className="min-w-0 truncate">{p.name}</span>
                          {p.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-sky-400" />}
                        </div>
                        <div className="truncate text-[11px] text-content-subtle">
                          @{p.handle} · {formatDate(p.createdAt)}
                        </div>
                      </div>
                      <span className="rounded-full bg-gold-400/15 px-2 py-0.5 text-[11px] font-bold tabular-nums text-gold-300">{compact(p.points)} pts</span>
                    </button>
                    <p className="line-clamp-5 whitespace-pre-line break-words text-sm leading-relaxed text-content-muted">{p.text}</p>
                    <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tabular-nums text-content-subtle">
                      <span>{compact(p.views)} views</span>
                      <span>{compact(p.likes)} likes</span>
                      <span>{compact(p.replies)} replies</span>
                      <span>{compact(p.reposts)} reposts</span>
                      {venue === "all" &&
                        p.venues.map((v: VenueId) => (
                          <span key={v} className="rounded-full bg-ink-700 px-1.5 py-0.5 text-[10px] text-content-muted">
                            {venueLabel(v)}
                          </span>
                        ))}
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-gold-300 hover:text-gold-200">
                        Open <ArrowUpRight className="h-3 w-3" />
                      </a>
                    </div>
                  </motion.article>
                ))}
              </div>
              {board.topPosts.length > postLimit && (
                <div className="mt-4 text-center">
                  <button type="button" className="btn-ghost" onClick={() => setPostLimit((n) => n + 9)}>
                    More posts
                  </button>
                </div>
              )}
            </section>
          )}

          <p className="text-xs leading-relaxed text-content-subtle">
            Posts about {VENUES.map((v) => `${v.label} (@${v.handle}, ${v.site})`).join(" and ")} on X, read through twitterapi.io. A post counts for a
            venue only if it is really about it (the bare words are filtered for their maths and ML meanings). Reposts don&apos;t count, replies only
            count when you switch them on,
            and the venues&apos; own accounts aren&apos;t ranked. Points = views × {POINT_WEIGHTS.views} + likes + replies × {POINT_WEIGHTS.replies} +
            reposts × {POINT_WEIGHTS.reposts} + quotes × {POINT_WEIGHTS.quotes} + bookmarks × {POINT_WEIGHTS.bookmarks}. Levels:{" "}
            {LEVELS.map((l) => `L${l.n} ${l.name} ${full(l.min)}+`).join(", ")}. XYZ Score (0-1000) adds four equal parts: reach (followers),
            resonance (engagement per view), consistency (active weeks of the last 12) and impact (average views per post).
          </p>
        </div>
      )}
    </div>
  );
}
