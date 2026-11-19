"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowUpRight, BadgeCheck, Eye, EyeOff, Heart, Loader2, MessageCircle, Search, Trophy } from "lucide-react";
import { XIcon, YouTubeIcon } from "@shared/components/BrandIcons";
import { cn, formatDate } from "@/lib/utils";
import {
  TOPICS,
  compactCount,
  matchesQuery,
  rankXCreators,
  rankYoutubeCreators,
  videoScore,
  withinWindow,
  xPostPoints,
  type TopicId,
  type WindowId,
  type XPostRow,
  type YtVideo,
} from "@modules/creators/lib/scoring";

type Tab = "youtube" | "x";
type YtSort = "score" | "views" | "newest";

type YtState =
  | { status: "loading" }
  | { status: "ready"; videos: YtVideo[]; fetchedAt: string | null; partial: boolean; loadedAt: number }
  | { status: "unconfigured" }
  | { status: "error"; quota: boolean };

const MEDALS = ["text-gold-300", "text-content-muted", "text-amber-600"];

function Rank({ i }: { i: number }) {
  return (
    <span className={cn("w-7 shrink-0 text-center font-display text-sm font-bold tabular-nums", MEDALS[i] ?? "text-content-subtle")}>
      {i < 3 ? <Trophy className="mx-auto h-4 w-4" aria-label={`Rank ${i + 1}`} /> : i + 1}
    </span>
  );
}

function Avatar({ src, alt }: { src: string | null; alt: string }) {
  if (!src) return <span className="h-9 w-9 shrink-0 rounded-full bg-ink-700" aria-hidden />;
  // Plain <img>: these are YouTube / X CDN images fetched straight by the
  // browser, which costs no Vercel transfer (cost-check trap 3).
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" className="h-9 w-9 shrink-0 rounded-full object-cover" />;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
        active ? "border-gold-400/60 bg-gold-400/15 text-gold-200" : "border-hairline text-content-muted hover:border-gold-400/30 hover:text-content"
      )}
    >
      {children}
    </button>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-hairline bg-ink-900/60 py-2 pl-9 pr-3 text-sm text-content placeholder:text-content-subtle focus:border-gold-400/50 focus:outline-none"
      />
    </label>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-hairline p-8 text-center text-sm text-content-muted">{children}</div>;
}

// ------------------------------------------------------------------ YouTube

function YoutubePanel() {
  const [topic, setTopic] = useState<TopicId>("all");
  const [win, setWin] = useState<WindowId>("30d");
  const [sort, setSort] = useState<YtSort>("score");
  const [q, setQ] = useState("");
  const [state, setState] = useState<YtState>({ status: "loading" });
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      setState({ status: "loading" });
      setShowAll(false);
    }, 0);
    fetch(`/api/creators/youtube?topic=${topic}`)
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!alive) return;
        if (body?.configured === false) return setState({ status: "unconfigured" });
        if (!r.ok || !Array.isArray(body?.videos)) return setState({ status: "error", quota: body?.error === "quota" });
        // The window filter's "now" is taken here, in the fetch callback, never
        // during render (an impure read there would differ across renders).
        setState({ status: "ready", videos: body.videos, fetchedAt: body.fetchedAt ?? null, partial: Boolean(body.partial), loadedAt: Date.now() });
      })
      .catch(() => alive && setState({ status: "error", quota: false }));
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [topic]);

  const videos = useMemo(() => {
    if (state.status !== "ready") return [];
    const list = state.videos.filter((v) => withinWindow(v.publishedAt, win, state.loadedAt) && matchesQuery(q, v.title, v.channelTitle, v.description));
    const by: Record<YtSort, (a: YtVideo, b: YtVideo) => number> = {
      score: (a, b) => videoScore(b) - videoScore(a),
      views: (a, b) => b.views - a.views,
      newest: (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
    };
    return list.sort(by[sort]);
  }, [state, win, q, sort]);

  const creators = useMemo(() => rankYoutubeCreators(videos), [videos]);
  const shown = showAll ? videos : videos.slice(0, 12);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Chip active={topic === "all"} onClick={() => setTopic("all")}>All perp DEX</Chip>
        {TOPICS.map((t) => (
          <Chip key={t.id} active={topic === t.id} onClick={() => setTopic(t.id)}>{t.label}</Chip>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchBox value={q} onChange={setQ} placeholder="Search videos or channels" />
        <div className="flex flex-wrap gap-2">
          {(["7d", "30d", "90d"] as WindowId[]).map((w) => (
            <Chip key={w} active={win === w} onClick={() => setWin(w)}>{w}</Chip>
          ))}
          <span className="mx-1 hidden w-px bg-hairline sm:block" />
          {([["score", "Top score"], ["views", "Most viewed"], ["newest", "Newest"]] as [YtSort, string][]).map(([k, l]) => (
            <Chip key={k} active={sort === k} onClick={() => setSort(k)}>{l}</Chip>
          ))}
        </div>
      </div>

      {state.status === "loading" && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-content-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading YouTube data
        </div>
      )}
      {state.status === "unconfigured" && (
        <Empty>
          The YouTube feed isn&apos;t switched on yet. It goes live as soon as the site&apos;s YouTube API key is added. Until then
          this tab shows nothing rather than made-up numbers.
        </Empty>
      )}
      {state.status === "error" && (
        <Empty>
          {state.quota
            ? "YouTube's daily data limit was reached. Fresh numbers return after it resets."
            : "YouTube didn't respond just now. Please try again in a few minutes."}
        </Empty>
      )}

      {state.status === "ready" && (
        <>
          <section className="surface rounded-3xl p-5 sm:p-6">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-content">Top creators</h2>
              <span className="text-xs text-content-subtle">{creators.length} channels · last {win}</span>
            </div>
            {creators.length === 0 ? (
              <Empty>No videos in this window{q ? " match your search" : ""}.</Empty>
            ) : (
              <ol className="divide-y divide-hairline">
                {creators.slice(0, 15).map((c, i) => (
                  <li key={c.channelId} className="flex items-center gap-3 py-2.5">
                    <Rank i={i} />
                    <Avatar src={c.channelAvatar} alt="" />
                    <div className="min-w-0 flex-1">
                      <a
                        href={`https://www.youtube.com/channel/${c.channelId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-sm font-semibold text-content hover:text-gold-300"
                      >
                        {c.channelTitle}
                      </a>
                      <div className="truncate text-xs text-content-subtle">
                        {c.videos} video{c.videos === 1 ? "" : "s"} · {compactCount(c.views)} views
                        {c.channelSubs != null && <> · {compactCount(c.channelSubs)} subs</>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-base font-bold tabular-nums text-gold-300">{compactCount(c.points)}</div>
                      <div className="text-[10px] uppercase tracking-wider text-content-subtle">points</div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-content">Top videos</h2>
              <span className="text-xs text-content-subtle">{videos.length} videos</span>
            </div>
            {videos.length === 0 ? (
              <Empty>Nothing here yet for this filter.</Empty>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((v) => (
                  <a
                    key={v.id}
                    href={`https://www.youtube.com/watch?v=${v.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="surface surface-hover lift group flex flex-col overflow-hidden rounded-2xl"
                  >
                    <div className="relative aspect-video bg-ink-800">
                      {v.thumbnail && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                      )}
                      <span className="absolute right-2 top-2 rounded-full bg-ink-950/80 px-2 py-0.5 text-[11px] font-bold tabular-nums text-gold-300">
                        {compactCount(videoScore(v))} pts
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <h3 className="line-clamp-2 text-sm font-semibold text-content group-hover:text-gold-200">{v.title}</h3>
                      <div className="truncate text-xs text-content-subtle">
                        {v.channelTitle} · {formatDate(v.publishedAt)}
                      </div>
                      <div className="mt-auto flex items-center gap-4 text-xs tabular-nums text-content-muted">
                        <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{compactCount(v.views)}</span>
                        <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{compactCount(v.likes)}</span>
                        <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{compactCount(v.comments)}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
            {videos.length > shown.length && (
              <div className="mt-5 text-center">
                <button type="button" className="btn-ghost" onClick={() => setShowAll(true)}>
                  Show all {videos.length} videos
                </button>
              </div>
            )}
          </section>

          <p className="text-xs text-content-subtle">
            Data from the YouTube Data API{state.fetchedAt ? `, refreshed ${formatDate(state.fetchedAt)}` : ""}
            {state.partial ? " (some topics are still loading)" : ""}. Video points = views ÷ 100 + likes + 2 × comments. A creator&apos;s
            points are the sum of their videos in the selected window. Hidden like or comment counts score 0.
          </p>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ X

function XPanel() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const [posts, setPosts] = useState<XPostRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/creators/x")
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!alive) return;
        if (!r.ok || !Array.isArray(body?.posts)) return setFailed(true);
        setPosts(body.posts);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!url.trim() || busy) return;
      setBusy(true);
      setMsg(null);
      try {
        const r = await fetch("/api/creators/x", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const body = await r.json().catch(() => null);
        if (!r.ok || !body?.post) {
          setMsg({ ok: false, text: body?.error || "Something went wrong. Please try again." });
          return;
        }
        const post: XPostRow = body.post;
        setPosts((prev) => [post, ...(prev ?? []).filter((p) => p.tweetId !== post.tweetId)]);
        setUrl("");
        setMsg({ ok: true, text: body.already ? "Already on the board. Counts updated." : "Added to the board." });
      } catch {
        setMsg({ ok: false, text: "Network error. Please try again." });
      } finally {
        setBusy(false);
      }
    },
    [url, busy]
  );

  const hide = useCallback(async (id: string) => {
    const r = await fetch(`/api/creators/x?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (r.ok) setPosts((prev) => (prev ?? []).filter((p) => p.id !== id));
  }, []);

  const filtered = useMemo(
    () => (posts ?? []).filter((p) => matchesQuery(q, p.text, p.authorHandle, p.authorName)),
    [posts, q]
  );
  const creators = useMemo(() => rankXCreators(filtered), [filtered]);
  const topPosts = useMemo(() => [...filtered].sort((a, b) => xPostPoints(b) - xPostPoints(a)).slice(0, 30), [filtered]);

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="surface rounded-3xl p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold text-content">Add a Variational post</h2>
        <p className="mt-1 text-sm text-content-muted">
          Paste a link to any public post on X about Variational, yours or someone else&apos;s. We read its public likes and replies
          and rank the creator.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://x.com/name/status/1234567890"
            className="w-full flex-1 rounded-xl border border-hairline bg-ink-900/60 px-3 py-2.5 text-sm text-content placeholder:text-content-subtle focus:border-gold-400/50 focus:outline-none"
          />
          {session ? (
            <button type="submit" disabled={busy || !url.trim()} className="btn-primary shrink-0 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit post"}
            </button>
          ) : (
            <Link href="/login?callbackUrl=/creators" className="btn-primary shrink-0 text-center">
              Log in to submit
            </Link>
          )}
        </div>
        {msg && <p className={cn("mt-3 text-sm", msg.ok ? "text-mint-300" : "text-red-300")}>{msg.text}</p>}
      </form>

      <SearchBox value={q} onChange={setQ} placeholder="Search posts or handles" />

      {posts === null && !failed && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-content-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading the board
        </div>
      )}
      {failed && <Empty>The board didn&apos;t load. Please refresh the page.</Empty>}

      {posts !== null && (
        <>
          <section className="surface rounded-3xl p-5 sm:p-6">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-content">Top Variational creators</h2>
              <span className="text-xs text-content-subtle">{creators.length} creators</span>
            </div>
            {creators.length === 0 ? (
              <Empty>{q ? "No creators match your search." : "No posts yet. Be the first to add one above."}</Empty>
            ) : (
              <ol className="divide-y divide-hairline">
                {creators.slice(0, 25).map((c, i) => (
                  <li key={c.handle} className="flex items-center gap-3 py-2.5">
                    <Rank i={i} />
                    <Avatar src={c.avatar} alt="" />
                    <div className="min-w-0 flex-1">
                      <a
                        href={`https://x.com/${c.handle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 truncate text-sm font-semibold text-content hover:text-gold-300"
                      >
                        <span className="truncate">{c.name}</span>
                        {c.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-sky-400" aria-label="Verified" />}
                      </a>
                      <div className="truncate text-xs text-content-subtle">
                        @{c.handle} · {c.posts} post{c.posts === 1 ? "" : "s"} · {compactCount(c.likes)} likes · {compactCount(c.replies)} replies
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-base font-bold tabular-nums text-gold-300">{compactCount(c.points)}</div>
                      <div className="text-[10px] uppercase tracking-wider text-content-subtle">points</div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {topPosts.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold text-content">Top posts</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {topPosts.map((p) => (
                  <article key={p.id} className="surface flex flex-col gap-3 rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      <Avatar src={p.authorAvatar} alt="" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-content">{p.authorName}</div>
                        <div className="truncate text-xs text-content-subtle">@{p.authorHandle} · {formatDate(p.tweetCreatedAt)}</div>
                      </div>
                      <span className="rounded-full bg-gold-400/15 px-2 py-0.5 text-[11px] font-bold tabular-nums text-gold-300">
                        {compactCount(xPostPoints(p))} pts
                      </span>
                    </div>
                    <p className="line-clamp-5 whitespace-pre-line break-words text-sm text-content-muted">{p.text}</p>
                    <div className="mt-auto flex items-center gap-4 text-xs tabular-nums text-content-muted">
                      <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{compactCount(p.likes)}</span>
                      <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{compactCount(p.replies)}</span>
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-gold-300 hover:text-gold-200">
                        View on X <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                      {isAdmin && (
                        <button type="button" onClick={() => hide(p.id)} className="inline-flex items-center gap-1 text-content-subtle hover:text-red-300" title="Hide from board">
                          <EyeOff className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          <p className="text-xs text-content-subtle">
            Posts are added by the community and must mention Variational, tag a Variational account, or link variational.io. Counts come
            from X&apos;s public post data and refresh every few hours. Post points = likes + 2 × replies. X doesn&apos;t make view counts
            public, so views aren&apos;t scored. A creator&apos;s points are the sum of their posts.
          </p>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ shell

export function CreatorsClient() {
  const [tab, setTab] = useState<Tab>("youtube");
  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">Creator Leaderboard</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-content sm:text-4xl">
          Who makes the best <span className="text-gold-gradient">perp DEX</span> content
        </h1>
        <p className="mt-3 text-sm text-content-muted sm:text-[15px]">
          Search and rank YouTube videos on Variational, Hyperliquid, Lighter, Aster, edgeX and Paradex, plus a community board of the
          best Variational posts on X. Every number comes from public data, and the scoring is shown below each board.
        </p>
      </header>

      <div role="tablist" className="inline-flex rounded-2xl border border-hairline p-1">
        {([["youtube", "YouTube · Perp DEX", YouTubeIcon], ["x", "X · Variational", XIcon]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
              tab === id ? "bg-gold-400/15 text-gold-200" : "text-content-muted hover:text-content"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "youtube" ? <YoutubePanel /> : <XPanel />}
    </div>
  );
}
