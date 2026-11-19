"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Clock, Eye, Heart, Loader2, MessageCircle, X as Close } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useScrollLock } from "@shared/hooks/useScrollLock";
import {
  TOPICS,
  engagementRate,
  isShort,
  matchesQuery,
  rankYoutubeCreators,
  topicById,
  viewsPerDay,
  videoScore,
  withinWindow,
  type TopicId,
  type WindowId,
  type YtCreator,
  type YtVideo,
} from "@modules/creators/lib/scoring";
import { compact, full, levelFor, pct } from "@modules/creators/lib/game";
import { Avatar, Chip, CountUp, Empty, LevelChip, Panel, PanelTitle, RankMark, Refreshing, SearchBox, Sparkbars, Stat } from "./ui";

export type YtState =
  | { status: "loading" }
  | { status: "ready"; videos: YtVideo[]; fetchedAt: string | null; partial: boolean; loadedAt: number; refreshing: boolean }
  | { status: "unconfigured" }
  | { status: "error"; quota: boolean };

type Sort = "score" | "trending" | "views" | "likes" | "comments" | "engagement" | "newest";
type Format = "all" | "long" | "short";

const SORTS: [Sort, string][] = [
  ["score", "Top score"],
  ["trending", "Trending"],
  ["views", "Views"],
  ["likes", "Likes"],
  ["comments", "Comments"],
  ["engagement", "Engagement"],
  ["newest", "Newest"],
];

const WINDOWS: [WindowId, string][] = [
  ["7d", "7d"],
  ["30d", "30d"],
  ["90d", "90d"],
  ["1y", "1y"],
  ["all", "All time"],
];

function duration(sec: number): string {
  if (!sec) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

function VideoCard({ v, i, now }: { v: YtVideo; i: number; now: number }) {
  const er = engagementRate(v);
  const vpd = viewsPerDay(v, now);
  return (
    <motion.a
      href={`https://www.youtube.com/watch?v=${v.id}`}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(i, 9) * 0.04 }}
      whileHover={{ y: -3 }}
      className="surface surface-hover group flex flex-col overflow-hidden rounded-2xl"
    >
      <div className="relative aspect-video overflow-hidden bg-ink-800">
        {v.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 group-active:scale-105" />
        )}
        <span className="absolute left-2 top-2 rounded-full bg-ink-950/80 px-2 py-0.5 text-[11px] font-bold tabular-nums text-gold-300 backdrop-blur">
          {compact(videoScore(v))} pts
        </span>
        {v.durationSec > 0 && (
          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white">
            {isShort(v) ? "Short" : duration(v.durationSec)}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-content group-hover:text-gold-200">{v.title}</h3>
        <div className="truncate text-xs text-content-subtle">
          {v.channelTitle} · {formatDate(v.publishedAt)} · {compact(vpd)}/day
        </div>
        <div className="flex flex-wrap gap-1">
          {v.topics.map((t) => (
            <span key={t} className="rounded-full bg-ink-700 px-2 py-0.5 text-[10px] font-semibold text-content-muted">
              {topicById(t)?.label ?? t}
            </span>
          ))}
        </div>
        <div className="mt-auto flex items-center gap-3.5 pt-1 text-xs tabular-nums text-content-muted">
          <span className="inline-flex items-center gap-1" title="Views">
            <Eye className="h-3.5 w-3.5" />
            {compact(v.views)}
          </span>
          <span className="inline-flex items-center gap-1" title="Likes">
            <Heart className="h-3.5 w-3.5" />
            {compact(v.likes)}
          </span>
          <span className="inline-flex items-center gap-1" title="Comments">
            <MessageCircle className="h-3.5 w-3.5" />
            {compact(v.comments)}
          </span>
          {er != null && (
            <span className="ml-auto rounded-full bg-mint-400/10 px-2 py-0.5 text-[10px] font-bold text-mint-300" title="Engagement per view">
              {pct(er)}
            </span>
          )}
        </div>
      </div>
    </motion.a>
  );
}

function ChannelDrawer({ c, videos, onClose, now }: { c: YtCreator; videos: YtVideo[]; onClose: () => void; now: number }) {
  useScrollLock(true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const mine = videos.filter((v) => v.channelId === c.channelId).sort((a, b) => videoScore(b) - videoScore(a));
  const avgEr = mine.reduce((s, v) => s + (engagementRate(v) ?? 0), 0) / Math.max(1, mine.filter((v) => engagementRate(v) != null).length);
  if (typeof document === "undefined") return null;
  return createPortal(
    <motion.div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}>
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
        className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-hairline bg-ink-900 p-5 sm:rounded-3xl sm:p-7"
        role="dialog"
        aria-modal="true"
        aria-label={c.channelTitle}
      >
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full p-2 text-content-subtle hover:bg-ink-700 hover:text-content">
          <Close className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-4">
          <Avatar src={c.channelAvatar} alt={c.channelTitle} size={64} ring="ring-2 ring-gold-400/40" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-display text-xl font-bold text-content">{c.channelTitle}</h3>
              <LevelChip n={levelFor(c.points).n} />
            </div>
            <a href={`https://www.youtube.com/channel/${c.channelId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-content-muted hover:text-gold-300">
              {c.channelSubs != null ? `${compact(c.channelSubs)} subscribers` : "Open channel"} <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Points" value={full(c.points)} accent />
          <Stat label="Videos" value={full(c.videos)} />
          <Stat label="Views" value={compact(c.views)} sub={`${compact(c.views / Math.max(1, c.videos))} avg`} />
          <Stat label="Engagement" value={pct(avgEr)} sub="avg per view" />
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {mine.slice(0, 12).map((v, i) => (
            <VideoCard key={v.id} v={v} i={i} now={now} />
          ))}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

export function YoutubeBoard({ state, topic, setTopic }: { state: YtState; topic: TopicId; setTopic: (t: TopicId) => void }) {
  const [win, setWin] = useState<WindowId>("all");
  const [sort, setSort] = useState<Sort>("score");
  const [format, setFormat] = useState<Format>("all");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(12);
  const [open, setOpen] = useState<YtCreator | null>(null);
  const now = state.status === "ready" ? state.loadedAt : 0;

  const inWindow = useMemo(() => {
    if (state.status !== "ready") return [] as YtVideo[];
    return state.videos.filter(
      (v) =>
        withinWindow(v.publishedAt, win, state.loadedAt) &&
        (format === "all" || (format === "short" ? isShort(v) : !isShort(v))) &&
        matchesQuery(q, v.title, v.channelTitle, v.description)
    );
  }, [state, win, format, q]);

  const videos = useMemo(() => {
    const by: Record<Sort, (a: YtVideo, b: YtVideo) => number> = {
      score: (a, b) => videoScore(b) - videoScore(a),
      trending: (a, b) => viewsPerDay(b, now) - viewsPerDay(a, now),
      views: (a, b) => b.views - a.views,
      likes: (a, b) => (b.likes ?? 0) - (a.likes ?? 0),
      comments: (a, b) => (b.comments ?? 0) - (a.comments ?? 0),
      engagement: (a, b) => (engagementRate(b) ?? -1) - (engagementRate(a) ?? -1),
      newest: (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
    };
    return [...inWindow].sort(by[sort]);
  }, [inWindow, sort, now]);

  const creators = useMemo(() => rankYoutubeCreators(inWindow), [inWindow]);

  const stats = useMemo(() => {
    const views = inWindow.reduce((s, v) => s + v.views, 0);
    const likes = inWindow.reduce((s, v) => s + (v.likes ?? 0), 0);
    const comments = inWindow.reduce((s, v) => s + (v.comments ?? 0), 0);
    return { videos: inWindow.length, views, channels: creators.length, er: views ? (likes + comments) / views : 0 };
  }, [inWindow, creators]);

  // Per-venue table: the whole picture side by side, inside the current filter.
  const venues = useMemo(() => {
    return TOPICS.filter((t) => t.id !== "perp-dex")
      .map((t) => {
        const list = inWindow.filter((v) => v.topics.includes(t.id));
        const views = list.reduce((s, v) => s + v.views, 0);
        const eng = list.reduce((s, v) => s + (v.likes ?? 0) + (v.comments ?? 0), 0);
        const top = rankYoutubeCreators(list)[0] ?? null;
        const fresh = list.filter((v) => now - Date.parse(v.publishedAt) <= 30 * 86_400_000).length;
        return { id: t.id, label: t.label, videos: list.length, views, er: views ? eng / views : 0, top, fresh };
      })
      .sort((a, b) => b.views - a.views);
  }, [inWindow, now]);

  // Mindshare: views per venue inside the current filter.
  const share = useMemo(() => {
    const rows = TOPICS.filter((t) => t.id !== "perp-dex").map((t) => ({
      id: t.id,
      label: t.label,
      views: inWindow.filter((v) => v.topics.includes(t.id)).reduce((s, v) => s + v.views, 0),
    }));
    const total = rows.reduce((s, r) => s + r.views, 0) || 1;
    return rows.map((r) => ({ ...r, pct: r.views / total })).sort((a, b) => b.views - a.views);
  }, [inWindow]);

  // Uploads per week, last 26 weeks.
  const cadence = useMemo(() => {
    if (state.status !== "ready") return { values: [] as number[], titles: [] as string[] };
    const now = state.loadedAt;
    const values = Array.from({ length: 26 }, () => 0);
    for (const v of state.videos) {
      if (topic !== "all" && !v.topics.includes(topic)) continue;
      const weeksAgo = Math.floor((now - Date.parse(v.publishedAt)) / (7 * 86_400_000));
      if (weeksAgo >= 0 && weeksAgo < 26) values[25 - weeksAgo]! += 1;
    }
    return { values, titles: values.map((n, i) => `${25 - i === 0 ? "This week" : `${25 - i} weeks ago`}: ${n} videos`) };
  }, [state, topic]);

  return (
    <div className="space-y-6">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        <Chip active={topic === "all"} onClick={() => setTopic("all")}>
          All perp DEX
        </Chip>
        {TOPICS.map((t) => (
          <Chip key={t.id} active={topic === t.id} onClick={() => setTopic(t.id)}>
            {t.label}
          </Chip>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchBox value={q} onChange={setQ} placeholder="Search videos or channels" />
        <div className="flex flex-wrap gap-1.5">
          {WINDOWS.map(([w, l]) => (
            <Chip key={w} active={win === w} onClick={() => setWin(w)}>
              {l}
            </Chip>
          ))}
          <span className="mx-1 hidden w-px bg-hairline sm:block" />
          {(["all", "long", "short"] as Format[]).map((f) => (
            <Chip key={f} active={format === f} onClick={() => setFormat(f)} title={f === "short" ? "3 minutes or less" : undefined}>
              {f === "all" ? "All formats" : f === "long" ? "Long-form" : "Shorts"}
            </Chip>
          ))}
        </div>
      </div>

      {state.status === "loading" && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-content-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading YouTube data
        </div>
      )}
      {state.status === "unconfigured" && (
        <Empty>The YouTube feed isn&apos;t switched on yet. It goes live as soon as the site&apos;s YouTube API key is added. Until then this tab shows nothing rather than made-up numbers.</Empty>
      )}
      {state.status === "error" && (
        <Empty>{state.quota ? "YouTube's daily data limit was reached. Fresh numbers return after it resets." : "YouTube didn't respond just now. Please try again in a few minutes."}</Empty>
      )}

      {state.status === "ready" && (
        <div className={cn("space-y-6 transition-opacity duration-300", state.refreshing && "opacity-70")}>
          <Refreshing on={state.refreshing} />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Videos" value={<CountUp value={stats.videos} format={full} />} />
            <Stat label="Total views" value={<CountUp value={stats.views} format={compact} />} accent />
            <Stat label="Channels" value={<CountUp value={stats.channels} format={full} />} />
            <Stat label="Engagement" value={pct(stats.er, 2)} sub="likes + comments per view" />
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <Panel className="lg:col-span-3">
              <PanelTitle title="Top creators" sub={`${full(creators.length)} channels · tap one for its videos`} />
              {creators.length === 0 ? (
                <Empty>No videos in this window{q ? " match your search" : ""}.</Empty>
              ) : (
                <ol className="divide-y divide-hairline">
                  {creators.slice(0, 15).map((c, i) => (
                    <motion.li key={c.channelId} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.025 }}>
                      <button type="button" onClick={() => setOpen(c)} className="group flex w-full items-center gap-3 rounded-xl px-1 py-2.5 text-left hover:bg-ink-800/50">
                        <RankMark rank={i + 1} />
                        <Avatar src={c.channelAvatar} alt={c.channelTitle} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-semibold text-content group-hover:text-gold-200">{c.channelTitle}</span>
                            <span className="hidden sm:inline">
                              <LevelChip n={levelFor(c.points).n} compact />
                            </span>
                          </div>
                          <div className="truncate text-xs text-content-subtle">
                            {c.videos} video{c.videos === 1 ? "" : "s"} · {compact(c.views)} views
                            {c.channelSubs != null && <> · {compact(c.channelSubs)} subs</>}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-display text-base font-bold tabular-nums text-gold-300">{compact(c.points)}</div>
                          <div className="text-[10px] uppercase tracking-wider text-content-subtle">points</div>
                        </div>
                      </button>
                    </motion.li>
                  ))}
                </ol>
              )}
            </Panel>

            <div className="space-y-6 lg:col-span-2">
              <Panel>
                <PanelTitle title="Mindshare" sub="Share of views by venue in this filter" />
                <div className="space-y-2.5">
                  {share.map((s) => (
                    <button key={s.id} type="button" onClick={() => setTopic(s.id)} className="block w-full text-left">
                      <div className="mb-1 flex justify-between text-xs">
                        <span className={cn("font-semibold", topic === s.id ? "text-gold-200" : "text-content-muted")}>{s.label}</span>
                        <span className="tabular-nums text-content-subtle">
                          {compact(s.views)} · {pct(s.pct, 0)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-ink-700">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-gold-400 to-mint-400"
                          initial={{ width: 0 }}
                          animate={{ width: `${s.pct * 100}%` }}
                          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </Panel>
              <Panel>
                <PanelTitle title="Upload cadence" sub="New videos per week, last 26 weeks" right={<Clock className="h-4 w-4 text-content-subtle" />} />
                <Sparkbars values={cadence.values} titles={cadence.titles} height={80} />
              </Panel>
            </div>
          </div>

          <Panel>
            <PanelTitle title="Venue comparison" sub="Every tracked perp DEX side by side, in this window and format" />
            <div className="-mx-2 overflow-x-auto px-2">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.14em] text-content-subtle">
                    <th className="py-2 pr-3 font-semibold">Venue</th>
                    <th className="py-2 pr-3 text-right font-semibold">Videos</th>
                    <th className="py-2 pr-3 text-right font-semibold">New 30d</th>
                    <th className="py-2 pr-3 text-right font-semibold">Views</th>
                    <th className="py-2 pr-3 text-right font-semibold">Engagement</th>
                    <th className="py-2 font-semibold">Top channel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {venues.map((v) => (
                    <tr key={v.id} onClick={() => setTopic(v.id)} className={cn("cursor-pointer transition-colors hover:bg-ink-800/50", topic === v.id && "bg-gold-400/5")}>
                      <td className={cn("py-2.5 pr-3 font-semibold", topic === v.id ? "text-gold-200" : "text-content")}>{v.label}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-content-muted">{full(v.videos)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-content-muted">{full(v.fresh)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-content">{compact(v.views)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-mint-300">{v.views ? pct(v.er) : "-"}</td>
                      <td className="max-w-[200px] truncate py-2.5 text-content-muted">{v.top?.channelTitle ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {topic !== "all" && <p className="mt-2 text-[11px] text-content-subtle">Showing one venue&apos;s videos. Pick &quot;All perp DEX&quot; above to compare every venue.</p>}
          </Panel>

          <section>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold text-content">Top videos</h2>
                <p className="text-xs text-content-subtle">{full(videos.length)} videos</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SORTS.map(([k, l]) => (
                  <Chip key={k} active={sort === k} onClick={() => setSort(k)}>
                    {l}
                  </Chip>
                ))}
              </div>
            </div>
            {videos.length === 0 ? (
              <Empty>Nothing here yet for this filter.</Empty>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {videos.slice(0, limit).map((v, i) => (
                  <VideoCard key={v.id} v={v} i={i} now={now} />
                ))}
              </div>
            )}
            {videos.length > limit && (
              <div className="mt-5 text-center">
                <button type="button" className="btn-ghost" onClick={() => setLimit((n) => n + 24)}>
                  Show more ({full(videos.length - limit)} left)
                </button>
              </div>
            )}
          </section>

          <p className="text-xs leading-relaxed text-content-subtle">
            Data from the YouTube Data API{state.fetchedAt ? `, refreshed ${formatDate(state.fetchedAt)}` : ""}
            {state.partial ? " (some topics are still loading)" : ""}. For each venue we read the all-time most viewed videos plus the most viewed and
            newest of the last 90 days, and keep only videos actually about that venue. Video points = views ÷ 100 + likes + 2 × comments. A
            channel&apos;s points are the sum of its videos in the selected window. Hidden like or comment counts score 0. Shorts = 3 minutes or less.
            Trending = views per day since upload.
          </p>
        </div>
      )}

      <AnimatePresence>{open && state.status === "ready" && <ChannelDrawer c={open} videos={inWindow} onClose={() => setOpen(null)} now={now} />}</AnimatePresence>
    </div>
  );
}
