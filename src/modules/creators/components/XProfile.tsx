"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, BadgeCheck, Check, Clock, Download, Flame, Link2, Loader2, Lock, Star, Trophy, X as Close } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useScrollLock } from "@shared/hooks/useScrollLock";
import type { Profile, ProfilePost, BoardRow, VenueFilter } from "@modules/creators/lib/x-index";
import { compact, full, pct, scoreTier, POINT_WEIGHTS } from "@modules/creators/lib/game";
import { Avatar, Bar, HeatStrip, LevelChip, Refreshing, ScoreRing, Sparkbars, Stat } from "./ui";
import { drawShareCard } from "./share-card";

type Sort = "points" | "views" | "recent";

type LoadState =
  | { s: "loading" }
  | { s: "ready"; profile: Profile; scan: string; refreshing: boolean }
  | { s: "error"; msg: string };

const SCAN_NOTE: Record<string, string> = {
  limited: "Showing stored data. Too many scans from your network just now, so we didn't re-read X.",
  budget: "Showing stored data. Today's X data budget is used up, so fresh numbers arrive tomorrow.",
  error: "Showing stored data. X data didn't respond just now.",
  unconfigured: "X data isn't switched on yet, so this shows only what is stored.",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function XProfile({
  handle,
  venue: initialVenue,
  replies = false,
  board,
  boardVenue,
  onClose,
  onCompare,
  starred,
  onToggleStar,
}: {
  handle: string;
  venue: VenueFilter;
  replies?: boolean;
  board: BoardRow[];
  /** Venue the passed all-time board ranks; the "points to pass" line only makes sense on it. */
  boardVenue: VenueFilter | null;
  onClose: () => void;
  onCompare: (h: string) => void;
  starred: boolean;
  onToggleStar: (h: string) => void;
}) {
  const venue = initialVenue;
  const [state, setState] = useState<LoadState>({ s: "loading" });
  const [sort, setSort] = useState<Sort>("points");
  const [copied, setCopied] = useState(false);
  useScrollLock(true);

  useEffect(() => {
    let alive = true;
    // Switching venue keeps the current profile on screen (dimmed) until the
    // new one lands, instead of flashing back to a spinner.
    const t = setTimeout(() => setState((s) => (s.s === "ready" ? { ...s, refreshing: true } : { s: "loading" })), 0);
    fetch(`/api/creators/x/profile?handle=${encodeURIComponent(handle)}&venue=${venue}${replies ? "&replies=1" : ""}`)
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!alive) return;
        if (r.ok && body?.profile) return setState({ s: "ready", profile: body.profile, scan: body.scan, refreshing: false });
        const msg =
          body?.error ||
          (body?.scan === "unconfigured"
            ? "X data isn't switched on yet."
            : body?.scan === "budget"
              ? "Today's X data budget is used up. Try again tomorrow."
              : "No posts about these venues found for this account yet.");
        setState({ s: "error", msg });
      })
      .catch(() => alive && setState({ s: "error", msg: "Network error. Please try again." }));
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [handle, venue, replies]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const p = state.s === "ready" ? state.profile : null;

  const posts = useMemo(() => {
    if (!p) return [] as ProfilePost[];
    const list = [...p.posts];
    if (sort === "points") list.sort((a, b) => b.points - a.points);
    if (sort === "views") list.sort((a, b) => b.views - a.views);
    if (sort === "recent") list.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return list.slice(0, 30);
  }, [p, sort]);

  // The one place a reader can see exactly who is next above them.
  const chase = useMemo(() => {
    if (!p?.rank || p.rank <= 1 || boardVenue !== venue) return null;
    const above = board.find((r) => r.rank === p.rank! - 1);
    return above ? { handle: above.handle, gap: Math.max(1, above.points - p.totals.points + 1) } : null;
  }, [p, board, boardVenue, venue]);

  const best = useMemo(() => (p ? [...p.posts].sort((a, b) => b.points - a.points)[0] ?? null : null), [p]);
  const bestHour = useMemo(() => {
    if (!p) return null;
    let h = -1;
    let v = 0;
    p.byHour.forEach((x, i) => {
      if (x.posts >= 2 && x.avg > v) {
        v = x.avg;
        h = i;
      }
    });
    return h >= 0 ? h : null;
  }, [p]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/creators?x=${encodeURIComponent(handle)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  };

  const download = async () => {
    if (!p) return;
    const url = await drawShareCard(p);
    const a = document.createElement("a");
    a.href = url;
    a.download = `xyz-variational-${p.handle}.png`;
    a.click();
  };

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={`@${handle} on the Variational board`}
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ y: 40, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-hairline bg-ink-900 p-5 shadow-2xl sm:rounded-3xl sm:p-7"
        >
          <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full p-2 text-content-subtle hover:bg-ink-700 hover:text-content">
            <Close className="h-4 w-4" />
          </button>

          {state.s === "loading" && (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-content-muted">
              <Loader2 className="h-6 w-6 animate-spin text-gold-300" />
              Scanning @{handle} on X
              <span className="text-xs text-content-subtle">First scan of an account can take a few seconds.</span>
            </div>
          )}
          {state.s === "error" && <div className="py-16 text-center text-sm text-content-muted">{state.msg}</div>}

          {p && (
            <div className="space-y-6">
              {/* Identity */}
              <div className="flex items-start gap-3 pr-8 sm:items-center sm:gap-5 sm:pr-10">
                <Avatar src={p.avatar} alt={p.handle} size={56} ring="ring-2 ring-gold-400/40" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-display text-xl font-bold sm:text-2xl tracking-tight text-content">{p.name}</h3>
                    {p.verified && <BadgeCheck className="h-5 w-5 text-sky-400" aria-label="Verified" />}
                    <LevelChip n={p.level.level.n} />
                  </div>
                  <a href={`https://x.com/${p.handle}`} target="_blank" rel="noopener noreferrer" className="text-sm text-content-muted hover:text-gold-300">
                    @{p.handle} · {compact(p.followers)} followers
                  </a>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {p.official ? (
                      <span className="rounded-full bg-mint-400/15 px-2.5 py-1 font-semibold text-mint-300">Official venue account</span>
                    ) : p.rank ? (
                      <>
                        <span className="inline-flex items-center gap-1 rounded-full bg-gold-400/15 px-2.5 py-1 font-semibold text-gold-200">
                          <Trophy className="h-3.5 w-3.5" /> Rank #{p.rank} of {full(p.ofAccounts)}
                        </span>
                        {p.percentile != null && p.ofAccounts >= 10 && (
                          <span className="rounded-full bg-mint-400/15 px-2.5 py-1 font-semibold text-mint-300">
                            Top {Math.max(1, Math.round((1 - p.percentile) * 100))}%
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="rounded-full bg-ink-700 px-2.5 py-1 text-content-muted">Not ranked yet</span>
                    )}
                    {p.streak > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-1 font-semibold text-orange-300">
                        <Flame className="h-3.5 w-3.5" /> {p.streak}-week streak
                      </span>
                    )}
                  </div>
                </div>
                <ScoreRing value={p.score.total} size={84} />
              </div>

              <Refreshing on={state.s === "ready" && state.refreshing} />

              {state.s === "ready" && SCAN_NOTE[state.scan] && (
                <p className="rounded-xl border border-gold-400/20 bg-gold-400/5 px-3 py-2 text-xs text-gold-200">{SCAN_NOTE[state.scan]}</p>
              )}

              {/* Level progress */}
              <div className="rounded-2xl border border-hairline bg-ink-800/50 p-4">
                <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-semibold text-content">
                    {full(p.totals.points)} <span className="text-content-subtle">points</span>
                  </span>
                  <span className="text-xs text-content-subtle">
                    {p.level.next ? `${full(p.level.toNext)} to L${p.level.next.n} ${p.level.next.name}` : "Max level reached"}
                  </span>
                </div>
                <Bar pct={p.level.pct} />
                {chase && (
                  <p className="mt-3 text-xs text-content-muted">
                    <span className="font-semibold text-gold-200">{full(chase.gap)} points</span> to pass @{chase.handle} for rank #{(p.rank ?? 2) - 1}.
                  </p>
                )}
              </div>

              {/* Numbers */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Posts" value={full(p.totals.posts)} />
                <Stat label="Views" value={compact(p.totals.views)} sub={`${compact(p.totals.avgViews)} avg / post`} />
                <Stat label="Engagement" value={pct(p.totals.engagementRate, 2)} sub="per view" />
                <Stat label="Active weeks" value={`${p.activeWeeks}/12`} />
                <Stat label="Likes" value={compact(p.totals.likes)} />
                <Stat label="Replies" value={compact(p.totals.replies)} />
                <Stat label="Reposts" value={compact(p.totals.reposts)} />
                <Stat label="Quotes · Saves" value={`${compact(p.totals.quotes)} · ${compact(p.totals.bookmarks)}`} />
                <Stat label="Originals · Replies" value={`${full(p.totals.originals)} · ${full(p.totals.replyPosts)}`} />
                <Stat label="Creator since" value={p.firstPost ? formatDate(p.firstPost) : "-"} sub="first stored post" />
                <Stat label="Best post" value={best ? `${compact(best.points)} pts` : "-"} sub={best ? `${compact(best.views)} views` : undefined} />
                <Stat label="Pts / post" value={p.totals.posts ? compact(p.totals.points / p.totals.posts) : "-"} />
              </div>

              {/* Venue split + timing */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-hairline p-4">
                  <div className="mb-3 text-sm font-semibold text-content">How people engage</div>
                  {(() => {
                    const parts = [
                      ["Likes", p.totals.likes],
                      ["Replies", p.totals.replies],
                      ["Reposts", p.totals.reposts],
                      ["Quotes", p.totals.quotes],
                      ["Bookmarks", p.totals.bookmarks],
                    ] as const;
                    const total = parts.reduce((s2, [, v]) => s2 + v, 0) || 1;
                    return parts.map(([label, v]) => (
                      <div key={label} className="mb-2.5 last:mb-0">
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-content-muted">{label}</span>
                          <span className="tabular-nums text-content">
                            {compact(v)} · {pct(v / total, 0)}
                          </span>
                        </div>
                        <Bar pct={v / total} className="h-1.5" />
                      </div>
                    ));
                  })()}
                </div>
                <div className="rounded-2xl border border-hairline p-4">
                  <div className="mb-3 flex items-center justify-between text-sm font-semibold text-content">
                    <span>When their posts land best</span>
                    <Clock className="h-4 w-4 text-content-subtle" />
                  </div>
                  <HeatStrip
                    values={p.byHour.map((h) => h.avg)}
                    labels={["0h", "6h", "12h", "18h", "23h"]}
                    title={(i) => `${String(i).padStart(2, "0")}:00 UTC: ${p.byHour[i]!.posts} posts, ${full(p.byHour[i]!.avg)} avg pts`}
                  />
                  <div className="mt-3">
                    <HeatStrip values={p.byWeekday.map((d) => d.avg)} labels={WEEKDAYS} title={(i) => `${WEEKDAYS[i]}: ${p.byWeekday[i]!.posts} posts, ${full(p.byWeekday[i]!.avg)} avg pts`} />
                  </div>
                  <p className="mt-2 text-[11px] text-content-subtle">
                    {bestHour != null ? `Strongest hour: ${String(bestHour).padStart(2, "0")}:00 UTC (average points per post). ` : "Needs a few more posts to spot a pattern. "}
                    Times are UTC.
                  </p>
                </div>
              </div>

              {/* Score breakdown + weekly */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-hairline p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-content">XYZ Score breakdown</span>
                    <span className="text-xs font-semibold text-gold-300">{scoreTier(p.score.total).label}</span>
                  </div>
                  {(
                    [
                      ["Reach", p.score.reach, "Followers, log scale"],
                      ["Resonance", p.score.resonance, "Engagement per view"],
                      ["Consistency", p.score.consistency, "Weeks active of last 12"],
                      ["Impact", p.score.impact, "Average views per post"],
                    ] as const
                  ).map(([label, v, hint]) => (
                    <div key={label} className="mb-2.5 last:mb-0">
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-content-muted" title={hint}>
                          {label}
                        </span>
                        <span className="tabular-nums text-content">{v}/250</span>
                      </div>
                      <Bar pct={v / 250} className="h-1.5" />
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-hairline p-4">
                  <div className="mb-3 text-sm font-semibold text-content">Points per week</div>
                  <Sparkbars values={p.weekly.map((w) => w.points)} titles={p.weekly.map((w) => `Week of ${w.week}: ${full(w.points)} pts, ${w.posts} posts`)} height={96} />
                  <div className="mt-2 flex justify-between text-[10px] text-content-subtle">
                    <span>12 weeks ago</span>
                    <span>This week</span>
                  </div>
                </div>
              </div>

              {/* Badges */}
              <div>
                <div className="mb-3 text-sm font-semibold text-content">
                  Badges <span className="text-content-subtle">{p.badges.filter((b) => b.earned).length}/{p.badges.length}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {p.badges.map((b, i) => (
                    <motion.div
                      key={b.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.05 * i }}
                      title={b.hint}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs",
                        b.earned ? "border-gold-400/40 bg-gold-400/10 text-gold-100" : "border-hairline text-content-subtle"
                      )}
                    >
                      {b.earned ? <Check className="h-3.5 w-3.5 shrink-0 text-gold-300" /> : <Lock className="h-3.5 w-3.5 shrink-0" />}
                      <span className="min-w-0 truncate">{b.label}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={download} className="btn-gold inline-flex items-center gap-2">
                  <Download className="h-4 w-4" /> Share card
                </button>
                <button type="button" onClick={copyLink} className="btn-ghost inline-flex items-center gap-2">
                  {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />} {copied ? "Copied" : "Copy link"}
                </button>
                <button type="button" onClick={() => onCompare(p.handle)} className="btn-ghost">
                  Compare
                </button>
                <button type="button" onClick={() => onToggleStar(p.handle)} className="btn-ghost inline-flex items-center gap-2" aria-pressed={starred}>
                  <Star className={cn("h-4 w-4", starred && "fill-current text-gold-300")} /> {starred ? "Watching" : "Watch"}
                </button>
              </div>

              {/* Posts */}
              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-content">Posts</span>
                  <div className="flex gap-1.5">
                    {(["points", "views", "recent"] as Sort[]).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setSort(k)}
                        className={cn("rounded-full px-2.5 py-1 text-xs font-semibold capitalize", sort === k ? "bg-gold-400/15 text-gold-200" : "text-content-subtle hover:text-content")}
                      >
                        {k === "points" ? "Top" : k}
                      </button>
                    ))}
                  </div>
                </div>
                {posts.length === 0 ? (
                  <p className="text-sm text-content-muted">No posts stored for this account yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {posts.map((t) => (
                      <li key={t.tweetId} className="rounded-2xl border border-hairline bg-ink-800/30 p-3.5 transition-colors hover:border-gold-400/30">
                        <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] text-content-subtle">
                          <span>
                            {formatDate(t.createdAt)}
                            {t.isReply ? " · reply" : ""}
                          </span>
                          <span className="rounded-full bg-gold-400/15 px-2 py-0.5 font-bold tabular-nums text-gold-300">{compact(t.points)} pts</span>
                        </div>
                        <p className="line-clamp-4 whitespace-pre-line break-words text-sm text-content-muted">{t.text}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] tabular-nums text-content-subtle">
                          <span>{compact(t.views)} views</span>
                          <span>{compact(t.likes)} likes</span>
                          <span>{compact(t.replies)} replies</span>
                          <span>{compact(t.reposts)} reposts</span>
                          <a href={t.url} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-gold-300 hover:text-gold-200">
                            Open <ArrowUpRight className="h-3 w-3" />
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <p className="text-[11px] leading-relaxed text-content-subtle">
                Points = views × {POINT_WEIGHTS.views} + likes + replies × {POINT_WEIGHTS.replies} + reposts × {POINT_WEIGHTS.reposts} + quotes × {POINT_WEIGHTS.quotes} + bookmarks ×{" "}
                {POINT_WEIGHTS.bookmarks}. {p.scannedAt ? `Account last read from X ${formatDate(p.scannedAt)}.` : ""}
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
