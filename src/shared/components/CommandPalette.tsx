"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Search, Loader2, ArrowRight, Coins, Newspaper, FileText, Clock, Command as CommandIcon } from "lucide-react";
import { isStaff } from "@/lib/permissions";
import { filterCommands, XYZ_CMDK_EVENT, type CommandItem } from "@/lib/command-search";
import { safeHref } from "@/lib/links";
import { useScrollLock } from "@/lib/useScrollLock";
import { consumePending } from "@shared/hooks/useIdleGate";
import { XYZ_AI_OPEN_EVENT } from "@modules/ai/lib/events";
import { cn } from "@/lib/utils";
import { MicButton } from "@/shared/components/MicButton";

type Row =
  | { kind: "cmd"; key: string; item: CommandItem }
  // `id` is the CoinGecko id and it is what makes a coin result land on the
  // coin. The API has always returned it (api/markets/search returns
  // `id: String(d.id ?? "")` on every row); this component used to map the
  // response and drop it, so `choose` had nothing to route with and pushed
  // everyone to the `/markets` index instead. Search "Chainlink", click
  // Chainlink, get the top-250 table with no filter and no anchor.
  | { kind: "coin"; key: string; id: string; symbol: string; name: string; image: string | null; price: number; change24h: number }
  | { kind: "news"; key: string; title: string; url: string; source: string }
  | { kind: "post"; key: string; title: string; slug: string; category: string }
  | { kind: "recent"; key: string; query: string };

const money = (n: number) => (n >= 1 ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : `$${n.toPrecision(3)}`);

/** Last few queries that actually led somewhere. */
const RECENT_KEY = "xyz:search:recent";
const RECENT_MAX = 6;

function readRecent(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function pushRecent(query: string): string[] {
  const q = query.trim();
  if (q.length < 2) return readRecent();
  const next = [q, ...readRecent().filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, RECENT_MAX);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* private mode / storage disabled - recents are a convenience, not state */
  }
  return next;
}

export function CommandPalette() {
  const router = useRouter();
  const { data: session } = useSession();
  const ctx = useMemo(
    () => ({ loggedIn: Boolean(session?.user), staff: isStaff((session?.user as { permissions?: string[]; role?: string; isSuperAdmin?: boolean } | undefined) ?? null) }),
    [session]
  );

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<{ coins: Row[]; news: Row[]; posts: Row[] }>({ coins: [], news: [], posts: [] });
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setRemote({ coins: [], news: [], posts: [] });
    setActive(0);
  }, []);

  // Open triggers: Cmd/Ctrl+K, "/" when not typing, and the navbar event.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.key) return;
      const k = e.key.toLowerCase();
      const el = e.target as HTMLElement | null;
      const typing = /^(input|textarea|select)$/i.test(el?.tagName || "") || !!el?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && k === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (k === "/" && !typing && !open) {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onEvt = () => setOpen(true);
    // Asked for (search tap, shortcut) before this chunk had loaded: open now.
    if (consumePending(XYZ_CMDK_EVENT)) queueMicrotask(() => setOpen(true));
    window.addEventListener("keydown", onKey);
    window.addEventListener(XYZ_CMDK_EVENT, onEvt);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(XYZ_CMDK_EVENT, onEvt);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(t);
  }, [open]);

  // Lock the page while open (keeps the sheet from scrolling the page behind).
  // This used to set `body { overflow: hidden }` by hand, which Lenis ignores -
  // it drives the scroll position itself, so the page still moved on a wheel.
  // useScrollLock stops Lenis too.
  useScrollLock(open);

  // Debounced live search across coins / news / posts. Aborts in-flight requests
  // so results always reflect the current query (no fake/stale state).
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setRemote({ coins: [], news: [], posts: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      const j = async (url: string) => {
        try {
          const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
          return r.ok ? await r.json() : null;
        } catch {
          return null;
        }
      };
      const [coinsRes, newsRes, postsRes] = await Promise.all([
        j(`/api/markets/search?q=${encodeURIComponent(query)}`),
        j(`/api/news?q=${encodeURIComponent(query)}&pageSize=5`),
        j(`/api/search/posts?q=${encodeURIComponent(query)}`),
      ]);
      if (ctrl.signal.aborted) return;
      const coins: Row[] = Array.isArray(coinsRes?.list)
        ? coinsRes.list
            .slice(0, 5)
            .map((c: { id?: string; symbol: string; name: string; image: string | null; price: number; change24h?: number }) => ({
              kind: "coin" as const,
              key: `coin-${c.id || c.symbol}`,
              id: String(c.id || ""),
              symbol: c.symbol,
              name: c.name,
              image: c.image,
              price: Number(c.price) || 0,
              // Already in the payload and previously thrown away. On a crypto
              // site the 24h move is the second thing anyone looks at after the
              // price, and showing it costs nothing.
              change24h: Number(c.change24h) || 0,
            }))
        : [];
      const news: Row[] = Array.isArray(newsRes?.items)
        ? newsRes.items.slice(0, 5).map((n: { title: string; url: string; source: string }) => ({
            // Keyed by URL, not by array index. With an index, row 0 of the old
            // result set and row 0 of the new one reconcile as the same element,
            // so a headline can visibly morph into a different story mid-type.
            kind: "news" as const,
            key: `news-${n.url}`,
            title: n.title,
            url: n.url,
            source: n.source,
          }))
        : [];
      const posts: Row[] = Array.isArray(postsRes?.results)
        ? postsRes.results.map((p: { title: string; slug: string; category: string }) => ({ kind: "post" as const, key: `post-${p.slug}`, title: p.title, slug: p.slug, category: p.category }))
        : [];
      setRemote({ coins, news, posts });
      setLoading(false);
    }, 250);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [q]);

  const cmds: Row[] = useMemo(() => filterCommands(q, ctx).map((item) => ({ kind: "cmd" as const, key: `cmd-${item.id}`, item })), [q, ctx]);
  // Recents only stand in for an empty query. Once there is something to search
  // they are noise, and they must never sit between the reader and a real hit.
  const recents: Row[] = useMemo(
    () => (q.trim().length >= 2 ? [] : recent.map((r) => ({ kind: "recent" as const, key: `recent-${r}`, query: r }))),
    [q, recent]
  );
  const rows: Row[] = useMemo(
    () => [...cmds, ...recents, ...remote.coins, ...remote.posts, ...remote.news],
    [cmds, recents, remote]
  );

  // Re-point the highlight at the first row whenever the result set changes.
  // Adjusted during render (React's documented "adjusting state when a prop
  // changes" pattern) rather than from an effect: React re-runs this component
  // immediately without committing the stale highlight, so there's no frame
  // where row 0 isn't selected and no cascading second render.
  const resultKey = `${rows.length}|${q}`;
  const [prevResultKey, setPrevResultKey] = useState(resultKey);
  if (prevResultKey !== resultKey) {
    setPrevResultKey(resultKey);
    setActive(0);
  }

  // Refresh the recents list when the panel opens, using the same
  // adjust-state-during-render pattern as the highlight above rather than an
  // effect - `setState` in an effect body schedules a second render for
  // something React can settle in the first one, which is what
  // `react-hooks/set-state-in-effect` is pointing at.
  //
  // Reading `localStorage` here is safe specifically because the panel renders
  // nothing until `open` is true: there is no server-rendered output for a
  // client-only value to disagree with, so this is not the #418 trap that
  // CLAUDE.md warns about. Deriving anything from storage in a component that
  // renders on the server would be.
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) setRecent(readRecent());
  }

  const choose = useCallback(
    (row: Row) => {
      // Re-running the search you just ran is the one case that should NOT
      // close the panel - it is a refinement, not a destination.
      if (row.kind === "recent") {
        setQ(row.query);
        inputRef.current?.focus();
        return;
      }
      // Remember the query that led somewhere, not every keystroke: a list of
      // half-typed fragments is worse than no list.
      setRecent(pushRecent(q));
      close();
      if (row.kind === "cmd") {
        if (row.item.action === "ai") window.dispatchEvent(new Event(XYZ_AI_OPEN_EVENT));
        else if (row.item.href) router.push(row.item.href);
      } else if (row.kind === "coin") {
        // `/markets/<coingecko-id>` is the coin's own page (it is also what
        // ai-page-context treats as canonical). Falling back to the index only
        // when a row somehow arrived without an id, rather than silently
        // sending everyone there as before.
        router.push(row.id ? `/markets/${encodeURIComponent(row.id)}` : "/markets");
      } else if (row.kind === "post") {
        router.push(`/research/${row.slug}`);
      } else if (row.kind === "news") {
        // Feed URLs come from third-party RSS <link> elements with no protocol
        // check. React's own URL sanitiser does not cover window.open, so this
        // is the one navigation path in the app that needs the check applied by
        // hand. An unsafe URL simply does nothing rather than navigating.
        const href = safeHref(row.url);
        if (href) window.open(href, "_blank", "noopener,noreferrer");
      }
    },
    [close, router, q]
  );

  /**
   * Keep the highlighted row on screen.
   *
   * ⚠️ Nothing did this. A full result set is one action + up to five coins +
   * six research posts + five news items, in a panel that scrolls - so holding
   * ArrowDown moved the highlight straight past the fold and Enter then opened
   * a result the reader could not see. The footer advertises "↑↓ navigate",
   * which only half worked.
   *
   * `block: "nearest"` scrolls the minimum needed, so a row already in view
   * does not jolt the list.
   */
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-row="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (rows[active]) choose(rows[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  if (!open) return null;

  // Section offsets mirror how `rows` is assembled (cmds, coins, posts, news),
  // so each row's index into `rows` is its position within its own list plus
  // the length of everything before it.
  const recentsOffset = cmds.length;
  const coinsOffset = recentsOffset + recents.length;
  const postsOffset = coinsOffset + remote.coins.length;
  const newsOffset = postsOffset + remote.posts.length;

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Search">
      <button className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm" aria-label="Close" onClick={close} />
      <div
        className="absolute inset-x-0 top-0 mx-auto flex h-full w-full flex-col bg-ink-950 sm:top-[12vh] sm:h-auto sm:max-h-[70vh] sm:max-w-xl sm:rounded-2xl sm:border sm:border-white/10 sm:shadow-elevate"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
        onKeyDown={onListKey}
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-3">
          <Search className="h-4 w-4 shrink-0 text-zinc-500" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search coins, news & research…"
            className="h-12 w-full bg-transparent text-[15px] text-zinc-100 outline-none placeholder:text-zinc-600"
            autoComplete="off"
            spellCheck={false}
          />
          <MicButton size="sm" className="!ring-0" onText={(t) => setQ((v) => (v ? `${v} ${t}` : t))} />
          {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-500" />}
          <button onClick={close} className="shrink-0 rounded-md px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-200 sm:hidden">
            Close
          </button>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain py-1" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <Section title="Actions" list={cmds} offset={0} active={active} onHover={setActive} onChoose={choose} />
          <Section
            title="Recent"
            list={recents}
            offset={recentsOffset}
            active={active}
            onHover={setActive}
            onChoose={choose}
            onClear={() => {
              try {
                localStorage.removeItem(RECENT_KEY);
              } catch {
                /* nothing to clear */
              }
              setRecent([]);
            }}
          />
          <Section title="Coins" list={remote.coins} offset={coinsOffset} active={active} onHover={setActive} onChoose={choose} />
          <Section title="Research" list={remote.posts} offset={postsOffset} active={active} onHover={setActive} onChoose={choose} />
          <Section title="News" list={remote.news} offset={newsOffset} active={active} onHover={setActive} onChoose={choose} />
          {!rows.length && (
            <p className="px-3 py-8 text-center text-sm text-zinc-500">
              {q.trim().length >= 2 ? (loading ? "Searching…" : `No results for “${q.trim()}”.`) : "Type to search across XYZ Crypto."}
            </p>
          )}
        </div>

        <div className="hidden items-center gap-3 border-t border-white/10 px-3 py-2 text-[10px] text-zinc-600 sm:flex">
          <span className="inline-flex items-center gap-1"><CommandIcon className="h-3 w-3" />K to toggle</span>
          <span>↑↓ navigate · ↵ open · esc close</span>
        </div>
      </div>
    </div>
  );
}

// Module scope, not defined inside CommandPalette: a component declared during
// render is a brand-new type on every render, so React unmounts and remounts
// its whole subtree instead of updating it (and it trips
// react-hooks/static-components). `offset` replaces the mutable counter this
// used to close over.
function Section({
  title,
  list,
  offset,
  active,
  onHover,
  onChoose,
  onClear,
}: {
  title: string;
  list: Row[];
  offset: number;
  active: number;
  onHover: (i: number) => void;
  onChoose: (row: Row) => void;
  onClear?: () => void;
}) {
  if (!list.length) return null;
  return (
    <div className="py-1">
      <div className="flex items-center justify-between px-3 pb-1 pt-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{title}</p>
        {onClear && (
          <button
            onClick={onClear}
            className="text-[10px] uppercase tracking-wider text-zinc-600 transition-colors hover:text-zinc-300"
          >
            Clear
          </button>
        )}
      </div>
      {list.map((row, n) => {
        const i = offset + n;
        return (
          <button
            key={row.key}
            // Its index into `rows`, so the keyboard handler can scroll the
            // highlighted row into view without threading refs through here.
            data-row={i}
            onMouseEnter={() => onHover(i)}
            onClick={() => onChoose(row)}
            className={cn(
              "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
              active === i ? "bg-white/10" : "hover:bg-white/5"
            )}
          >
            <RowIcon row={row} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-zinc-100">{rowLabel(row)}</span>
              {rowHint(row) && <span className="block truncate text-[11px] text-zinc-500">{rowHint(row)}</span>}
            </span>
            {row.kind === "coin" && row.change24h !== 0 && (
              <span
                className={cn(
                  "mono shrink-0 text-[11px] font-medium",
                  // The colour rule: mint = positive data, red-400 = negative.
                  row.change24h > 0 ? "text-mint-300" : "text-red-400"
                )}
              >
                {row.change24h > 0 ? "+" : ""}
                {row.change24h.toFixed(2)}%
              </span>
            )}
            {active === i && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-500" />}
          </button>
        );
      })}
    </div>
  );
}

function RowIcon({ row }: { row: Row }) {
  const cls = "h-4 w-4 shrink-0 text-zinc-500";
  if (row.kind === "coin")
    return row.image ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={row.image} alt="" width={18} height={18} className="h-[18px] w-[18px] shrink-0 rounded-full" />
    ) : (
      <Coins className={cls} />
    );
  if (row.kind === "news") return <Newspaper className={cls} />;
  if (row.kind === "post") return <FileText className={cls} />;
  if (row.kind === "recent") return <Clock className={cls} />;
  return <ArrowRight className={cls} />;
}
function rowLabel(row: Row): string {
  if (row.kind === "cmd") return row.item.label;
  if (row.kind === "coin") return `${row.name} (${row.symbol})`;
  if (row.kind === "recent") return row.query;
  return row.title;
}
function rowHint(row: Row): string | undefined {
  if (row.kind === "cmd") return row.item.hint;
  if (row.kind === "coin") return row.price > 0 ? money(row.price) : undefined;
  if (row.kind === "news") return row.source;
  if (row.kind === "post") return row.category;
  return undefined;
}
