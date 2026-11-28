"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search, Bookmark, BookmarkCheck, Share2, ExternalLink, Loader2,
  TrendingUp, TrendingDown, Minus, X, SlidersHorizontal, Check, Star, BookOpen,
  ChevronLeft, ChevronRight, ChevronDown, ArrowUp, Flame, Keyboard, List, Rows3,
} from "lucide-react";
import { RobotIcon } from "@/components/RobotIcon";
import { CATEGORIES, timeAgo, type NewsItem } from "@/lib/news";
import type { NewsPage } from "@/lib/news-fetch";
import { NewsAlertsToggle } from "@/components/NewsAlertsToggle";
import { BriefingBlock, type BriefingMeta } from "@/components/BriefingBlock";
import { NewsSocial } from "@/components/NewsSocial";
import { AwardXpOnView } from "@/components/AwardXpOnView";
import { useHydrated } from "@/lib/useClientFlag";
import { useScrollLock, scrollPageToSmooth } from "@/lib/useScrollLock";
import { cn } from "@/lib/utils";
import { useReducedMotionSafe } from "@/lib/useClientFlag";
import { MicButton } from "@/shared/components/MicButton";
import { hapticToggle } from "@shared/utils/haptics";
import { wakeIsDue } from "@shared/hooks/useLiveData";
import { useStickySidebar } from "@shared/hooks/useStickySidebar";
import { BackToTop, MoodMeter, ShortcutsSheet, TokenChip, useTickerMap, type Mood } from "@modules/news/components/NewsExtras";
import type { TickerCoin } from "@/lib/useTickerPoll";
import {
  NewsHeroIntro, HeroNetwork, TrendingTopics, HighImpactPanel, XyzAiBand, NewsletterPanel, CommunityPanel,
  NewsSheet, DiscoverSwitch, ImpactIcon,
} from "./NewsLayout";
import { photoSrc } from "@shared/utils/img";

/**
 * The topics that stay visible in the chip row. The full taxonomy is
 * `CATEGORIES`; the rest sits behind "More topics". Every entry must be a real
 * category, or its chip would filter to nothing - `news-redesign.test.ts` checks.
 */
export const PRIMARY_TOPICS = [
  "Breaking News", "Market News", "Bitcoin", "Ethereum", "AI", "DeFi", "Layer 2", "Airdrops", "Regulations", "Altcoins",
] as const;

// Share a SHORT on-site link (`/news/read?u=<source-url>`) - opens the story on
// our domain but stays tiny (just the source url), so it's easy to paste into a
// chat. (The old `?d=` token embedded the whole story and produced a huge link.)
async function shareStory(item: NewsItem) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/news/read?u=${encodeURIComponent(item.url)}`;
  try {
    if (navigator.share) await navigator.share({ title: item.title, url });
    else await navigator.clipboard.writeText(url);
  } catch { /* cancelled */ }
}

type Resp = { items: NewsItem[]; hasMore: boolean; live: boolean; page: number };

/**
 * An `<img>` that removes itself when the source fails to load.
 *
 * Six call sites in this file did it by hand, and all six reached into the DOM
 * from the error handler - `e.currentTarget.style.display = "none"`, and in the
 * card's case `e.currentTarget.parentElement.style.display = "none"`, which
 * hides a wrapper React owns and renders. Writing styles React does not know
 * about means the next render it does control can put them back, and a hidden
 * parent is invisible to anyone reading the JSX to work out why a card has no
 * image.
 *
 * Failure is a fact about this story, so it belongs in state. A remounted
 * element (the reader keys on `item.id`) starts clean, which is right - a new
 * story's image has not failed yet.
 */
function SafeImg({ src, photo, ...rest }: Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & { src?: string | null; photo?: number }) {
  // 0 = resized copy (photos only), 1 = the original, 2 = give up.
  const [stage, setStage] = useState(0);
  if (!src || stage > 1) return null;
  const url = photo && stage === 0 ? photoSrc(src, photo) ?? src : src;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" {...rest} onError={() => setStage((s) => (photo && s === 0 && url !== src ? 1 : 2))} />;
}
const SAVED_KEY = "xyz:news:saved"; // guests: full saved stories in localStorage

// Breaking-hero rotation state (per device). Capped so the list cannot grow
// without bound in localStorage; the oldest ids simply become eligible again,
// which is the right behaviour for a feed that moves on anyway.
const BREAKING_SEEN_KEY = "xyz:breakingSeen";
const BREAKING_SEEN_MAX = 120;

/**
 * How often the feed pulls `/api/news` for new stories.
 *
 * Named rather than inlined so `markets-poll-alignment.test.ts` can read it and
 * fail if that route's `revalidate` / `s-maxage` ever drop to or below it. This
 * route sat at exactly 90s against this exact 90s poll and produced the worst
 * ISR write ratio on the site (560 writes / 166 reads) - see NEWS_REVALIDATE.
 */
export const NEWS_POLL_MS = 90_000;

/** How far a horizontal drag must travel to change story. */
const SWIPE_COMMIT_PX = 60;
/** Shown until the reader has actually swiped once. */
const SWIPE_HINT_KEY = "xyz:news:swiped";
/** Stories this device has opened, capped like the breaking-seen list. */
const READ_KEY = "xyz:news:read";
const READ_MAX = 300;
/** When this device last left /news - drives the "New" badges. */
const VISIT_KEY = "xyz:news:lastVisit";
/** Compact list density, per device. */
const DENSITY_KEY = "xyz:news:density";

export function NewsClient({ initial }: { initial?: NewsPage | null }) {
  const { data: session } = useSession();
  const [category, setCategory] = useState("All");
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  // "top" is the server's ranking (impact-weighted recency, `rankNews`);
  // "latest" is plain newest-first. Both are orderings of real stories - there
  // is no view-count data, so there is no "Most read".
  const [sort, setSort] = useState<"top" | "latest">("top");
  // Time window over the loaded stories. Applied in `inFeed`, so the list, the
  // reader's prev/next and the sidebar all agree on what is in view.
  const [since, setSince] = useState<"any" | "24h" | "1h">("any");
  // Per-device reading state: which stories this reader has opened, and when
  // they last visited (for "New" badges). Presentation state only, so it lives
  // in localStorage and costs no request.
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [lastVisit, setLastVisit] = useState(0);
  // Sidebar: which discovery panel is showing, and whether its "See all" sheet is open.
  const [side, setSide] = useState<"trending" | "impact">("trending");
  const [sheet, setSheet] = useState<"trending" | "impact" | null>(null);
  const [items, setItems] = useState<NewsItem[]>(initial?.items ?? []);
  const [pending, setPending] = useState<NewsItem[]>([]); // fresh stories buffered for the "N new" pill

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(Boolean(initial?.hasMore));
  const [loading, setLoading] = useState(!initial);
  const [loadingMore, setLoadingMore] = useState(false);
  const [live, setLive] = useState(Boolean(initial?.live));
  const [now, setNow] = useState(() => 0);
  const [saved, setSaved] = useState<NewsItem[]>([]); // full stored stories (source of truth for Saved)
  const [interests, setInterests] = useState<string[]>([]);
  const [customizing, setCustomizing] = useState(false);
  // Why a save or a topic change did not stick. There was nowhere to put this
  // before, which is most of the reason both were swallowed.
  const [saveErr, setSaveErr] = useState<string | null>(null);
  // ⚠️ The open story is tracked by ID, never by index into `visible`.
  //
  // It used to be an index, and the 90s poll PREPENDS fresh stories to the feed
  // whenever the reader is near the top (see the insert block above). Every
  // index shifts by however many arrived - so a reader with story 5 open was
  // silently moved to a different article mid-read, and `onBookmark`, which
  // read `visible[readerIndex]`, saved the wrong story.
  const [readerId, setReaderId] = useState<string | null>(null);
  const loggedIn = Boolean(session?.user);
  // Headline-mood filter (from the sidebar meter), "unread only", list density,
  // and the shortcuts sheet. All presentation state; none of it costs a request.
  const [mood, setMood] = useState<Mood>("all");
  // "Unread only" hides what was read WHEN it was switched on, not what gets
  // read afterwards - otherwise opening a story would pull it out from under
  // the reader and the list would jump.
  const [hideRead, setHideRead] = useState<Set<string> | null>(null);
  const [compact, setCompact] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const prices = useTickerMap();

  const sentinel = useRef<HTMLDivElement>(null);
  const firstRun = useRef(true);
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);
  // Same pattern, for the refresh loop: it lives in an effect keyed on
  // `fetchPage`, so it cannot read `pending` as state without re-arming the
  // interval every time a story arrives.
  const pendingRef = useRef(pending);
  useEffect(() => { pendingRef.current = pending; }, [pending]);
  /** When the last refresh started - see the wake handler below. */
  const lastRefreshAt = useRef(0);

  // Start the "now" clock (client-only to avoid hydration drift).
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => {
      if (!document.hidden) setNow(Date.now());
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  // Load saved stories: from the DB when signed in (follows the account across
  // devices), else from localStorage for guests. Stored as full objects so the
  // Saved tab renders even after a story ages out of the live feed.
  useEffect(() => {
    if (loggedIn) {
      let active = true;
      fetch("/api/news/saved", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (active && Array.isArray(j?.items)) setSaved(j.items); })
        .catch(() => {});
      return () => { active = false; };
    }
    try {
      const raw = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
      if (Array.isArray(raw)) setSaved(raw);
    } catch { /* ignore */ }
  }, [loggedIn]);

  const savedUrls = useMemo(() => new Set(saved.map((s) => s.id)), [saved]);
  // By id, not index - the card already knows which story it is, and passing
  // an index would need a ref to the current list to resolve it (and would be
  // wrong the moment the list grew, which is the bug fixed above).
  const openReader = useCallback((id: string) => setReaderId(id), []);

  // Mark whatever the reader shows as read - from a card, the hero, the
  // sidebar, or prev/next inside the reader. Deferred a tick so it is not a
  // synchronous setState in the effect, and written outside any updater.
  const readRef = useRef(readIds);
  useEffect(() => { readRef.current = readIds; }, [readIds]);
  useEffect(() => {
    if (!readerId || readRef.current.has(readerId)) return;
    const t = setTimeout(() => {
      const next = new Set(readRef.current).add(readerId);
      readRef.current = next;
      setReadIds(next);
      try { localStorage.setItem(READ_KEY, JSON.stringify([...next].slice(-READ_MAX))); } catch { /* private mode */ }
    }, 0);
    return () => clearTimeout(t);
  }, [readerId]);

  // Restore reading state after mount (deferred, so the server render and the
  // first client render match), and stamp this visit when the tab is left.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const r = JSON.parse(localStorage.getItem(READ_KEY) || "[]");
        if (Array.isArray(r)) setReadIds(new Set(r));
        setLastVisit(Number(localStorage.getItem(VISIT_KEY)) || 0);
      } catch { /* ignore */ }
    }, 0);
    const stamp = () => { try { localStorage.setItem(VISIT_KEY, String(Date.now())); } catch { /* ignore */ } };
    const onHide = () => { if (document.hidden) stamp(); };
    window.addEventListener("pagehide", stamp);
    document.addEventListener("visibilitychange", onHide);
    return () => { clearTimeout(t); window.removeEventListener("pagehide", stamp); document.removeEventListener("visibilitychange", onHide); };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try { if (localStorage.getItem(DENSITY_KEY) === "compact") setCompact(true); } catch { /* ignore */ }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const toggleCompact = useCallback(() => {
    setCompact((c) => {
      try { localStorage.setItem(DENSITY_KEY, c ? "comfortable" : "compact"); } catch { /* ignore */ }
      return !c;
    });
  }, []);

  // "/" jumps to search, the shortcut readers expect from news and docs sites.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || el?.closest("input, textarea, [contenteditable='true']")) return;
      e.preventDefault();
      document.getElementById("news-search")?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // Tapping a token chip searches for it. Deliberately the existing search
  // rather than a new filter dimension: the search box already narrows the feed,
  // shows what it is narrowed by, and can be cleared - a hidden token filter
  // would be a state the reader could get stuck in with nothing to undo it.
  const searchToken = useCallback((t: string) => {
    setRawQuery(t);
    setCategory("All");
    // Not `window.scrollTo` - Lenis owns the scroll position and undoes a
    // native scroll it did not initiate on its next frame, so on desktop this
    // simply did not move. See scrollPageToSmooth.
    scrollPageToSmooth(0);
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
      // Only when the server actually had stories. An EMPTY server batch (the
      // feeds were unreachable at render time) used to count as "already
      // loaded", so the page sat on "nothing here" until the 90s poll.
      if (initial?.items?.length && category === "All" && !query) { setLoading(false); return; }
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

  // Load the next page (shared by infinite scroll + reader swipe-past-the-end).
  //
  // Returns what it actually appended, which the reader needs: swiping past the
  // last loaded story has to land on the first story of the next page, and
  // there is no other way to know which one that is at the moment of the swipe.
  const loadMore = useCallback(async (): Promise<NewsItem[]> => {
    if (loadingMore || !hasMore) return [];
    setLoadingMore(true);
    const next = page + 1;
    const r = await fetchPage(next);
    let added: NewsItem[] = [];
    if (r) {
      // Computed from the ref, not inside the updater: an updater must be pure,
      // and one that assigns to an outer variable is neither pure nor reliably
      // run before this function returns.
      const seen = new Set(itemsRef.current.map((i) => i.id));
      added = r.items.filter((i) => !seen.has(i.id));
      setItems((prev) => {
        // Re-checked against `prev` because the 90s poll can prepend stories
        // while this request is in flight.
        const known = new Set(prev.map((i) => i.id));
        return [...prev, ...added.filter((i) => !known.has(i.id))];
      });
      setHasMore(Boolean(r.hasMore));
      setPage(next);
    } else {
      setHasMore(false);
    }
    setLoadingMore(false);
    return added;
  }, [loadingMore, hasMore, page, fetchPage]);

  // Infinite scroll.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || loading) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, loadMore]);

  // Realtime: poll on the unfiltered view (90s - was 45s; the server-side feed
  // cache window doesn't refresh meaningfully faster than that, so polling
  // twice as often just doubled Function Invocations for no fresher data).
  // Fresh stories are buffered for a "N new stories" pill (Twitter-style)
  // instead of jumping the feed. (Real device notifications are handled by
  // NewsAlertsToggle / web-push.)
  useEffect(() => {
    // This used to bail out unless you were on the unfiltered "All" tab with no
    // search: `if (category !== "All" || query) return`. So on Bitcoin, DeFi,
    // Tech, For You, or any search, nothing refreshed at all - the feed you were
    // looking at was frozen from the moment it loaded until you navigated away
    // and back. That is the "news stuck ho jata hai" report, and it was every
    // tab except one. `fetchPage` already sends the active category and query,
    // so there was never a reason for the gate.
    const refresh = async () => {
      if (document.hidden) return; // don't poll while the tab is backgrounded
      lastRefreshAt.current = Date.now();
      const r = await fetchPage(1);
      if (!r?.items?.length) return;
      setLive(Boolean(r.live));

      // Buffering every new story behind a "N new stories" pill exists to stop
      // the feed jumping under someone who is reading partway down. At the top
      // of the feed there is nothing to jump - so insert straight away and let
      // the news actually arrive, rather than making the reader tap a pill to
      // see something they are already looking at the right place for.
      if (typeof window !== "undefined" && window.scrollY < 200) {
        const buffered = pendingRef.current;
        setItems((prev) => {
          const known = new Set(prev.map((i) => i.id));
          // De-dupe within the incoming batch too: a story can be in both the
          // pending buffer and this fetch.
          const byId = new Map<string, NewsItem>();
          for (const i of [...buffered, ...r.items]) if (!known.has(i.id)) byId.set(i.id, i);
          const fresh = [...byId.values()];
          return fresh.length ? [...fresh, ...prev] : prev;
        });
        if (buffered.length) setPending([]);
        return;
      }

      setPending((prevPending) => {
        const known = new Set([...itemsRef.current.map((i) => i.id), ...prevPending.map((i) => i.id)]);
        const fresh = r.items.filter((i) => !known.has(i.id));
        return fresh.length ? [...fresh, ...prevPending] : prevPending;
      });
    };

    const t = setInterval(refresh, NEWS_POLL_MS);

    // Refresh the moment the reader comes back, rather than making them wait out
    // whatever is left of a 90s tick. Returning to a tab is the point at which
    // stale content is most obvious, and this costs one request per return
    // instead of a faster background poll for everyone.
    // ⚠️ `visibilitychange` and `focus` both fire when a tab comes forward, so
    // this was TWO `/api/news` requests on every return, not one - and on a
    // phone, switching apps fires both every time. `wakeIsDue`'s 3s floor is
    // exactly the event-collapsing rule, and no more than that: news genuinely
    // does want to refresh eagerly on return, so it passes no minimum age and
    // keeps the behaviour the comment above describes.
    const onVisible = () => {
      if (!document.hidden && wakeIsDue(Date.now(), lastRefreshAt.current)) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [fetchPage]);

  // Reveal buffered stories at the top of the feed.
  const revealPending = useCallback(() => {
    setItems((prev) => {
      const seen = new Set(prev.map((i) => i.id));
      return [...pending.filter((i) => !seen.has(i.id)), ...prev];
    });
    setPending([]);
    // Same Lenis problem as `searchToken`. This one is worse: tapping "3 new
    // stories" prepended them ABOVE the reader's position and then failed to
    // move, so the pill vanished and the feed looked unchanged.
    scrollPageToSmooth(0);
  }, [pending]);

  /**
   * Toggle save. Optimistic, and it now UNDOES itself when the write fails.
   *
   * Two bugs lived in the old six lines, and they compounded.
   *
   * 1. **The request was fired from inside a `setSaved` updater.** A state
   *    updater must be pure - React is free to call it more than once for one
   *    update - so the POST/DELETE and the `localStorage.setItem` were sitting
   *    in the one place they must not be.
   * 2. **`.catch(() => {})` and no check on `res.ok`.** So a save that the
   *    server refused looked exactly like one it accepted: the bookmark filled
   *    in and stayed filled in until the next reload, when the story was simply
   *    gone. And refusal is not exotic - `/api/news/saved` shares the `like`
   *    rate-limit bucket, so bookmarking a few stories quickly returns a 429
   *    with a message, which the client threw away.
   *
   * The ref mirror keeps this callback stable (`NewsCard` is memoised, so a new
   * identity re-renders every card) while still letting it read current state.
   */
  const savedRef = useRef(saved);
  useEffect(() => { savedRef.current = saved; }, [saved]);

  const toggleSave = useCallback(async (item: NewsItem) => {
    hapticToggle(); // save / unsave is a state flip the reader should feel land
    const before = savedRef.current;
    const exists = before.some((s) => s.id === item.id);
    const next = exists ? before.filter((s) => s.id !== item.id) : [item, ...before];
    savedRef.current = next;
    setSaved(next);
    setSaveErr(null);

    // Undo THIS story only, rather than restoring the whole array - two toggles
    // in flight at once must not clobber each other's result.
    const rollback = (msg: string) => {
      const cur = savedRef.current;
      const has = cur.some((s) => s.id === item.id);
      const restored = exists
        ? (has ? cur : [item, ...cur])            // a removal that failed: put it back
        : cur.filter((s) => s.id !== item.id);    // an add that failed: take it out
      savedRef.current = restored;
      setSaved(restored);
      setSaveErr(msg);
    };

    if (!loggedIn) {
      try {
        localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      } catch {
        // Private mode, or the quota is full. Silently keeping it on screen
        // would promise a bookmark that is gone the moment the tab closes.
        rollback("Couldn't save on this device — storage is blocked or full.");
      }
      return;
    }

    try {
      const res = exists
        ? await fetch(`/api/news/saved?url=${encodeURIComponent(item.url)}`, { method: "DELETE" })
        : await fetch("/api/news/saved", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: item.url, title: item.title, summary: item.summary, source: item.source, image: item.image, category: item.category, publishedAt: item.publishedAt }),
          });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        rollback(j?.error ?? (exists ? "Couldn't remove that story." : "Couldn't save that story."));
      }
    } catch {
      rollback("You appear to be offline — nothing was saved.");
    }
  }, [loggedIn]);

  // Same shape, same reason: this was optimistic with `catch { /* best-effort */ }`,
  // so the Customize sheet closed on a save the server never accepted and the
  // member's topics silently reverted on the next load.
  const saveInterests = useCallback(async (next: string[]) => {
    const before = interests;
    setInterests(next);
    setSaveErr(null);
    try {
      const res = await fetch("/api/news/interests", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interests: next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setInterests(before);
        setSaveErr(j?.error ?? "Couldn't save your topics — they're unchanged.");
      }
    } catch {
      setInterests(before);
      setSaveErr("You appear to be offline — your topics are unchanged.");
    }
  }, [interests]);

  // The one rule that decides whether a story belongs in the current feed.
  // Shared with the reader, which has to know whether a story it just loaded
  // will actually be on screen before it navigates to it.
  const inBaseFeed = useCallback(
    (i: NewsItem) =>
      (category !== "For You" || !interests.length || i.categories.some((c) => interests.includes(c))) &&
      (since === "any" || !now || now - i.publishedAt <= (since === "1h" ? 3600e3 : 864e5)),
    [category, interests, since, now]
  );
  // The mood filter is part of the feed rule (so the reader's prev/next agree
  // with the list), but the meter counts the feed WITHOUT it - otherwise picking
  // "Bearish" would redraw the meter as 100% bearish.
  const inFeed = useCallback((i: NewsItem) => inBaseFeed(i) && (mood === "all" || i.sentiment === mood), [inBaseFeed, mood]);
  const moodItems = useMemo(() => items.filter(inBaseFeed), [items, inBaseFeed]);

  const visible = useMemo(() => {
    // Saved view renders the stored stories directly (survives feed aging out).
    if (savedOnly) {
      const q = query.toLowerCase();
      return q ? saved.filter((i) => (i.title + " " + i.summary).toLowerCase().includes(q)) : saved;
    }
    if (sort === "latest") return items.filter(inFeed).sort((a, b) => b.publishedAt - a.publishedAt);
    return items.filter(inFeed);
  }, [items, savedOnly, saved, query, inFeed, sort]);

  // The open story, resolved from the CURRENT list. Position is derived rather
  // than stored, so a feed that grew or was refiltered underneath the reader
  // cannot move them to a different article - `readerAt` simply follows the
  // story they actually have open.
  const readerAt = readerId ? visible.findIndex((v) => v.id === readerId) : -1;
  const readerItem = readerAt >= 0 ? visible[readerAt] : null;

  // Stories already shown in the breaking hero on this device.
  //
  // Fixing the timestamp alone is not enough, because there are several ways a
  // feed can keep claiming a story is new - a CMS bumping <updated>, a
  // republish, a rolling "latest" endpoint - and we cannot police the upstream.
  // This makes the symptom impossible regardless of the cause: once a story has
  // had its turn in the hero, it does not get another one.
  //
  // Kept per-device in localStorage rather than server-side on purpose: it is
  // presentation state, and this project is over its Supabase egress quota, so
  // it must not cost a request.
  // ⚠️ Read AFTER hydration, never in a lazy useState initialiser.
  //
  // It used to be `useState(() => typeof window === "undefined" ? [] :
  // localStorage…)`. That initialiser runs on the client's FIRST render too, so a
  // returning reader's hydration pass picked a different hero story than the
  // server sent - different image, different category - and React threw #418 on
  // every return visit to /news and re-rendered the page client-side (measured
  // 2026-11-18 in a dev build: `Hacks` vs `Market News`, two different image
  // URLs). Same class as the template.tsx incident in CLAUDE.md.
  //
  // useLayoutEffect runs after hydration but before the browser paints, so the
  // corrected hero is what the reader first sees: no mismatch and no flash.
  // `null` = not read yet; the "mark as seen" effect below waits for it, or it
  // would record the server's pick as seen before the real list arrived.
  const [seenBreaking, setSeenBreaking] = useState<string[] | null>(null);
  const seenRef = useRef<string[]>([]);
  useLayoutEffect(() => {
    let stored: string[] = [];
    try {
      const raw = window.localStorage.getItem(BREAKING_SEEN_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) stored = parsed as string[];
    } catch {
      /* private mode / corrupt value */
    }
    seenRef.current = stored;
    // Deliberately synchronous: this must land before the first paint, or the
    // reader sees the server's hero swap to the corrected one.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeenBreaking(stored);
  }, []);

  const breakingList = useMemo(() => {
    const seen = seenBreaking ?? [];
    const high = visible.filter((i) => i.impact === "High");
    const unseen = high.filter((i) => !seen.includes(i.id));
    // Never leave the hero empty: if everything high-impact has had its turn,
    // fall back to showing them anyway. A stale hero beats a missing one.
    return (unseen.length ? unseen : high).slice(0, 5);
  }, [visible, seenBreaking]);

  // Mark what is currently in the hero as spent, so the next visit rotates on.
  //
  // Writes straight to localStorage and does NOT setState. Feeding it back into
  // React state would re-run the memo above, drop the story being displayed out
  // of `unseen`, and swap the hero out from under the reader mid-view - the
  // filter is meant to apply on the NEXT visit, not this one. Keeping it in a
  // ref also avoids a setState-in-effect cascade.
  useEffect(() => {
    if (seenBreaking === null || !breakingList.length) return;
    const merged = [...new Set([...seenRef.current, ...breakingList.map((i) => i.id)])].slice(
      -BREAKING_SEEN_MAX
    );
    seenRef.current = merged;
    try {
      localStorage.setItem(BREAKING_SEEN_KEY, JSON.stringify(merged));
    } catch {
      /* storage full or unavailable - the session still behaves correctly */
    }
  }, [breakingList, seenBreaking]);


  // The hero panel: high-impact stories first; on a quiet day, the top of the
  // feed, so the hero is never empty while there is news to show.
  const featured = useMemo(() => (breakingList.length ? breakingList : items.filter(inFeed).slice(0, 3)), [breakingList, items, inFeed]);
  const isSaved = useCallback((id: string) => savedUrls.has(id), [savedUrls]);
  const topStories = useMemo(() => (savedOnly ? [] : visible.slice(0, 4)), [savedOnly, visible]);
  const restStories = useMemo(() => {
    const rest = savedOnly ? visible : visible.slice(4);
    return hideRead ? rest.filter((i) => !hideRead.has(i.id)) : rest;
  }, [savedOnly, visible, hideRead]);
  const markAllRead = useCallback(() => {
    const next = new Set(readRef.current);
    for (const i of visible) next.add(i.id);
    readRef.current = next;
    setReadIds(next);
    try { localStorage.setItem(READ_KEY, JSON.stringify([...next].slice(-READ_MAX))); } catch { /* private mode */ }
  }, [visible]);
  const unreadCount = useMemo(() => visible.filter((i) => !readIds.has(i.id)).length, [visible, readIds]);
  // Sidebar: the next most important stories that are not already on screen above.
  const topImpact = useMemo(() => {
    const shown = new Set([...topStories.map((i) => i.id), ...featured.map((i) => i.id)]);
    return visible.filter((i) => i.impact !== "Low" && !shown.has(i.id));
  }, [visible, topStories, featured]);
  const followTopic = useCallback(
    (c: string) => saveInterests(interests.includes(c) ? interests.filter((x) => x !== c) : [...interests, c]),
    [interests, saveInterests]
  );
  const isNew = useCallback((i: NewsItem) => lastVisit > 0 && i.publishedAt > lastVisit, [lastVisit]);
  const newCount = useMemo(() => restStories.filter(isNew).length, [restStories, isNew]);
  const isDefaultView = !savedOnly && !query && (category === "All" || category === "For You");
  const extraCategory = !PRIMARY_TOPICS.includes(category as (typeof PRIMARY_TOPICS)[number]) && category !== "All" && category !== "For You";
  const goToFeed = useCallback(() => {
    const el = document.getElementById("news-feed");
    if (el) scrollPageToSmooth(el.getBoundingClientRect().top + window.scrollY - 88);
  }, []);
  const pickTopic = useCallback((c: string) => {
    setSavedOnly(false);
    setCategory(c);
    goToFeed();
  }, [goToFeed]);

  const { ref: asideRef, style: asideStyle } = useStickySidebar(80);

  const tabs: { k: "latest" | "top" | "saved"; label: string }[] = [
    { k: "latest", label: "Latest" },
    { k: "top", label: "Top" },
    { k: "saved", label: saved.length ? `Saved (${saved.length})` : "Saved" },
  ];
  const activeTab = savedOnly ? "saved" : sort;
  const pickTab = (k: "latest" | "top" | "saved") => {
    if (k === "saved") { setSavedOnly(true); return; }
    setSavedOnly(false);
    setSort(k);
  };

  // Keyboard reading: j/k walk the feed, o/Enter opens, s saves, 1-3 switch
  // tabs, ? lists the keys. The highlight is a DOM attribute rather than React
  // state, so moving it does not re-render a list of memoised cards. Off while
  // the reader is open (it has its own ←/→/Esc) and while typing.
  const kbd = useRef({ at: -1, list: [] as NewsItem[], readerOpen: false, toggleSave, pickTab });
  useEffect(() => {
    kbd.current.list = [...topStories, ...restStories];
    kbd.current.readerOpen = Boolean(readerItem);
    kbd.current.toggleSave = toggleSave;
    kbd.current.pickTab = pickTab;
  });
  useEffect(() => {
    const mark = (id: string) => {
      document.querySelectorAll("[data-kbd]").forEach((el) => el.removeAttribute("data-kbd"));
      const el = document.querySelector(`[data-news-id="${CSS.escape(id)}"]`);
      if (!el) return;
      el.setAttribute("data-kbd", "1");
      // Centre it through the scroll helper - Lenis undoes a native scrollIntoView.
      const r = el.getBoundingClientRect();
      scrollPageToSmooth(r.top + window.scrollY - (window.innerHeight - r.height) / 2);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return;
      const k = kbd.current;
      if (k.readerOpen) return;
      if (e.key === "?") { e.preventDefault(); setKeysOpen(true); return; }
      if (e.key === "1" || e.key === "2" || e.key === "3") { k.pickTab(e.key === "1" ? "latest" : e.key === "2" ? "top" : "saved"); return; }
      const list = k.list;
      if (!list.length) return;
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        k.at = e.key === "j" ? Math.min(k.at + 1, list.length - 1) : Math.max(k.at - 1, 0);
        mark(list[k.at].id);
        return;
      }
      const cur = k.at >= 0 ? list[k.at] : null;
      if (!cur) return;
      // Enter on a focused button or link means that control, not the story.
      if ((e.key === "o" || (e.key === "Enter" && !t?.closest("button, a")))) { e.preventDefault(); setReaderId(cur.id); return; }
      if (e.key === "s") { e.preventDefault(); k.toggleSave(cur); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-6">
        {/* Hero: one compact strip - title on the left, the top story on the right. */}
        <section className="relative grid overflow-hidden rounded-3xl border border-hairline bg-surface lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="relative">
            <HeroNetwork />
            <div aria-hidden className="pointer-events-none absolute -left-24 -top-28 h-64 w-64 rounded-full bg-gold-500/10 blur-3xl" />
            <NewsHeroIntro onExplore={goToFeed} live={live} />
          </div>
          <div className="relative min-w-0 border-t border-hairline lg:border-l lg:border-t-0">
            {featured.length > 0 ? (
              <FeaturedStory items={featured} now={now} onOpen={openReader} isSaved={isSaved} onBookmark={toggleSave} />
            ) : loading ? (
              <div className="shimmer h-full min-h-[300px] bg-surface-2" aria-hidden />
            ) : (
              <div className="grid h-full min-h-[300px] place-items-center p-8 text-center">
                <p className="text-sm text-content-muted">The top story appears here as soon as the feed refreshes.</p>
              </div>
            )}
          </div>
        </section>

        {/* Discovery bar: search and topics in one aligned row. */}
        <div id="news-feed" className="scroll-mt-28 flex flex-col gap-2.5 rounded-2xl border border-hairline bg-surface p-2 lg:flex-row lg:items-center">
          <div className="relative min-w-0 lg:w-72 lg:shrink-0">
            <label htmlFor="news-search" className="sr-only">Search news</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle" />
            <input
              id="news-search"
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              placeholder="Search news, projects, tokens"
              className="h-9 w-full rounded-xl border border-hairline bg-surface-2 pl-9 pr-16 text-[13px] text-content placeholder:text-content-subtle focus:border-gold-500/50 focus:outline-none focus:ring-2 focus:ring-gold-500/20"
            />
            <MicButton
              size="sm"
              className="absolute right-8 top-1/2 -translate-y-1/2 !rounded-lg !ring-0"
              onText={(t) => setRawQuery((v) => (v ? `${v} ${t}` : t))}
            />
            {rawQuery && (
              <button onClick={() => setRawQuery("")} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-subtle hover:text-content">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <div className="flex min-w-0 flex-1 snap-x items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {loggedIn && (
                <button
                  onClick={() => setCategory("For You")}
                  aria-pressed={category === "For You"}
                  className={cn(
                    "inline-flex h-9 shrink-0 snap-start items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium leading-none transition-colors active:scale-95",
                    category === "For You" ? "bg-gold-400 text-ink" : "text-content-muted hover:bg-surface-2 hover:text-content"
                  )}
                >
                  <Star className="h-3.5 w-3.5" /> For You
                </button>
              )}
              {["All", ...PRIMARY_TOPICS, ...(extraCategory ? [category] : [])].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  aria-pressed={category === cat}
                  className={cn(
                    "inline-flex h-9 shrink-0 snap-start items-center rounded-xl px-3 text-[13px] font-medium leading-none transition-colors active:scale-95",
                    category === cat ? "bg-gold-400 text-ink" : "text-content-muted hover:bg-surface-2 hover:text-content"
                  )}
                >
                  {cat === "All" ? "All news" : cat}
                </button>
              ))}
            </div>
            <label className="relative shrink-0">
              <span className="sr-only">More topics</span>
              <select
                value=""
                onChange={(e) => { if (e.target.value) setCategory(e.target.value); }}
                className="h-9 w-[88px] appearance-none rounded-xl border border-hairline bg-surface-2 pl-3 pr-7 text-[13px] font-medium text-content-muted transition-colors hover:text-content focus:border-gold-500/50 focus:outline-none"
              >
                <option value="">More</option>
                {CATEGORIES.filter((c) => !PRIMARY_TOPICS.includes(c as (typeof PRIMARY_TOPICS)[number])).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle" />
            </label>
            {loggedIn && (
              <button onClick={() => setCustomizing(true)} aria-label="Customize feed" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-hairline bg-surface-2 text-content-muted transition-colors hover:text-content">
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Why a save or a topic change did not stick. The server has a specific
            answer for each - "Please log in to save stories.", "Too many
            requests. Please slow down." - and every one of them used to be
            discarded, leaving a bookmark that looked saved and was not. */}
        {saveErr && (
          <p role="status" className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-[12px] text-amber-200">
            {saveErr}
          </p>
        )}

        {/* Empty "For You" hint */}
        {category === "For You" && !interests.length && (
          <div className="rounded-2xl border border-dashed border-gold-500/25 bg-gold-500/[0.04] py-8 text-center">
            <p className="text-sm font-semibold text-content">Build your personalized feed</p>
            <p className="mt-1 text-sm text-content-muted">Pick the topics you care about to see only what matters to you.</p>
            <button onClick={() => setCustomizing(true)} className="btn-gold mt-4 px-4 py-2 text-sm">Choose topics</button>
          </div>
        )}

        {/* "N new stories" pill (Twitter-style) */}
        <AnimatePresence>
          {!savedOnly && pending.length > 0 && (
            <motion.div
              key="new-pill"
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              // On desktop the Latest/Top/Saved bar is sticky at top-20, so the pill
              // floats just below it there; on phones (bar not sticky) it keeps its
              // old place under the navbar.
              className="sticky top-20 z-30 flex justify-center lg:top-[9.5rem]"
            >
              <button onClick={revealPending} className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/40 bg-gold-500/15 px-4 py-1.5 text-[13px] font-semibold text-gold-100 shadow-lg shadow-black/30 backdrop-blur transition-colors hover:bg-gold-500/25">
                <ArrowUp className="h-3.5 w-3.5" /> {pending.length} new stor{pending.length === 1 ? "y" : "ies"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label="Loading stories">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="shimmer h-72 rounded-2xl bg-surface-2" />)}
          </div>
        ) : (
          topStories.length > 0 && (
            <section aria-labelledby="news-top">
              <h2 id="news-top" className="sr-only">{query ? `Results for ${query}` : "Top stories"}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {topStories.map((item, i) => (
                  <NewsCard
                    key={item.id}
                    variant="grid"
                    item={item}
                    index={i}
                    prices={prices}
                    now={now}
                    bookmarked={savedUrls.has(item.id)}
                    isNew={isNew(item)}
                    read={readIds.has(item.id)}
                    onBookmark={toggleSave}
                    onOpen={openReader}
                    onToken={searchToken}
                    onSource={searchToken}
                    loggedIn={loggedIn}
                  />
                ))}
              </div>
            </section>
          )
        )}

        {/* Latest news: one panel, one aligned header. */}
        {/* `overflow-clip`, not `overflow-hidden`: hidden makes the panel a scroll
            container, and a sticky header inside one never sticks to the page. */}
        <section aria-labelledby="news-latest" className="surface min-w-0 overflow-clip rounded-3xl">
          <h2 id="news-latest" className="sr-only">Latest news</h2>
          {/* On desktop the tab bar stays under the navbar while the list scrolls,
              so Latest / Top / Saved and the time window are always one tap away.
              Not on phones: it wraps to two rows there and would eat the screen.
              Opaque `bg-surface` (no opacity modifier: these tokens are plain
              vars and an `/95` silently emits nothing - see PointsNav). */}
          <div className="z-20 flex flex-wrap items-center gap-3 rounded-t-3xl border-b border-hairline bg-surface px-4 py-3 sm:px-5 lg:sticky lg:top-20">
            <div role="tablist" aria-label="News list" className="grid w-full grid-cols-3 gap-1 rounded-xl border border-hairline bg-surface-2 p-1 sm:w-auto">
              {tabs.map((t) => (
                <button
                  key={t.k}
                  role="tab"
                  aria-selected={activeTab === t.k}
                  onClick={() => pickTab(t.k)}
                  className={cn(
                    "relative h-8 rounded-lg px-4 text-[13px] font-semibold transition-colors active:scale-[0.97] sm:min-w-[96px]",
                    activeTab === t.k ? "text-ink" : "text-content-muted hover:text-content"
                  )}
                >
                  {/* One pill that slides between tabs (shared layoutId) instead
                      of three backgrounds swapping instantly. */}
                  {activeTab === t.k && (
                    <motion.span
                      layoutId="news-tab-pill"
                      aria-hidden
                      className="absolute inset-0 rounded-lg bg-gold-400 shadow-gold-sm"
                      transition={{ type: "spring", stiffness: 520, damping: 38 }}
                    />
                  )}
                  <span className="relative">{t.label}</span>
                </button>
              ))}
            </div>
            <div className="flex w-full items-center justify-between gap-2 sm:ml-auto sm:w-auto sm:justify-end">
              <div role="radiogroup" aria-label="Time window" className="inline-flex rounded-xl border border-hairline bg-surface-2 p-1">
                {(["any", "24h", "1h"] as const).map((w) => (
                  <button
                    key={w}
                    role="radio"
                    aria-checked={since === w}
                    onClick={() => setSince(w)}
                    className={cn("relative h-7 rounded-lg px-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider transition-colors", since === w ? "text-gold-300" : "text-content-subtle hover:text-content")}
                  >
                    {since === w && (
                      <motion.span
                        layoutId="news-since-pill"
                        aria-hidden
                        className="absolute inset-0 rounded-lg bg-surface shadow-sm"
                        transition={{ type: "spring", stiffness: 520, damping: 38 }}
                      />
                    )}
                    <span className="relative">{w === "any" ? "Any" : w}</span>
                  </button>
                ))}
              </div>
              <NewsAlertsToggle loggedIn={loggedIn} showPrefs />
            </div>
          </div>
          {!loading && (restStories.length > 0 || hideRead || mood !== "all") && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3 text-[12px] text-content-subtle sm:px-5">
              <span>{savedOnly ? `${restStories.length} saved` : `${restStories.length} more ${restStories.length === 1 ? "story" : "stories"}`}{since !== "any" ? ` · last ${since}` : ""}</span>
              {mood !== "all" && (
                <button
                  onClick={() => setMood("all")}
                  className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium", mood === "bullish" ? "bg-mint-500/15 text-mint-300" : "bg-red-500/15 text-red-300")}
                >
                  {mood === "bullish" ? "Bullish" : "Bearish"} only <X className="h-3 w-3" />
                </button>
              )}
              {newCount > 0 && !savedOnly && (
                <span className="inline-flex items-center gap-1.5 font-medium text-gold-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-400" /> {newCount} new since your last visit
                </span>
              )}
              <div className="ml-auto flex items-center gap-1">
                {!savedOnly && (
                  <button
                    onClick={() => setHideRead((h) => (h ? null : new Set(readIds)))}
                    aria-pressed={Boolean(hideRead)}
                    className={cn("rounded-lg px-2 py-1 font-medium transition-colors", hideRead ? "bg-gold-500/15 text-gold-300" : "hover:bg-surface-2 hover:text-content")}
                  >
                    Unread only{unreadCount ? ` · ${unreadCount}` : ""}
                  </button>
                )}
                {!savedOnly && unreadCount > 0 && (
                  <button onClick={markAllRead} className="hidden rounded-lg px-2 py-1 font-medium transition-colors hover:bg-surface-2 hover:text-content sm:inline-block">
                    Mark all read
                  </button>
                )}
                <button
                  onClick={toggleCompact}
                  aria-pressed={compact}
                  aria-label={compact ? "Comfortable view" : "Compact view"}
                  title={compact ? "Comfortable view" : "Compact view"}
                  className={cn("grid h-7 w-7 place-items-center rounded-lg transition-colors", compact ? "bg-gold-500/15 text-gold-300" : "hover:bg-surface-2 hover:text-content")}
                >
                  {compact ? <Rows3 className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => setKeysOpen(true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)" className="hidden h-7 w-7 place-items-center rounded-lg transition-colors hover:bg-surface-2 hover:text-content lg:grid">
                  <Keyboard className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
          <div className="px-4 pt-4 sm:px-5">
            {loading ? (
              <div className="space-y-4 pb-5">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="shimmer h-20 rounded-xl bg-surface-2" />)}</div>
            ) : restStories.length ? (
              restStories.map((item, i) => (
                <NewsCard
                  key={item.id}
                  item={item}
                  index={i}
                  compact={compact}
                  prices={prices}
                  now={now}
                  bookmarked={savedUrls.has(item.id)}
                  isNew={isNew(item)}
                  read={readIds.has(item.id)}
                  onBookmark={toggleSave}
                  onOpen={openReader}
                  onToken={searchToken}
                  onSource={searchToken}
                  loggedIn={loggedIn}
                />
              ))
            ) : (
              <div className="py-14 text-center">
                <p className="font-display text-base font-semibold text-content">{savedOnly ? "No saved stories yet" : visible.length ? "You're all caught up" : "No stories match"}</p>
                <p className="mt-1 text-sm text-content-muted">
                  {savedOnly ? "Tap the bookmark on any story to keep it here." : since !== "any" ? "Widen the time window or try another topic." : "Try another topic, clear the search, or check back shortly."}
                </p>
                {(since !== "any" || category !== "All" || query || mood !== "all" || hideRead) && !savedOnly && (
                  <button onClick={() => { setSince("any"); setCategory("All"); setRawQuery(""); setMood("all"); setHideRead(null); }} className="btn-ghost mx-auto mt-4 px-4 py-2 text-[13px]">Reset filters</button>
                )}
              </div>
            )}
            {/* Infinite-scroll sentinel */}
            {!savedOnly && hasMore && (
              <div ref={sentinel} className="flex justify-center py-6">
                {loadingMore && <Loader2 className="h-5 w-5 animate-spin text-content-subtle" />}
              </div>
            )}
          </div>
        </section>

        {isDefaultView && <XyzAiBand />}

        <p className="text-center text-[12px] text-content-subtle">
          Aggregated from CoinDesk, Cointelegraph, Decrypt and more. Not financial advice. Press <kbd className="rounded border border-hairline px-1 font-mono text-[11px]">/</kbd> to search.
        </p>
      </div>

      {/* Discovery sidebar: alongside everything on desktop, below the feed on smaller screens. */}
      {/* Sticky on desktop so the column never leaves an empty gap beside a long
          feed. It is usually taller than the viewport, and a plain `top` would
          hide its bottom (High impact was cut off once): useStickySidebar pins it
          by its BOTTOM in that case, so every card is reachable by scrolling. */}
      <aside ref={asideRef} style={asideStyle} className="min-w-0 space-y-5 xl:sticky xl:self-start" aria-label="Discover">
        <DiscoverSwitch value={side} onChange={setSide} />
        {side === "trending" ? (
          <TrendingTopics
            items={items}
            now={now}
            active={category}
            onPick={pickTopic}
            onClear={() => setCategory("All")}
            followed={loggedIn ? interests : null}
            onFollow={followTopic}
            onSeeAll={() => setSheet("trending")}
          />
        ) : (
          <HighImpactPanel
            items={topImpact}
            now={now}
            readIds={readIds}
            isSaved={isSaved}
            onOpen={openReader}
            onBookmark={toggleSave}
            onShare={shareStory}
            onSeeAll={() => setSheet("impact")}
          />
        )}
        <MoodMeter items={moodItems} active={mood} onPick={(m) => { setMood(m); if (m !== "all") goToFeed(); }} />
        <NewsletterPanel />
        <CommunityPanel />
      </aside>

      <BackToTop />
      <ShortcutsSheet open={keysOpen} onClose={() => setKeysOpen(false)} />

      {sheet === "trending" && (
        <NewsSheet title="All trending topics" icon={<Flame className="h-4 w-4" />} onClose={() => setSheet(null)}>
          <TrendingTopics
            bare
            limit={40}
            items={items}
            now={now}
            active={category}
            onPick={(c) => { setSheet(null); pickTopic(c); }}
            onClear={() => { setSheet(null); setCategory("All"); }}
            followed={loggedIn ? interests : null}
            onFollow={followTopic}
          />
        </NewsSheet>
      )}
      {sheet === "impact" && (
        <NewsSheet title="All high-impact stories" icon={<ImpactIcon className="h-4 w-4" />} onClose={() => setSheet(null)}>
          <HighImpactPanel
            bare
            limit={30}
            items={visible}
            now={now}
            readIds={readIds}
            isSaved={isSaved}
            onOpen={(id) => { setSheet(null); openReader(id); }}
            onBookmark={toggleSave}
            onShare={shareStory}
          />
        </NewsSheet>
      )}

      {customizing && (
        <CustomizeModal
          initial={interests}
          onClose={() => setCustomizing(false)}
          onSave={(next) => { saveInterests(next); setCustomizing(false); }}
        />
      )}

      <AnimatePresence>
        {readerItem && (
          <NewsReader
            key="news-reader"
            item={readerItem}
            now={now}
            loggedIn={loggedIn}
            bookmarked={savedUrls.has(readerItem.id)}
            onBookmark={() => toggleSave(readerItem)}
            hasPrev={readerAt > 0}
            hasNext={readerAt < visible.length - 1 || (!savedOnly && hasMore)}
            position={readerAt + 1}
            total={visible.length}
            // Neighbours are resolved from the CURRENT list at the moment of the
            // tap, so prev/next stay correct even if the feed grew underneath.
            onPrev={() => setReaderId((id) => {
              const i = visible.findIndex((v) => v.id === id);
              return i > 0 ? visible[i - 1].id : id;
            })}
            // ⚠️ At the LAST loaded story this used to do nothing at all: it
            // called `loadMore()` and returned the same id, so the swipe landed
            // on the story you were already reading.
            onNext={async () => {
              const i = visible.findIndex((v) => v.id === readerId);
              if (i < 0) return;
              if (i < visible.length - 1) {
                setReaderId(visible[i + 1].id);
                // Prefetch as we near the end so the next boundary is seamless.
                if (!savedOnly && i >= visible.length - 3) void loadMore();
                return;
              }
              if (savedOnly || !hasMore) return;
              // Await the page and land on its first story. Filtered by `inFeed`
              // because on "For You" a freshly loaded story may not be in this
              // feed at all, and navigating to one that is not on screen would
              // close the reader.
              const next = (await loadMore()).find(inFeed);
              if (next) setReaderId(next.id);
            }}
            // Only while the READER is waiting on a page - i.e. it is sitting
            // on the last loaded story. `loadingMore` on its own is true during
            // every background prefetch the infinite-scroll sentinel fires,
            // which would grey out a button that could advance perfectly well
            // inside the list already loaded.
            loadingNext={loadingMore && readerAt >= visible.length - 1}
            onClose={() => setReaderId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CustomizeModal({ initial, onClose, onSave }: { initial: string[]; onClose: () => void; onSave: (next: string[]) => void }) {
  useScrollLock();
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
        <div data-lenis-prevent className="max-h-[55svh] overflow-y-auto overscroll-contain p-4">
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

// Three gold-family washes, picked per category so neighbouring cards without
// images do not look identical. Brand colours only.
const BANNER_TONES = [
  "radial-gradient(120% 90% at 85% 0%, rgba(226,167,47,.38), transparent 60%), linear-gradient(160deg, #1d1a12, #0b0b0e)",
  "radial-gradient(120% 90% at 10% 0%, rgba(243,212,136,.30), transparent 60%), linear-gradient(200deg, #18160f, #08080a)",
  "radial-gradient(110% 80% at 50% 110%, rgba(209,143,27,.35), transparent 60%), linear-gradient(180deg, #121215, #0b0b0e)",
];
const toneFor = (s: string) => BANNER_TONES[[...s].reduce((n, ch) => n + ch.charCodeAt(0), 0) % BANNER_TONES.length];
const initials = (s: string) => s.replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "XYZ";

/**
 * The banner for a story whose feed has no image (or whose image failed): a
 * branded wash with the publisher's mark, so the grid stays even and the card
 * still says who published it. Not a stock photo standing in for the story.
 */
function StoryBanner({ item, compact = false }: { item: NewsItem; compact?: boolean }) {
  const [iconFailed, setIconFailed] = useState(false);
  const mark = item.sourceIcon && !iconFailed ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={item.sourceIcon} alt="" width={28} height={28} className="h-full w-full object-contain" onError={() => setIconFailed(true)} />
  ) : (
    <span className="font-mono text-[13px] font-bold tracking-tight !text-gold-200">{initials(item.source)}</span>
  );
  return (
    <span className="relative grid h-full w-full place-items-center overflow-hidden" style={{ backgroundImage: toneFor(item.category) }}>
      <span aria-hidden className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:22px_22px]" />
      <span className={cn("relative grid place-items-center rounded-xl border border-white/15 bg-white/10 p-2 shadow-lg backdrop-blur-sm", compact ? "h-9 w-9" : "h-14 w-14")}>{mark}</span>
      {!compact && (
        <span className="absolute bottom-3 right-3 max-w-[60%] truncate font-mono text-[10px] font-semibold uppercase tracking-[0.14em] !text-zinc-300/80">{item.source}</span>
      )}
    </span>
  );
}

const NewsCard = memo(function NewsCard({
  item, index, now, bookmarked, onBookmark, onOpen, onToken, onSource, loggedIn, variant = "row", isNew = false, read = false,
  compact = false, prices,
}: {
  item: NewsItem; index: number; now: number; bookmarked: boolean; onBookmark: (item: NewsItem) => void; onOpen: (id: string) => void; onToken: (t: string) => void; onSource: (s: string) => void; loggedIn: boolean;
  /** `grid`: the image-led Top stories card. `row`: the Latest feed row, with the AI actions. */
  variant?: "grid" | "row";
  /** Published after this device's last visit. */
  isNew?: boolean;
  /** Already opened on this device - shown quieter, never hidden. */
  read?: boolean;
  /** Compact density: no thumbnail, summary or tag row. */
  compact?: boolean;
  /** Shared ticker, for live 24h change on the token chips. */
  prices?: Map<string, TickerCoin>;
}) {
  const open = () => onOpen(item.id);
  const [why, setWhy] = useState<{ loading: boolean; text: string | null; err: string | null }>({ loading: false, text: null, err: null });
  const [digest, setDigest] = useState<{ loading: boolean; text: string | null; err: string | null; meta?: BriefingMeta; /** Deltas still arriving; `loading` ends at the first word, this at the last. */ streaming?: boolean }>({ loading: false, text: null, err: null });
  const [heroFailed, setHeroFailed] = useState(false);
  const [heroOrig, setHeroOrig] = useState(false);

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

  // Source, time and bookmark: the same line on both variants, so a story's
  // attribution reads identically wherever it appears.
  const metaRow = (
    <div className="flex min-w-0 items-center gap-2 text-[12px] text-content-subtle">
      <SafeImg src={item.sourceIcon} width={16} height={16} loading="lazy" className="h-4 w-4 shrink-0 rounded" />
      {/* Tapping the source filters to it. 29 feeds and no way to say "more
          from this one" (or "not this one") was the gap. Same reasoning as
          the token chips: it drives the visible search box rather than a
          hidden filter dimension, so it can be seen and undone. */}
      <button
        onClick={(e) => { e.stopPropagation(); onSource(item.source); }}
        className="min-w-0 truncate font-medium text-content-muted transition-colors hover:text-gold-300"
      >
        {item.source}
      </button>
      <span aria-hidden>·</span>
      {/* A real <time>, not a bare span. `timeAgo` is the readable form and
          `dateTime` is the machine-readable one; `title` gives the absolute
          timestamp on hover, which "3h ago" alone never could. */}
      <time
        className="mono shrink-0"
        dateTime={item.publishedAt ? new Date(item.publishedAt).toISOString() : undefined}
        title={item.publishedAt ? new Date(item.publishedAt).toUTCString() : undefined}
      >
        {now ? timeAgo(item.publishedAt, now) : ""}
      </time>
      <button
        onClick={(e) => { e.stopPropagation(); onBookmark(item); }}
        aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
        aria-pressed={bookmarked}
        className={cn("ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors hover:bg-surface-2", bookmarked ? "text-gold-400" : "hover:text-content")}
      >
        {bookmarked ? <BookmarkCheck className="h-4 w-4 animate-pop-in" /> : <Bookmark className="h-4 w-4" />}
      </button>
    </div>
  );

  // The image, or a branded fallback with the source mark. The wrapper is
  // part of the fallback decision, so a dead image never leaves a black box.
  const media = (cls: string) => (
    <button onClick={open} className={cn("group/img relative block shrink-0 overflow-hidden bg-surface-2", cls)} aria-label={`Read: ${item.title}`}>
      {item.image && !heroFailed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={heroOrig ? item.image : photoSrc(item.image, variant === "row" ? 320 : 720) ?? item.image}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-[1.04] group-active/card:scale-[1.04]"
          // Resized copy first, then the original, then the branded banner.
          onError={() => (heroOrig ? setHeroFailed(true) : setHeroOrig(true))}
        />
      )}
      {(!item.image || heroFailed) && <StoryBanner item={item} compact={variant === "row"} />}
    </button>
  );

  if (variant === "grid") {
    return (
      // CSS entrance from PAINT (`hero-rise`), not framer's whileInView: a card
      // that waits for an IntersectionObserver ships at opacity 0, which is
      // invisible to crawlers, full-page captures, and anyone whose JS failed.
      <article
        style={{ ["--rise-delay" as string]: `${Math.min(index, 7) * 0.06}s`, ["--rise-y" as string]: "12px" }}
        data-news-id={item.id}
        className="hero-rise surface surface-hover group/card relative flex h-full flex-col overflow-hidden rounded-2xl"
      >
        <div className="relative">
          {media("aspect-[16/10] w-full")}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
          <span className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-black/60 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] !text-gold-200 backdrop-blur-sm">
            {item.category}
          </span>
          <div className="pointer-events-none absolute left-3 top-3 flex gap-1.5">
            {item.impact === "High" && (
              <span className="rounded-md bg-red-500/90 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] !text-white">Breaking</span>
            )}
            {isNew && !read && <span className="rounded-md bg-gold-400 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] !text-ink">New</span>}
          </div>
          {read && <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-[10.5px] font-medium !text-zinc-200 backdrop-blur-sm"><Check className="h-3 w-3" /> Read</span>}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <button onClick={open} className="text-left">
            <h3 className="line-clamp-3 min-h-[3.6rem] font-display text-[15px] font-semibold leading-[1.3] tracking-[-0.01em] text-content transition-colors group-hover/card:text-gold-200">{item.title}</h3>
          </button>
          {item.summary && <p className="line-clamp-2 text-[13px] leading-relaxed text-content-muted">{item.summary}</p>}
          <div className="mt-auto pt-2">{metaRow}</div>
        </div>
      </article>
    );
  }

  return (
    // content-visibility, sized for THIS row: `.cv-auto` reserves 340px (the old
    // tall card), which made the list jump and look empty until scrolled into.
    <article
      data-index={index}
      data-news-id={item.id}
      // A one-shot CSS rise from paint (no JS needed to become visible), staggered
      // for the first screenful only so a long list does not wait in line.
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: compact ? "auto 72px" : "auto 128px",
        ["--rise-delay" as string]: `${Math.min(index, 8) * 0.045}s`,
        ["--rise-y" as string]: "10px",
        ["--rise-dur" as string]: "0.45s",
      }}
      className={cn(
        "hero-rise group/card relative -mx-2 flex gap-4 rounded-xl border-b border-hairline px-2 transition-colors duration-200 last:border-b-0 hover:bg-surface-2",
        compact ? "py-2.5" : "py-4"
      )}
    >
      {!compact && media("aspect-[4/3] w-20 self-start rounded-lg sm:w-32")}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2 text-[11px]">
          <span className="font-mono font-semibold uppercase tracking-[0.12em] text-gold-400">{item.category}</span>
          {item.impact === "High" && <span className="rounded bg-red-500/15 px-1.5 py-px font-mono text-[10px] font-semibold uppercase tracking-wider text-red-300">Breaking</span>}
          {isNew && !read && <span className="rounded bg-gold-400 px-1.5 py-px font-mono text-[10px] font-bold uppercase tracking-wider text-ink">New</span>}
          {read && <span className="inline-flex items-center gap-0.5 text-content-subtle"><Check className="h-3 w-3" /> Read</span>}
          {item.sentiment !== "neutral" && (
            <span className={cn("inline-flex items-center gap-0.5 font-medium", item.sentiment === "bullish" ? "text-mint-400" : "text-red-400")}>
              {sentBadge.icon}{sentBadge.label}
            </span>
          )}
        </div>
        <button onClick={open} className="text-left">
          <h3 className={cn("line-clamp-2 font-display text-[15px] font-semibold leading-snug transition-colors group-hover/card:text-gold-200", read ? "text-content-muted" : "text-content")}>{item.title}</h3>
        </button>
        <p className="mt-1 truncate text-[11.5px] text-content-subtle sm:hidden">
          <span className="font-medium text-content-muted">{item.source}</span>{now ? ` · ${timeAgo(item.publishedAt, now)}` : ""}
        </p>
        {!compact && item.summary && <div className="mt-1 hidden sm:block"><p className="line-clamp-1 text-[13px] leading-relaxed text-content-muted">{item.summary}</p></div>}

        {/* badges */}
        <div className={cn("mt-1.5 flex-wrap items-center gap-1.5 empty:hidden", compact ? "hidden" : "flex")}>
          {/* Every category the story matched, not just the primary one.
              `categories` has always been computed and shipped - it drives the
              "For You" filter and push targeting - but only `category` was ever
              rendered, so a story matching Hacks + Security + DeFi + Ethereum
              showed exactly one tag. Capped at two extras so a busy story does
              not turn the card into a tag cloud. */}
          {item.categories
            .filter((c) => c !== item.category)
            .slice(0, 2)
            .map((c) => (
              <span key={c} className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-content-muted">
                {c}
              </span>
            ))}
          {/* Tokens were inert <span>s. Tapping one searches the feed for it.
              `stopPropagation` because the whole card opens the reader, and a
              tap on a chip means the chip. */}
          {/* Each chip also shows the token's live 24h change when the shared
              ticker carries it - the market's reaction next to the headline. */}
          {item.tokens.map((t) => (
            <TokenChip key={t} symbol={t} coin={prices?.get(t.toUpperCase())} onClick={onToken} />
          ))}
        </div>

        {/* why-matters result */}
        {why.text && (
          <div className="mt-3 rounded-xl border border-gold-500/20 bg-gold-500/[0.06] p-3">
            <p className="mono text-[10px] font-semibold uppercase tracking-wide text-gold-300">Why this matters · XYZ AI</p>
            <p className="mt-1 text-[13px] leading-relaxed text-content">{why.text}</p>
          </div>
        )}
        {why.err && <p className="mt-2 text-[11px] text-amber-300">{why.err}</p>}

        {/* AI digest - read the whole story on-site */}
        {digest.text && (
          <div className="mt-3 rounded-xl border border-gold-500/20 bg-gold-500/[0.06] p-3">
            <p className="mono text-[10px] font-semibold uppercase tracking-wide text-gold-300">AI Summary · XYZ AI</p>
            <p className="mt-1 text-[13px] leading-relaxed text-content">{digest.text}</p>
          </div>
        )}
        {digest.err && <p className="mt-2 text-[11px] text-amber-300">{digest.err}</p>}

        {/* One footer line: attribution on the left, actions on the right. On
            phones the attribution moves above, so the actions keep one row. */}
        <div className="mt-2 flex items-center gap-x-2 text-[12px] text-content-subtle">
          <span className="hidden min-w-0 items-center gap-x-2 sm:flex">
            <SafeImg src={item.sourceIcon} width={14} height={14} loading="lazy" className="h-3.5 w-3.5 shrink-0 rounded" />
            <button
              onClick={(e) => { e.stopPropagation(); onSource(item.source); }}
              className="min-w-0 truncate font-medium text-content-muted transition-colors hover:text-gold-300"
            >
              {item.source}
            </button>
            <span aria-hidden>·</span>
            <time
              className="mono shrink-0"
              dateTime={item.publishedAt ? new Date(item.publishedAt).toISOString() : undefined}
              title={item.publishedAt ? new Date(item.publishedAt).toUTCString() : undefined}
            >
              {now ? timeAgo(item.publishedAt, now) : ""}
            </time>
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            <button onClick={readSummary} disabled={digest.loading} className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 font-medium text-gold-300 transition-colors hover:bg-gold-500/10 disabled:opacity-50">
              {digest.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}<span className="hidden sm:inline">AI Summary</span>
            </button>
            <button onClick={whyMatters} disabled={why.loading} className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 font-medium text-gold-300 transition-colors hover:bg-gold-500/10 disabled:opacity-50">
              {why.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RobotIcon className="h-3.5 w-3.5" />}<span className="hidden sm:inline">Why it matters</span>
            </button>
            <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label="Original source" className="hidden h-7 w-7 place-items-center rounded-lg transition-colors hover:bg-surface-2 hover:text-content sm:grid">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <button onClick={share} aria-label="Share" className="grid h-7 w-7 place-items-center rounded-lg transition-colors hover:bg-surface-2 hover:text-content"><Share2 className="h-3.5 w-3.5" /></button>
            <button
              onClick={(e) => { e.stopPropagation(); onBookmark(item); }}
              aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
              aria-pressed={bookmarked}
              className={cn("grid h-7 w-7 place-items-center rounded-lg transition-colors hover:bg-surface-2", bookmarked ? "text-gold-400" : "hover:text-content")}
            >
              {bookmarked ? <BookmarkCheck className="h-4 w-4 animate-pop-in" /> : <Bookmark className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
});

// On-site reader: read the story (headline, image, summary, AI digest) without
// bouncing off-site, with prev/next through the current list. Keyboard: Esc to
// close, ←/→ to navigate.
function NewsReader({
  item, now, loggedIn, bookmarked, onBookmark, hasPrev, hasNext, onPrev, onNext, onClose, position, total, loadingNext,
}: {
  item: NewsItem; now: number; loggedIn: boolean; bookmarked: boolean; onBookmark: () => void;
  hasPrev: boolean; hasNext: boolean; onPrev: () => void; onNext: () => void; onClose: () => void;
  /** 1-based place in the feed, and how many stories are loaded. */
  position: number; total: number;
  /** True while `onNext` is fetching the next page - the reader says so. */
  loadingNext: boolean;
}) {
  const [digest, setDigest] = useState<{ loading: boolean; text: string | null; err: string | null; meta?: BriefingMeta; /** Deltas still arriving; `loading` ends at the first word, this at the last. */ streaming?: boolean }>({ loading: false, text: null, err: null });
  const [progress, setProgress] = useState(0); // reading scroll progress (0-1)
  const bodyRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  // Guards a manually-triggered fetch against resolving after the reader has
  // already moved to a different story (generateDigest is a click handler now,
  // not an effect, so it has no automatic cleanup on item change/unmount).
  const digestItemId = useRef(item.id);
  const scrollRaf = useRef(0);

  // Freeze the feed behind the reader. Without it the wheel fell through to
  // /news once the briefing was short enough not to scroll on its own, or once
  // it hit its end - so closing the reader dropped you somewhere else entirely.
  // Note `body { overflow: hidden }` alone would NOT do this: Lenis drives the
  // scroll position itself and ignores overflow (see useScrollLock).
  useScrollLock();

  // Portalled to document.body, for the same reason the follow dialog is.
  // `position: fixed` only means "the viewport" while no ancestor establishes a
  // containing block, and plenty of ordinary styling does - transform, filter,
  // backdrop-filter, contain. Measured at 1280x800 before this: the reader's
  // `fixed inset-0` overlay resolved to **1280x780 starting at y=20** rather
  // than filling the viewport, so it was anchored to a wrapper on the page
  // instead of the screen. A portal takes it out of that subtree entirely,
  // which is a fix that cannot regress when someone adds a filter or a
  // transform to a parent later.
  const mounted = useHydrated();

  // rAF-throttled - a plain onScroll handler would setState on every native
  // scroll event (mirrors the fix already applied in ReadingProgress.tsx).
  const onBodyScroll = () => {
    if (scrollRaf.current) return;
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = 0;
      const el = bodyRef.current;
      if (!el) return;
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? Math.min(1, el.scrollTop / max) : 0);
    });
  };

  // Mobile swipe: horizontal-dominant drag -> prev/next.
  //
  // This used to be touchstart + touchend only, with nothing in between: the
  // story did not follow your finger, there was no rubber-band, no way to
  // change your mind mid-gesture, and no way to discover the gesture existed
  // beyond a 10px `text-zinc-600` label reading "swipe < >" that is effectively
  // invisible on a dark panel. A gesture nobody can see and that gives no
  // feedback while it happens is a gesture nobody uses.
  //
  // `drag` is the live offset. It is committed to state rather than written
  // straight to the DOM because the panel is a framer-motion element and an
  // inline transform would be overwritten by its own animation frame - the same
  // conflict documented on the hero medallion.
  const [drag, setDrag] = useState(0);
  const dragging = useRef(false);

  // The coach mark. Read once on mount rather than during render: a lazy
  // initialiser runs on the server too, and anything derived from storage that
  // reaches the DOM on the first render is the hydration trap in CLAUDE.md.
  const [showSwipeHint, setShowSwipeHint] = useState(() => {
    // Safe to read storage in a lazy initialiser HERE specifically because the
    // reader is only ever mounted by a tap, i.e. always after hydration - there
    // is no server-rendered output for a client-only value to disagree with.
    // In a component that renders on the server this would be the #418 trap.
    if (typeof window === "undefined") return false;
    try {
      return !localStorage.getItem(SWIPE_HINT_KEY);
    } catch {
      return false; // private mode: the hint simply never shows
    }
  });
  const dismissSwipeHint = () => {
    setShowSwipeHint(false);
    try {
      localStorage.setItem(SWIPE_HINT_KEY, "1");
    } catch {
      /* it will show again next time; harmless */
    }
  };

  const onTouchStart = (e: ReactTouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    dragging.current = false;
  };

  const onTouchMove = (e: ReactTouchEvent) => {
    const s = touchStart.current;
    if (!s) return;
    const dx = e.touches[0].clientX - s.x;
    const dy = e.touches[0].clientY - s.y;
    // Claim the gesture only once it is clearly horizontal, so a normal
    // vertical read is never hijacked. Once claimed, it stays claimed for the
    // rest of the gesture - otherwise a slightly diagonal swipe flickers
    // between scrolling and dragging.
    if (!dragging.current) {
      if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      dragging.current = true;
      // Learned. Dismiss on the gesture STARTING, not on it committing: a
      // cancelled swipe still proves the reader knows the gesture is there.
      if (showSwipeHint) dismissSwipeHint();
    }
    // Resistance at the ends: it moves, so the gesture is acknowledged, but it
    // moves badly, which is how a phone says "there is nothing that way".
    const blocked = (dx < 0 && !hasNext) || (dx > 0 && !hasPrev);
    setDrag(blocked ? dx * 0.25 : dx);
  };

  const onTouchEnd = (e: ReactTouchEvent) => {
    const s = touchStart.current;
    touchStart.current = null;
    const wasDragging = dragging.current;
    dragging.current = false;
    setDrag(0);
    if (!s || !wasDragging) return;
    const dx = e.changedTouches[0].clientX - s.x;
    const dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) > SWIPE_COMMIT_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0 && hasNext) onNext();
      else if (dx > 0 && hasPrev) onPrev();
    }
  };

  // Reset progress to the top on each story. Adjusted during render rather than
  // in an effect so the progress bar never paints the previous story's value.
  const [prevItemId, setPrevItemId] = useState(item.id);
  if (prevItemId !== item.id) {
    setPrevItemId(item.id);
    setProgress(0);
  }
  // The scroll reset is a real DOM side effect, so it stays in an effect.
  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [item.id]);

  useEffect(() => () => { if (scrollRaf.current) cancelAnimationFrame(scrollRaf.current); }, []);

  // Keyboard nav + scroll lock while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && hasPrev) onPrev();
      else if (e.key === "ArrowRight" && hasNext) onNext();
    };
    document.addEventListener("keydown", onKey);
    // The hand-rolled `body { overflow: hidden }` that used to live here is
    // gone: Lenis drives the scroll position itself and ignores overflow, so it
    // never actually held the feed still. `useScrollLock` above does, and two
    // competing locks would fight over restoring the original value anyway.
    return () => document.removeEventListener("keydown", onKey);
  }, [hasPrev, hasNext, onPrev, onNext, onClose]);

  // Reset the AI digest whenever the story changes - generation is now on-demand
  // (a "Generate briefing" button in BriefingBlock) rather than auto-firing on
  // every story open, to cut AI invocation volume.
  useEffect(() => {
    digestItemId.current = item.id;
    setDigest({ loading: false, text: null, err: null });
  }, [item.id]);

  /**
   * The briefing, streamed - same path the points band uses.
   *
   * ⚠️ One-shot generation is what made this feel broken. A full briefing is
   * 650-900 words from the quality model: as one response that is a 20-40
   * second silence ending in either a wall of text or a timeout, and the
   * ceiling that makes it finish is the same ceiling that makes it slow. Four
   * rounds were spent trading those against each other.
   *
   * Streamed, the first words land in about a second and the rest arrives as it
   * is written, so "fast" and "complete" stop competing.
   *
   * `digestItemId` still guards every write: the reader can page to the next
   * story mid-stream, and a delta arriving after that must not be appended to
   * a different article's briefing.
   */
  const generateDigest = useCallback(async () => {
    if (!loggedIn) return;
    const forItemId = item.id;
    setDigest({ loading: true, text: null, err: null });
    try {
      const res = await fetch("/api/ai/why-matters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: item.title, summary: item.summary, mode: "briefing", stream: true }),
      });

      // An error is refused before the stream starts, so it is still JSON. The
      // content type says which shape arrived - reading an error body as a
      // stream would render the error object as the briefing.
      if (!res.ok || !res.body || res.headers.get("content-type")?.includes("application/json")) {
        const j = await res.json().catch(() => ({}));
        if (digestItemId.current === forItemId) {
          setDigest({ loading: false, text: null, err: j.error || "Couldn't generate a summary." });
        }
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (digestItemId.current !== forItemId) return; // reader moved on
        acc += decoder.decode(value, { stream: true });
        setDigest({ loading: false, text: acc, err: null, streaming: true });
      }
      acc += decoder.decode();
      if (digestItemId.current !== forItemId) return;
      if (!acc.trim()) {
        setDigest({ loading: false, text: null, err: "The briefing came back empty. Please try again." });
        return;
      }
      setDigest({ loading: false, text: acc, err: null, streaming: false });
    } catch {
      if (digestItemId.current === forItemId) setDigest({ loading: false, text: null, err: "Network error." });
    }
  }, [item.id, item.title, item.summary, loggedIn]);

  const share = () => shareStory(item);

  const sent =
    item.sentiment === "bullish" ? { cls: "bg-mint-500/15 text-mint-300", icon: <TrendingUp className="h-3 w-3" />, label: "Bullish" }
    : item.sentiment === "bearish" ? { cls: "bg-red-500/15 text-red-300", icon: <TrendingDown className="h-3 w-3" />, label: "Bearish" }
    : { cls: "bg-white/5 text-zinc-400", icon: <Minus className="h-3 w-3" />, label: "Neutral" };
  const impactCls = item.impact === "High" ? "text-red-300 ring-red-500/30" : item.impact === "Medium" ? "text-amber-300 ring-amber-500/30" : "text-zinc-400 ring-white/10";

  if (!mounted) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={item.title}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
        // panel-solid: the reader is a dialog OVER the feed, and `.surface`
        // alone is translucent - so the feed behind it, article thumbnails
        // included, showed straight through and the briefing text ended up
        // sitting on a photograph. The blur softened it without fixing the
        // contrast. Solid base underneath, same glass material on top.
        //
        // svh, not vh: on a phone the reader is full-height, and vh measures
        // the viewport as if the browser chrome were hidden, so the action bar
        // ("Read original", prev/next) sat under the address bar.
        className="panel-solid surface relative flex max-h-[100svh] w-full max-w-2xl flex-col overflow-hidden sm:max-h-[90svh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        // Follows the finger while dragging, springs back when it lets go.
        // `transform` only - no layout, no paint, so it stays smooth on the
        // phones this gesture exists for.
        style={{
          transform: drag ? `translateX(${drag}px)` : undefined,
          transition: drag ? "none" : "transform 220ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <AwardXpOnView action="news_read" keyId={item.id} />

        {/* First-run swipe coach mark.
            Shown once per device, dismissed the moment the reader actually
            swipes - a hint that keeps appearing after you have learned the
            gesture is nagging, not teaching. Touch only: there is no swipe on a
            mouse, and the chevrons next to it are the discoverable path there.
            The arrow animation is what carries the meaning; a static label was
            what we had, and it taught nobody. */}
        {showSwipeHint && (
          <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 justify-center sm:hidden">
            <span className="news-swipe-hint inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-ink-950/85 px-3.5 py-2 text-[12px] font-medium text-gold-100 shadow-elevate backdrop-blur">
              <ChevronLeft className="news-swipe-arrow-l h-4 w-4" />
              Swipe for the next story
              <ChevronRight className="news-swipe-arrow-r h-4 w-4" />
            </span>
          </div>
        )}
        {/* reading progress */}
        <div className="absolute inset-x-0 top-0 z-10 h-0.5 bg-transparent">
          <div className="h-full bg-gradient-to-r from-gold-500 to-gold-300 transition-[width] duration-150" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        {/* top bar */}
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2 text-[12px] text-zinc-400">
            <SafeImg src={item.sourceIcon} width={16} height={16} className="h-4 w-4 rounded" />
            <span className="truncate font-medium text-zinc-300">{item.source}</span>
            <span>·</span>
            <span className="mono shrink-0">{now ? timeAgo(item.publishedAt, now) : ""}</span>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body.
            `data-lenis-prevent` + `overscroll-contain` are what keep the wheel
            IN here. Neither was set, and the two together are what the reported
            "poora page scroll ho jata hai" needed:
            - Lenis's own rule only hands the wheel back to a box that is
              *currently* taller than its frame, so a short briefing (or one
              still loading) let Lenis scroll the feed behind the dialog. The
              attribute makes it unconditional.
            - `overscroll-contain` stops the native chain once this box hits its
              top or bottom, which is the other half of the same complaint.
            `useScrollLock` on the panel handles everything outside the wheel. */}
        <div
          ref={bodyRef}
          data-lenis-prevent
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          onScroll={onBodyScroll}
        >
          <motion.div key={item.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
          <SafeImg src={item.image} photo={960} decoding="async" className="h-48 w-full object-cover sm:h-60" />
          <div className="p-4 sm:p-6">
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-gold-500/10 px-2 py-0.5 text-[10px] font-medium text-gold-200">{item.category}</span>
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", sent.cls)}>{sent.icon}{sent.label}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium ring-1", impactCls)}>{item.impact} impact</span>
              {item.tokens.map((t) => (
                <span key={t} className="mono rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-400">{t}</span>
              ))}
            </div>

            <h1 className="font-display text-[22px] font-bold leading-tight tracking-[-0.01em] text-zinc-50 sm:text-[30px] sm:leading-[1.15]">{item.title}</h1>
            {item.summary && <p className="mt-3 text-[15px] leading-relaxed text-zinc-300">{item.summary}</p>}

            {/* Advanced AI briefing - the full story on-site, with Listen + Hinglish */}
            <BriefingBlock
              englishText={digest.text}
              meta={digest.meta}
              loading={digest.loading}
              err={digest.err}
              title={item.title}
              summary={item.summary}
              loggedIn={loggedIn}
              onGenerate={generateDigest}
              className="mt-4"
            />
            <NewsSocial url={item.url} loggedIn={loggedIn} now={now} />
          </div>
          </motion.div>
        </div>

        {/* action bar */}
        <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2.5">
          <button onClick={onPrev} disabled={!hasPrev} aria-label="Previous story" className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100 disabled:opacity-30">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={onNext} disabled={!hasNext || loadingNext} aria-label="Next story" className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100 disabled:opacity-30">
            {/* Says "fetching", where before the tap simply had no effect. */}
            {loadingNext ? <Loader2 className="h-5 w-5 animate-spin" /> : <ChevronRight className="h-5 w-5" />}
          </button>
          {/* Position, and the swipe affordance. The label this replaces read
              "swipe < >" at 10px in text-zinc-600 on a dark panel - present in
              the DOM and invisible in practice, which is why nobody found the
              gesture. This says the same thing in a size and colour that can
              actually be read, and adds the count so the reader knows a feed
              exists to move through at all. */}
          {total > 0 && (
            <span className="mono ml-1 shrink-0 text-[11px] text-zinc-500">
              {position} / {total}
            </span>
          )}
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
    </motion.div>,
    document.body
  );
}

/**
 * The breaking hero's backdrop: the story image, or the gradient when there
 * isn't one - or when there is one and it fails.
 *
 * That last case is the bug. The old handler hid the `<img>` and stopped, so a
 * dead image URL left a black rectangle behind the headline instead of the
 * gradient that exists precisely for stories with no image. The headline is
 * white text with a `drop-shadow`, so it survived; the hero just looked broken.
 */
function BreakingImage({ src }: { src: string | null }) {
  // Resized copy first, then the original, then the gradient.
  const [stage, setStage] = useState(0);
  if (!src || stage > 1) return <div className="h-full w-full bg-gradient-to-br from-gold-500/25 via-ink-950 to-ink-950" />;
  const url = stage === 0 ? photoSrc(src, 1080) ?? src : src;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" decoding="async" className="h-full w-full object-cover" onError={() => setStage((s) => (s === 0 && url !== src ? 1 : 2))} />;
}

// The hero's featured-story panel: high-impact stories first, auto-rotating,
// with source, time, bookmark and share. Click opens the on-site reader.
function FeaturedStory({
  items, now, onOpen, isSaved, onBookmark,
}: {
  items: NewsItem[]; now: number; onOpen: (id: string) => void;
  isSaved: (id: string) => boolean; onBookmark: (item: NewsItem) => void;
}) {
  const reduce = useReducedMotionSafe();
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const active = items[idx % items.length];

  // Restart the carousel when the feed length changes (adjusted during render,
  // so the ticker never shows an index past the end of the new list).
  const [prevCount, setPrevCount] = useState(items.length);
  if (prevCount !== items.length) {
    setPrevCount(items.length);
    setIdx(0);
  }
  useEffect(() => {
    if (items.length < 2 || paused) return;
    const t = setInterval(() => {
      if (document.hidden) return; // pause the carousel while backgrounded
      setIdx((i) => (i + 1) % items.length);
    }, 6500);
    return () => clearInterval(t);
  }, [items.length, paused]);

  if (!active) return null;
  const go = (dir: number) => setIdx((i) => (i + dir + items.length) % items.length);
  const saved = isSaved(active.id);

  return (
    <article
      className="group relative isolate flex h-full min-h-[250px] min-w-0 flex-col justify-end overflow-hidden sm:min-h-[300px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Featured stories"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={active.id}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.2 : 0.8, ease: "easeOut" }}
          className="absolute inset-0 -z-10"
        >
          {/* The gradient is the fallback, so a failed image must fall THROUGH
              to it rather than leave a black rectangle. `key` resets the
              failure state per story. */}
          <BreakingImage key={active.id} src={active.image} />
        </motion.div>
      </AnimatePresence>
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/70 to-black/10" />

      <div className="flex flex-col gap-2 p-4 sm:gap-2.5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-gradient-to-br from-gold-200 to-gold-500 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] !text-ink">
            {active.impact === "High" ? "Top story" : "Featured"}
          </span>
          <span className="rounded-md border border-white/20 bg-black/40 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] !text-gold-200">{active.category}</span>
        </div>
        <button type="button" onClick={() => onOpen(active.id)} className="text-left" aria-label={`Read: ${active.title}`}>
          <h2 className="line-clamp-2 font-display text-[19px] font-bold leading-[1.2] tracking-[-0.015em] !text-white decoration-gold-400 decoration-2 underline-offset-4 group-hover:underline sm:text-[24px]">
            {active.title}
          </h2>
        </button>
        {active.summary && <p className="line-clamp-2 hidden max-w-xl text-[13.5px] leading-relaxed !text-zinc-300 sm:block">{active.summary}</p>}
        <div className="mt-1 flex items-center gap-2 text-[12px] !text-zinc-300">
          <SafeImg src={active.sourceIcon} width={16} height={16} className="h-4 w-4 shrink-0 rounded" />
          <span className="min-w-0 truncate font-medium !text-zinc-200">{active.source}</span>
          <span aria-hidden>·</span>
          <time className="mono shrink-0" dateTime={active.publishedAt ? new Date(active.publishedAt).toISOString() : undefined}>
            {now ? timeAgo(active.publishedAt, now) : ""}
          </time>
          <div className="ml-auto flex items-center gap-1.5">
            <button type="button" onClick={() => onBookmark(active)} aria-label={saved ? "Remove bookmark" : "Bookmark"} aria-pressed={saved} className={cn("grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-black/40 transition-colors hover:border-gold-400/60", saved ? "!text-gold-300" : "!text-white")}>
              {saved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
            </button>
            <button type="button" onClick={() => shareStory(active)} aria-label="Share" className="grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-black/40 !text-white transition-colors hover:border-gold-400/60">
              <Share2 className="h-3.5 w-3.5" />
            </button>
            {items.length > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} aria-label="Previous featured story" className="grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-black/40 !text-white transition-colors hover:border-gold-400/60 active:scale-90">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => go(1)} aria-label="Next featured story" className="grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-black/40 !text-white transition-colors hover:border-gold-400/60 active:scale-90">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
        {items.length > 1 && (
          <div className="flex gap-1.5" role="tablist" aria-label="Choose featured story">
            {items.map((it, i) => (
              <button
                key={it.id}
                type="button"
                role="tab"
                aria-selected={i === idx % items.length}
                onClick={() => setIdx(i)}
                aria-label={`Featured story ${i + 1}`}
                className={cn("h-1 rounded-full transition-all", i === idx % items.length ? "w-7 bg-gold-400" : "w-3 bg-white/30 hover:bg-white/60")}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
