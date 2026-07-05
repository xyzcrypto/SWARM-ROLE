"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Search, Bookmark, BookmarkCheck, Share2, ExternalLink, Sparkles, Zap, Loader2,
  TrendingUp, TrendingDown, Minus, X,
} from "lucide-react";
import { CATEGORIES, timeAgo, type NewsItem } from "@/lib/news";
import { cn } from "@/lib/utils";

type Resp = { items: NewsItem[]; hasMore: boolean; live: boolean; page: number };
const BOOKMARK_KEY = "xyz:news:bookmarks";

export function NewsClient() {
  const { data: session } = useSession();
  const [category, setCategory] = useState("All");
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [live, setLive] = useState(false);
  const [now, setNow] = useState(() => 0);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());

  const sentinel = useRef<HTMLDivElement>(null);

  // Load bookmarks + start the "now" clock (client-only to avoid hydration drift).
  useEffect(() => {
    setNow(Date.now());
    try {
      const saved = JSON.parse(localStorage.getItem(BOOKMARK_KEY) || "[]");
      if (Array.isArray(saved)) setBookmarks(new Set(saved));
    } catch { /* ignore */ }
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => setQuery(rawQuery.trim()), 350);
    return () => clearTimeout(t);
  }, [rawQuery]);

  const fetchPage = useCallback(async (p: number): Promise<Resp | null> => {
    const params = new URLSearchParams({ page: String(p) });
    if (category !== "All") params.set("category", category);
    if (query) params.set("q", query);
    try {
      const res = await fetch(`/api/news?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) return null;
      return (await res.json()) as Resp;
    } catch {
      return null;
    }
  }, [category, query]);

  // (Re)load page 1 whenever the filter/search changes.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setPage(1);
    fetchPage(1).then((r) => {
      if (!active) return;
      setItems(r?.items ?? []);
      setHasMore(Boolean(r?.hasMore));
      setLive(Boolean(r?.live));
      setLoading(false);
    });
    return () => { active = false; };
  }, [fetchPage]);

  // Infinite scroll.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || loading) return;
    const io = new IntersectionObserver(async (entries) => {
      if (!entries[0].isIntersecting || loadingMore) return;
      setLoadingMore(true);
      const next = page + 1;
      const r = await fetchPage(next);
      if (r) {
        setItems((prev) => {
          const seen = new Set(prev.map((i) => i.id));
          return [...prev, ...r.items.filter((i) => !seen.has(i.id))];
        });
        setHasMore(Boolean(r.hasMore));
        setPage(next);
      } else {
        setHasMore(false);
      }
      setLoadingMore(false);
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, loadingMore, page, fetchPage]);

  // Live: refresh the top of the feed every 90s (only on the unfiltered view).
  useEffect(() => {
    if (category !== "All" || query) return;
    const t = setInterval(async () => {
      if (document.hidden) return;
      const r = await fetchPage(1);
      if (!r?.items?.length) return;
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        const fresh = r.items.filter((i) => !seen.has(i.id));
        return fresh.length ? [...fresh, ...prev] : prev;
      });
      setLive(Boolean(r.live));
    }, 90_000);
    return () => clearInterval(t);
  }, [category, query, fetchPage]);

  const toggleBookmark = useCallback((id: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try { localStorage.setItem(BOOKMARK_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const visible = useMemo(
    () => (savedOnly ? items.filter((i) => bookmarks.has(i.id)) : items),
    [items, savedOnly, bookmarks]
  );
  const breaking = useMemo(() => items.find((i) => i.impact === "High"), [items]);

  return (
    <div className="space-y-5">
      {/* Breaking banner */}
      {breaking && !savedOnly && (
        <a href={breaking.url} target="_blank" rel="noopener noreferrer"
          className="group flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/[0.07] px-4 py-3 transition-colors hover:bg-red-500/[0.12]">
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-red-300">
            <Zap className="h-3 w-3" /> Breaking
          </span>
          <span className="line-clamp-1 flex-1 text-sm font-medium text-zinc-100">{breaking.title}</span>
          <span className="mono hidden shrink-0 text-[11px] text-zinc-500 sm:inline">{now ? timeAgo(breaking.publishedAt, now) : ""}</span>
        </a>
      )}

      {/* Search + saved toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder="Search news…"
            className="w-full rounded-xl border border-white/10 bg-ink-950/60 py-2.5 pl-9 pr-9 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-gold-500/40 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
          />
          {rawQuery && (
            <button onClick={() => setRawQuery("")} aria-label="Clear" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setSavedOnly((v) => !v)}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
            savedOnly ? "border-gold-500/40 bg-gold-500/15 text-gold-100" : "border-white/10 text-zinc-400 hover:text-zinc-100"
          )}
        >
          <Bookmark className="h-4 w-4" /> Saved{bookmarks.size ? ` (${bookmarks.size})` : ""}
        </button>
        <span className="hidden items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-zinc-500 sm:flex">
          <span className={cn("h-1.5 w-1.5 rounded-full", live ? "animate-pulse bg-mint-400" : "bg-amber-400")} />
          {live ? "Live" : "Cached"}
        </span>
      </div>

      {/* Category chips */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {["All", ...CATEGORIES].map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
              category === cat ? "bg-gold-500/15 text-gold-100 ring-1 ring-gold-500/30" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Feed */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-white/5" />)}
        </div>
      ) : visible.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((item) => (
            <NewsCard
              key={item.id}
              item={item}
              now={now}
              bookmarked={bookmarks.has(item.id)}
              onBookmark={() => toggleBookmark(item.id)}
              loggedIn={Boolean(session?.user)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-line py-16 text-center">
          <p className="font-display text-lg font-semibold text-zinc-200">{savedOnly ? "No saved stories yet" : "Nothing here yet"}</p>
          <p className="mt-1 text-sm text-zinc-500">{savedOnly ? "Bookmark stories to read later." : "Try another category or check back shortly."}</p>
        </div>
      )}

      {/* Infinite-scroll sentinel */}
      {!savedOnly && hasMore && (
        <div ref={sentinel} className="flex justify-center py-6">
          {loadingMore && <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />}
        </div>
      )}

      <p className="text-center text-[11px] text-zinc-600">
        Aggregated from CoinDesk, Cointelegraph, Decrypt & more. Not financial advice.
      </p>
    </div>
  );
}

function NewsCard({
  item, now, bookmarked, onBookmark, loggedIn,
}: {
  item: NewsItem; now: number; bookmarked: boolean; onBookmark: () => void; loggedIn: boolean;
}) {
  const [why, setWhy] = useState<{ loading: boolean; text: string | null; err: string | null }>({ loading: false, text: null, err: null });

  async function share() {
    const data = { title: item.title, url: item.url };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(item.url); }
    } catch { /* cancelled */ }
  }

  async function whyMatters() {
    if (!loggedIn) { setWhy({ loading: false, text: null, err: "Log in to use XYZ AI." }); return; }
    if (why.text || why.loading) return;
    setWhy({ loading: true, text: null, err: null });
    try {
      const res = await fetch("/api/ai/why-matters", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: item.title, summary: item.summary }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setWhy({ loading: false, text: null, err: j.error || "Couldn't generate." }); return; }
      setWhy({ loading: false, text: j.text, err: null });
    } catch {
      setWhy({ loading: false, text: null, err: "Network error." });
    }
  }

  const sentBadge =
    item.sentiment === "bullish" ? { cls: "bg-mint-500/15 text-mint-300", icon: <TrendingUp className="h-3 w-3" />, label: "Bullish" }
    : item.sentiment === "bearish" ? { cls: "bg-red-500/15 text-red-300", icon: <TrendingDown className="h-3 w-3" />, label: "Bearish" }
    : { cls: "bg-white/5 text-zinc-400", icon: <Minus className="h-3 w-3" />, label: "Neutral" };
  const impactCls = item.impact === "High" ? "text-red-300 ring-red-500/30" : item.impact === "Medium" ? "text-amber-300 ring-amber-500/30" : "text-zinc-400 ring-white/10";

  return (
    <div className="surface surface-hover flex flex-col rounded-2xl p-4">
      {/* meta row */}
      <div className="mb-2 flex items-center gap-2 text-[11px] text-zinc-500">
        {item.sourceIcon && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.sourceIcon} alt="" width={16} height={16} loading="lazy" className="h-4 w-4 rounded" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
        )}
        <span className="font-medium text-zinc-400">{item.source}</span>
        <span>·</span>
        <span className="mono">{now ? timeAgo(item.publishedAt, now) : ""}</span>
        <span className="ml-auto rounded-full bg-gold-500/10 px-2 py-0.5 text-[10px] font-medium text-gold-200">{item.category}</span>
      </div>

      <a href={item.url} target="_blank" rel="noopener noreferrer" className="group">
        <h3 className="line-clamp-2 font-display text-[15px] font-semibold leading-snug text-zinc-100 transition-colors group-hover:text-gold-100">{item.title}</h3>
      </a>
      {item.summary && <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-zinc-500">{item.summary}</p>}

      {/* badges */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", sentBadge.cls)}>{sentBadge.icon}{sentBadge.label}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium ring-1", impactCls)}>{item.impact} impact</span>
        {item.tokens.map((t) => (
          <span key={t} className="mono rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-400">{t}</span>
        ))}
      </div>

      {/* why-matters result */}
      {why.text && (
        <div className="mt-3 rounded-xl border border-mint-500/20 bg-mint-500/[0.06] p-3">
          <p className="mono text-[10px] font-semibold uppercase tracking-wide text-mint-300">Why this matters · XYZ AI</p>
          <p className="mt-1 text-[13px] leading-relaxed text-zinc-300">{why.text}</p>
        </div>
      )}
      {why.err && <p className="mt-2 text-[11px] text-amber-300">{why.err}</p>}

      {/* actions */}
      <div className="mt-3 flex items-center gap-1 border-t border-white/5 pt-3 text-zinc-500">
        <button onClick={whyMatters} disabled={why.loading} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-mint-300 transition-colors hover:bg-mint-500/10 disabled:opacity-50">
          {why.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Why this matters
        </button>
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] transition-colors hover:bg-white/5 hover:text-zinc-200">
          <ExternalLink className="h-3.5 w-3.5" /> Read
        </a>
        <button onClick={share} aria-label="Share" className="rounded-lg p-1.5 transition-colors hover:bg-white/5 hover:text-zinc-200"><Share2 className="h-3.5 w-3.5" /></button>
        <button onClick={onBookmark} aria-label="Bookmark" className={cn("rounded-lg p-1.5 transition-colors hover:bg-white/5", bookmarked ? "text-gold-300" : "hover:text-zinc-200")}>
          {bookmarked ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
