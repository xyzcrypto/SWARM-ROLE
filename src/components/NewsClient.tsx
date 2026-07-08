"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Search, Bookmark, BookmarkCheck, Share2, ExternalLink, Sparkles, Zap, Loader2,
  TrendingUp, TrendingDown, Minus, X, SlidersHorizontal, Check, Star, BookOpen,
  ChevronLeft, ChevronRight, Bell, BellRing, ArrowUp,
} from "lucide-react";
import { CATEGORIES, timeAgo, type NewsItem } from "@/lib/news";
import type { NewsPage } from "@/lib/news-fetch";
import { NewsAlertsToggle } from "./NewsAlertsToggle";
import { MarkdownLite } from "./MarkdownLite";
import { shareUrl, type SharedStory } from "@/lib/news-share";
import { cn } from "@/lib/utils";

// A news item → the compact story we share as an on-site link.
function storyOf(item: NewsItem): SharedStory {
  return { u: item.url, t: item.title, s: item.summary, src: item.source, img: item.image, ts: item.publishedAt, cat: item.category };
}
// Share OUR on-site link (rich preview on our domain) rather than the raw source.
async function shareStory(item: NewsItem) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = shareUrl(origin, storyOf(item));
  try {
    if (navigator.share) await navigator.share({ title: item.title, url });
    else await navigator.clipboard.writeText(url);
  } catch { /* cancelled */ }
}

type Resp = { items: NewsItem[]; hasMore: boolean; live: boolean; page: number };
const BOOKMARK_KEY = "xyz:news:bookmarks";

export function NewsClient({ initial }: { initial?: NewsPage | null }) {
  const { data: session } = useSession();
  const [category, setCategory] = useState("All");
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [items, setItems] = useState<NewsItem[]>(initial?.items ?? []);
  const [pending, setPending] = useState<NewsItem[]>([]); // fresh stories buffered for the "N new" pill
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(Boolean(initial?.hasMore));
  const [loading, setLoading] = useState(!initial);
  const [loadingMore, setLoadingMore] = useState(false);
  const [live, setLive] = useState(Boolean(initial?.live));
  const [now, setNow] = useState(() => 0);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [interests, setInterests] = useState<string[]>([]);
  const [customizing, setCustomizing] = useState(false);
  const [readerIndex, setReaderIndex] = useState<number | null>(null);
  const [notify, setNotify] = useState(false); // browser notifications for breaking
  const loggedIn = Boolean(session?.user);

  const sentinel = useRef<HTMLDivElement>(null);
  const firstRun = useRef(true);
  const itemsRef = useRef(items);
  const notifyRef = useRef(false);
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { notifyRef.current = notify; }, [notify]);

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

  // Load the member's followed categories (for the "For You" feed).
  useEffect(() => {
    if (!loggedIn) { setInterests([]); return; }
    let active = true;
    fetch("/api/news/interests", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (active && Array.isArray(j?.interests)) setInterests(j.interests); })
      .catch(() => {});
    return () => { active = false; };
  }, [loggedIn]);

  const fetchPage = useCallback(async (p: number): Promise<Resp | null> => {
    const params = new URLSearchParams({ page: String(p) });
    // "For You" pulls the full feed and filters to the member's interests client-side.
    if (category !== "All" && category !== "For You") params.set("category", category);
    if (query) params.set("q", query);
    try {
      const res = await fetch(`/api/news?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) return null;
      return (await res.json()) as Resp;
    } catch {
      return null;
    }
  }, [category, query]);

  // (Re)load page 1 whenever the filter/search changes. Skip the very first run
  // when the server already rendered the default view (instant first paint).
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      if (initial && category === "All" && !query) { setLoading(false); return; }
    }
    let active = true;
    setLoading(true);
    setPage(1);
    setPending([]);
    fetchPage(1).then((r) => {
      if (!active) return;
      setItems(r?.items ?? []);
      setHasMore(Boolean(r?.hasMore));
      setLive(Boolean(r?.live));
      setLoading(false);
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Realtime: poll fast (30s) on the unfiltered view. Fresh stories are buffered
  // for a "N new stories" pill (Twitter-style) instead of jumping the feed, and
  // high-impact ones fire a browser notification when the tab is in the background.
  useEffect(() => {
    if (category !== "All" || query) return;
    const t = setInterval(async () => {
      const r = await fetchPage(1);
      if (!r?.items?.length) return;
      setLive(Boolean(r.live));
      setPending((prevPending) => {
        const known = new Set([...itemsRef.current.map((i) => i.id), ...prevPending.map((i) => i.id)]);
        const fresh = r.items.filter((i) => !known.has(i.id));
        if (!fresh.length) return prevPending;
        if (notifyRef.current && document.hidden && typeof Notification !== "undefined" && Notification.permission === "granted") {
          const hot = fresh.find((i) => i.impact === "High") ?? fresh[0];
          try { new Notification("XYZ Crypto · News", { body: hot.title, icon: "/logo.png", tag: hot.id }); } catch { /* ignore */ }
        }
        return [...fresh, ...prevPending];
      });
    }, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, query, fetchPage]);

  // Reveal buffered stories at the top of the feed.
  const revealPending = useCallback(() => {
    setItems((prev) => {
      const seen = new Set(prev.map((i) => i.id));
      return [...pending.filter((i) => !seen.has(i.id)), ...prev];
    });
    setPending([]);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pending]);

  // Toggle browser notifications (request permission on enable).
  const toggleNotify = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    if (notify) { setNotify(false); return; }
    let perm = Notification.permission;
    if (perm === "default") { try { perm = await Notification.requestPermission(); } catch { /* ignore */ } }
    setNotify(perm === "granted");
  }, [notify]);

  const toggleBookmark = useCallback((id: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try { localStorage.setItem(BOOKMARK_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const saveInterests = useCallback(async (next: string[]) => {
    setInterests(next); // optimistic
    try {
      await fetch("/api/news/interests", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interests: next }),
      });
    } catch { /* best-effort */ }
  }, []);

  const visible = useMemo(() => {
    let list = items;
    if (category === "For You" && interests.length) list = list.filter((i) => i.categories.some((c) => interests.includes(c)));
    if (savedOnly) list = list.filter((i) => bookmarks.has(i.id));
    return list;
  }, [items, savedOnly, bookmarks, category, interests]);
  const breakingList = useMemo(() => visible.filter((i) => i.impact === "High").slice(0, 5), [visible]);
  const openById = useCallback((id: string) => {
    const idx = visible.findIndex((v) => v.id === id);
    if (idx >= 0) setReaderIndex(idx);
  }, [visible]);

  return (
    <div className="space-y-5">
      {/* Breaking hero — image-rich, auto-rotating, opens the reader */}
      {!savedOnly && breakingList.length > 0 && (
        <BreakingHero items={breakingList} now={now} onOpen={openById} />
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
        <button
          onClick={toggleNotify}
          aria-label={notify ? "Disable breaking notifications" : "Enable breaking notifications"}
          title="Breaking-news notifications"
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
            notify ? "border-mint-500/40 bg-mint-500/15 text-mint-200" : "border-white/10 text-zinc-400 hover:text-zinc-100"
          )}
        >
          {notify ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          <span className="hidden sm:inline">{notify ? "Alerts on" : "Alerts"}</span>
        </button>
        <NewsAlertsToggle loggedIn={loggedIn} />
        <span className="hidden items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-zinc-500 sm:flex">
          <span className={cn("h-1.5 w-1.5 rounded-full", live ? "animate-pulse bg-mint-400" : "bg-amber-400")} />
          {live ? "Live" : "Cached"}
        </span>
      </div>

      {/* Category chips */}
      <div className="flex items-center gap-2">
        <div className="-mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {loggedIn && (
            <button
              onClick={() => setCategory("For You")}
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors",
                category === "For You" ? "bg-mint-500/15 text-mint-200 ring-1 ring-mint-500/30" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
              )}
            >
              <Star className="h-3.5 w-3.5" /> For You
            </button>
          )}
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
        {loggedIn && (
          <button onClick={() => setCustomizing(true)} aria-label="Customize feed" className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[13px] font-medium text-zinc-400 transition-colors hover:text-zinc-100">
            <SlidersHorizontal className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Customize</span>
          </button>
        )}
      </div>

      {/* Empty "For You" hint */}
      {category === "For You" && !interests.length && (
        <div className="rounded-2xl border border-dashed border-mint-500/25 bg-mint-500/[0.04] py-8 text-center">
          <p className="text-sm font-semibold text-zinc-200">Build your personalized feed</p>
          <p className="mt-1 text-sm text-zinc-500">Pick the topics you care about to see only what matters to you.</p>
          <button onClick={() => setCustomizing(true)} className="btn-primary mt-4 px-4 py-2 text-sm">Choose topics</button>
        </div>
      )}

      {/* "N new stories" pill (Twitter-style) */}
      <AnimatePresence>
        {!savedOnly && pending.length > 0 && (
          <motion.div
            key="new-pill"
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="sticky top-20 z-20 flex justify-center"
          >
            <button onClick={revealPending} className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/40 bg-gold-500/15 px-4 py-1.5 text-[13px] font-semibold text-gold-100 shadow-lg shadow-black/30 backdrop-blur transition-colors hover:bg-gold-500/25">
              <ArrowUp className="h-3.5 w-3.5" /> {pending.length} new stor{pending.length === 1 ? "y" : "ies"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feed */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="shimmer h-44 rounded-2xl bg-white/[0.04]" />)}
        </div>
      ) : visible.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((item, i) => (
            <NewsCard
              key={item.id}
              item={item}
              index={i}
              now={now}
              bookmarked={bookmarks.has(item.id)}
              onBookmark={() => toggleBookmark(item.id)}
              onOpen={() => setReaderIndex(i)}
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

      {customizing && (
        <CustomizeModal
          initial={interests}
          onClose={() => setCustomizing(false)}
          onSave={(next) => { saveInterests(next); setCustomizing(false); }}
        />
      )}

      <AnimatePresence>
        {readerIndex !== null && visible[readerIndex] && (
          <NewsReader
            key="news-reader"
            item={visible[readerIndex]}
            now={now}
            loggedIn={loggedIn}
            bookmarked={bookmarks.has(visible[readerIndex].id)}
            onBookmark={() => toggleBookmark(visible[readerIndex].id)}
            hasPrev={readerIndex > 0}
            hasNext={readerIndex < visible.length - 1}
            onPrev={() => setReaderIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
            onNext={() => setReaderIndex((i) => (i !== null && i < visible.length - 1 ? i + 1 : i))}
            onClose={() => setReaderIndex(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CustomizeModal({ initial, onClose, onSave }: { initial: string[]; onClose: () => void; onSave: (next: string[]) => void }) {
  const [picked, setPicked] = useState<Set<string>>(new Set(initial));
  const toggle = (c: string) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    return next;
  });
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="glass w-full max-w-lg overflow-hidden rounded-2xl ring-1 ring-gold-500/20" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <div>
            <p className="text-sm font-semibold text-zinc-100">Customize your feed</p>
            <p className="text-[11px] text-zinc-500">Pick the topics for your “For You” news.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-zinc-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-4">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const on = picked.has(c);
              return (
                <button key={c} onClick={() => toggle(c)}
                  className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
                    on ? "bg-mint-500/15 text-mint-200 ring-1 ring-mint-500/40" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-100")}>
                  {on && <Check className="h-3 w-3" />} {c}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-3.5">
          <span className="text-[11px] text-zinc-500">{picked.size} selected</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
            <button onClick={() => onSave([...picked])} className="btn-primary px-4 py-2 text-sm">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewsCard({
  item, index, now, bookmarked, onBookmark, onOpen, loggedIn,
}: {
  item: NewsItem; index: number; now: number; bookmarked: boolean; onBookmark: () => void; onOpen: () => void; loggedIn: boolean;
}) {
  const reduce = useReducedMotion();
  const [why, setWhy] = useState<{ loading: boolean; text: string | null; err: string | null }>({ loading: false, text: null, err: null });
  const [digest, setDigest] = useState<{ loading: boolean; text: string | null; err: string | null }>({ loading: false, text: null, err: null });

  const share = () => shareStory(item);

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

  // Fuller AI digest so readers get the whole story on our site (no click-out).
  async function readSummary() {
    if (!loggedIn) { setDigest({ loading: false, text: null, err: "Log in to use XYZ AI." }); return; }
    if (digest.text || digest.loading) return;
    setDigest({ loading: true, text: null, err: null });
    try {
      const res = await fetch("/api/ai/why-matters", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: item.title, summary: item.summary, mode: "digest" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setDigest({ loading: false, text: null, err: j.error || "Couldn't generate." }); return; }
      setDigest({ loading: false, text: j.text, err: null });
    } catch {
      setDigest({ loading: false, text: null, err: "Network error." });
    }
  }

  const sentBadge =
    item.sentiment === "bullish" ? { cls: "bg-mint-500/15 text-mint-300", icon: <TrendingUp className="h-3 w-3" />, label: "Bullish" }
    : item.sentiment === "bearish" ? { cls: "bg-red-500/15 text-red-300", icon: <TrendingDown className="h-3 w-3" />, label: "Bearish" }
    : { cls: "bg-white/5 text-zinc-400", icon: <Minus className="h-3 w-3" />, label: "Neutral" };
  const impactCls = item.impact === "High" ? "text-red-300 ring-red-500/30" : item.impact === "Medium" ? "text-amber-300 ring-amber-500/30" : "text-zinc-400 ring-white/10";

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.4, delay: Math.min(index, 7) * 0.04, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduce ? undefined : { y: -3 }}
      className="surface surface-hover group/card relative flex flex-col overflow-hidden rounded-2xl p-4"
    >
      {/* sentiment accent bar */}
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-0.5 opacity-70",
        item.sentiment === "bullish" ? "bg-gradient-to-r from-mint-400/0 via-mint-400 to-mint-400/0"
        : item.sentiment === "bearish" ? "bg-gradient-to-r from-red-400/0 via-red-400 to-red-400/0"
        : "bg-gradient-to-r from-gold-400/0 via-gold-400/60 to-gold-400/0")} />
      {/* hero image (when the feed provides one) — opens the on-site reader */}
      {item.image && (
        <button onClick={onOpen} className="group -mx-4 -mt-4 mb-3 block overflow-hidden rounded-t-2xl" aria-label={`Read: ${item.title}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.image} alt="" loading="lazy" className="h-36 w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" onError={(e) => ((e.currentTarget.parentElement as HTMLElement).style.display = "none")} />
        </button>
      )}
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

      <button onClick={onOpen} className="group text-left">
        <h3 className="line-clamp-2 font-display text-[15px] font-semibold leading-snug text-zinc-100 transition-colors group-hover:text-gold-100">{item.title}</h3>
      </button>
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

      {/* AI digest — read the whole story on-site */}
      {digest.text && (
        <div className="mt-3 rounded-xl border border-gold-500/20 bg-gold-500/[0.06] p-3">
          <p className="mono text-[10px] font-semibold uppercase tracking-wide text-gold-200">AI Summary · XYZ AI</p>
          <p className="mt-1 text-[13px] leading-relaxed text-zinc-200">{digest.text}</p>
        </div>
      )}
      {digest.err && <p className="mt-2 text-[11px] text-amber-300">{digest.err}</p>}

      {/* actions */}
      <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1.5 border-t border-white/5 pt-3 text-zinc-500">
        <button onClick={readSummary} disabled={digest.loading} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-gold-200 transition-colors hover:bg-gold-500/10 disabled:opacity-50">
          {digest.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />} AI Summary
        </button>
        <button onClick={whyMatters} disabled={why.loading} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-mint-300 transition-colors hover:bg-mint-500/10 disabled:opacity-50">
          {why.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Why this matters
        </button>
        <button onClick={onOpen} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] transition-colors hover:bg-white/5 hover:text-zinc-200">
          <BookOpen className="h-3.5 w-3.5" /> Read
        </button>
        <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label="Original source" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] transition-colors hover:bg-white/5 hover:text-zinc-200">
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <button onClick={share} aria-label="Share" className="rounded-lg p-1.5 transition-colors hover:bg-white/5 hover:text-zinc-200"><Share2 className="h-3.5 w-3.5" /></button>
        <button onClick={onBookmark} aria-label="Bookmark" className={cn("rounded-lg p-1.5 transition-colors hover:bg-white/5", bookmarked ? "text-gold-300" : "hover:text-zinc-200")}>
          {bookmarked ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
        </button>
      </div>
    </motion.div>
  );
}

// On-site reader: read the story (headline, image, summary, AI digest) without
// bouncing off-site, with prev/next through the current list. Keyboard: Esc to
// close, ←/→ to navigate.
function NewsReader({
  item, now, loggedIn, bookmarked, onBookmark, hasPrev, hasNext, onPrev, onNext, onClose,
}: {
  item: NewsItem; now: number; loggedIn: boolean; bookmarked: boolean; onBookmark: () => void;
  hasPrev: boolean; hasNext: boolean; onPrev: () => void; onNext: () => void; onClose: () => void;
}) {
  const [digest, setDigest] = useState<{ loading: boolean; text: string | null; err: string | null }>({ loading: false, text: null, err: null });

  // Keyboard nav + scroll lock while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && hasPrev) onPrev();
      else if (e.key === "ArrowRight" && hasNext) onNext();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [hasPrev, hasNext, onPrev, onNext, onClose]);

  // Reset + auto-generate the AI digest whenever the story changes.
  useEffect(() => {
    setDigest({ loading: false, text: null, err: null });
    if (!loggedIn) return;
    let stop = false;
    setDigest({ loading: true, text: null, err: null });
    fetch("/api/ai/why-matters", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: item.title, summary: item.summary, mode: "briefing" }),
    })
      .then(async (res) => {
        const j = await res.json().catch(() => ({}));
        if (stop) return;
        if (!res.ok) setDigest({ loading: false, text: null, err: j.error || "Couldn't generate a summary." });
        else setDigest({ loading: false, text: j.text, err: null });
      })
      .catch(() => !stop && setDigest({ loading: false, text: null, err: "Network error." }));
    return () => { stop = true; };
  }, [item.id, item.title, item.summary, loggedIn]);

  const share = () => shareStory(item);

  const sent =
    item.sentiment === "bullish" ? { cls: "bg-mint-500/15 text-mint-300", icon: <TrendingUp className="h-3 w-3" />, label: "Bullish" }
    : item.sentiment === "bearish" ? { cls: "bg-red-500/15 text-red-300", icon: <TrendingDown className="h-3 w-3" />, label: "Bearish" }
    : { cls: "bg-white/5 text-zinc-400", icon: <Minus className="h-3 w-3" />, label: "Neutral" };
  const impactCls = item.impact === "High" ? "text-red-300 ring-red-500/30" : item.impact === "Medium" ? "text-amber-300 ring-amber-500/30" : "text-zinc-400 ring-white/10";

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={item.title}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
        className="surface relative flex w-full max-w-2xl flex-col overflow-hidden sm:max-h-[90vh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* top bar */}
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2 text-[12px] text-zinc-400">
            {item.sourceIcon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.sourceIcon} alt="" width={16} height={16} className="h-4 w-4 rounded" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
            )}
            <span className="truncate font-medium text-zinc-300">{item.source}</span>
            <span>·</span>
            <span className="mono shrink-0">{now ? timeAgo(item.publishedAt, now) : ""}</span>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {item.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image} alt="" className="h-48 w-full object-cover sm:h-60" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
          )}
          <div className="p-4 sm:p-6">
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-gold-500/10 px-2 py-0.5 text-[10px] font-medium text-gold-200">{item.category}</span>
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", sent.cls)}>{sent.icon}{sent.label}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium ring-1", impactCls)}>{item.impact} impact</span>
              {item.tokens.map((t) => (
                <span key={t} className="mono rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-400">{t}</span>
              ))}
            </div>

            <h1 className="font-display text-xl font-bold leading-snug text-zinc-50 sm:text-2xl">{item.title}</h1>
            {item.summary && <p className="mt-3 text-[14px] leading-relaxed text-zinc-300">{item.summary}</p>}

            {/* Advanced AI briefing — the full story, on-site */}
            <div className="mt-4 rounded-xl border border-gold-500/20 bg-gold-500/[0.06] p-3.5 sm:p-4">
              <p className="mono inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gold-200">
                <Sparkles className="h-3.5 w-3.5" /> Full briefing · XYZ AI
              </p>
              {digest.loading && <p className="mt-2 inline-flex items-center gap-2 text-[13px] text-zinc-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Writing the full briefing…</p>}
              {digest.text && <MarkdownLite text={digest.text} className="mt-1" />}
              {digest.err && <p className="mt-1.5 text-[12px] text-amber-300">{digest.err}</p>}
              {!loggedIn && !digest.err && <p className="mt-1.5 text-[12px] text-zinc-500">Log in to read the full AI briefing of any story.</p>}
              <p className="mt-2 text-[10px] text-zinc-600">AI-generated from the headline &amp; excerpt. Not financial advice.</p>
            </div>
          </div>
        </div>

        {/* action bar */}
        <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2.5">
          <button onClick={onPrev} disabled={!hasPrev} aria-label="Previous story" className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100 disabled:opacity-30">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={onNext} disabled={!hasNext} aria-label="Next story" className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100 disabled:opacity-30">
            <ChevronRight className="h-5 w-5" />
          </button>
          <button onClick={onBookmark} aria-label="Bookmark" className={cn("rounded-lg p-2 transition-colors hover:bg-white/5", bookmarked ? "text-gold-300" : "text-zinc-400 hover:text-zinc-100")}>
            {bookmarked ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
          </button>
          <button onClick={share} aria-label="Share" className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100">
            <Share2 className="h-5 w-5" />
          </button>
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="btn-primary ml-auto inline-flex items-center gap-1.5 px-3 py-2 text-[13px]">
            Read original <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Image-rich, auto-rotating "Breaking" hero for high-impact stories. Click opens
// the on-site reader. Respects reduced motion.
function BreakingHero({ items, now, onOpen }: { items: NewsItem[]; now: number; onOpen: (id: string) => void }) {
  const reduce = useReducedMotion();
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const active = items[idx % items.length];

  useEffect(() => { setIdx(0); }, [items.length]);
  useEffect(() => {
    if (items.length < 2 || paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 6500);
    return () => clearInterval(t);
  }, [items.length, paused]);

  if (!active) return null;
  const sentTone = active.sentiment === "bullish" ? "text-mint-300" : active.sentiment === "bearish" ? "text-red-300" : "text-zinc-300";

  return (
    <div
      className="group relative h-56 cursor-pointer overflow-hidden rounded-2xl border border-white/10 sm:h-64"
      onClick={() => onOpen(active.id)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role="button"
      aria-label={`Breaking: ${active.title}`}
    >
      <AnimatePresence mode="popLayout">
        <motion.div
          key={active.id}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.2 : 0.8, ease: "easeOut" }}
          className="absolute inset-0"
        >
          {active.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={active.image} alt="" className="h-full w-full object-cover" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-red-500/25 via-ink-950 to-ink-950" />
          )}
        </motion.div>
      </AnimatePresence>

      {/* legibility gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/25" />

      {/* content */}
      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
        <div className="mb-2 flex items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg shadow-red-500/20">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
            </span>
            Breaking
          </span>
          <span className="font-medium text-zinc-200">{active.source}</span>
          <span className="text-zinc-400">·</span>
          <span className="mono text-zinc-400">{now ? timeAgo(active.publishedAt, now) : ""}</span>
          <span className={cn("ml-1 hidden font-medium sm:inline", sentTone)}>{active.sentiment === "neutral" ? "" : active.sentiment}</span>
        </div>
        <h2 className="max-w-3xl font-display text-lg font-bold leading-snug text-white drop-shadow sm:text-2xl">
          <span className="bg-gradient-to-r from-white to-white bg-[length:0%_2px] bg-left-bottom bg-no-repeat transition-[background-size] duration-300 group-hover:bg-[length:100%_2px]">{active.title}</span>
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {active.tokens.slice(0, 4).map((t) => (
            <span key={t} className="mono rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] text-white backdrop-blur-sm">{t}</span>
          ))}
          <span className="ml-1 inline-flex items-center gap-1 text-[11px] font-medium text-gold-200 opacity-0 transition-opacity group-hover:opacity-100">
            Read on XYZ <BookOpen className="h-3 w-3" />
          </span>
        </div>
      </div>

      {/* progress dots */}
      {items.length > 1 && (
        <div className="absolute right-3 top-3 flex gap-1.5">
          {items.map((it, i) => (
            <button
              key={it.id}
              onClick={(e) => { e.stopPropagation(); setIdx(i); }}
              aria-label={`Story ${i + 1}`}
              className={cn("h-1.5 rounded-full transition-all", i === idx % items.length ? "w-5 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
