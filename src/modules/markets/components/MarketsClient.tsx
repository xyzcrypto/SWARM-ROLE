"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Activity, Fuel, Flame, BarChart3, Layers, Percent, Coins, LineChart, Search, Newspaper, ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { PerpChartLazy as PerpChart } from "./PerpChartLazy";
import {
  compactUsd,
  pct,
  apyFmt,
  fngLabel,
  coinPrice,
  sortCoins,
  defaultDirFor,
  type SortKey,
  type SortDir,
  type GlobalMarket,
  type DefiMarket,
  type PerpDex,
  type PerpMarket,
  type DexProtocol,
  type FeeProtocol,
  type YieldPool,
  type TrendingCoin,
  type MoverCoin,
  type CoinRow,
} from "@/lib/markets";
import { cn } from "@/lib/utils";
import { useLiveData } from "@shared/hooks/useLiveData";

/**
 * Visibility-gated poller (same pattern as MarketTicker/PerpChart).
 *
 * ⚠️ The `live` guard on `setData` is the whole point, and it was missing.
 *
 * Every markets route answers a failed upstream with **HTTP 200** carrying
 * empty arrays and `live: false` - deliberately, so the page never shows an
 * error screen. But this hook only checked `res.ok`, which is true for exactly
 * that response. So one transient CoinGecko 429 replaced a fully populated
 * 250-row table with `{ list: [], trending: [], gainers: [], losers: [] }`, and
 * the Coins tab read "Coin data is loading…" for the next 180 seconds.
 *
 * Keeping the last good payload is strictly better: stale numbers with an
 * honest "stale" badge beat no numbers at all, and the badge (see `Freshness`
 * below) is what tells the reader which they are looking at.
 *
 * `CoinDetailClient` already did this correctly (`if (j && j.live)`). The hub -
 * the higher-traffic surface - did not.
 *
 * The loop itself is now `useLiveData`, the shared primitive that already
 * existed for exactly this (`shared/hooks/useLiveData.ts`, written after an
 * audit that names markets) but that only one surface had been moved onto. Two
 * things come with it, both of which this hand-rolled loop lacked:
 *
 *  - **Retry with backoff.** A failed poll waited out the whole 180-300s
 *    interval, and if that one failed too, until the reader reloaded the page.
 *    Now a blip costs a second.
 *  - **An age-gated wake.** Six of these run on this page plus two perp charts
 *    and the ticker - nine loops, each refetching on every return to the tab.
 *    `wakeMinAgeMs` says the obvious thing: a refetch is only worth a request
 *    once the poll would have been due anyway.
 */
function usePolledJson<T>(url: string, everyMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    let ok = false;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("bad status");
      const j = await res.json();
      // Only replace what is on screen with something the server vouches for.
      // A `live: false` payload is the route's "I could not reach upstream"
      // signal, not data.
      if (j?.live) setData(j);
      ok = Boolean(j?.live);
    } finally {
      // In `finally` so a thrown fetch also lands here: `ok` is still false,
      // which is exactly what the badge should say.
      setLive(ok);
      setLoading(false);
    }
    // Throwing is how retry is requested. `live: false` is a real failure even
    // though it arrives as HTTP 200 - that is the routes' deliberate graceful
    // shape - and it is worth retrying: the route caches its own failure for
    // ~30s, so the backoff (1s…30s cap) mostly lands on the CDN rather than
    // upstream, and the page recovers in seconds instead of after a full cycle.
    if (!ok) throw new Error("upstream not live");
  }, [url]);

  useLiveData({ load, intervalMs: everyMs, wakeMinAgeMs: everyMs });
  return { data, live, loading };
}

type GlobalResp = GlobalMarket & { live: boolean };
type DefiResp = DefiMarket & { live: boolean };
type PerpResp = { dexs: PerpDex[]; markets: PerpMarket[]; totalVolume24h: number; totalOi: number; live: boolean };
type DexResp = { dexs: DexProtocol[]; fees: FeeProtocol[]; live: boolean };
type YieldResp = { pools: YieldPool[]; live: boolean };
type CoinsResp = { list: CoinRow[]; trending: TrendingCoin[]; gainers: MoverCoin[]; losers: MoverCoin[]; live: boolean; ts?: number };

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "coins", label: "Coins", icon: LineChart },
  { id: "defi", label: "DeFi", icon: Layers },
  { id: "perps", label: "Perp DEX", icon: Activity },
  { id: "dex", label: "DEX & Fees", icon: Coins },
  { id: "yields", label: "Yields", icon: Percent },
  { id: "trending", label: "Trending", icon: Flame },
] as const;

export function MarketsClient() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");
  // Poll intervals are at or slower than each route's server-side `revalidate`
  // window - polling faster than the cache regenerates just re-fetches the
  // same stale data while still counting as a Function Invocation. Widened
  // once more (each was previously equal to its revalidate window) to cut
  // request volume further on the Hobby plan.
  const g = usePolledJson<GlobalResp>("/api/markets/global", 180_000);
  const d = usePolledJson<DefiResp>("/api/markets/defi", 180_000);
  const p = usePolledJson<PerpResp>("/api/markets/perp", 180_000);
  const x = usePolledJson<DexResp>("/api/markets/dex", 300_000);
  const y = usePolledJson<YieldResp>("/api/markets/yields", 300_000);
  const c = usePolledJson<CoinsResp>("/api/markets/coins", 180_000);
  // ⚠️ ALL, not ANY.
  //
  // This was `g.live || d.live || ... || c.live`, so a single healthy source
  // was enough to light the badge. With `/api/markets/global` down and coins
  // up, the page said "Live market data" while the KPI strip showed the route's
  // hardcoded fallback - a $2.35T market cap and a Fear & Greed of exactly 50.
  // Invented numbers under a badge asserting they were live.
  //
  // `every` is the honest reduction: the badge speaks for the whole page, so it
  // can only claim what every source on the page supports. The count says how
  // many are behind, because "Cached snapshot" alone does not distinguish one
  // slow feed from a total outage.
  const sources = [g.live, d.live, p.live, x.live, y.live, c.live];
  const allLive = sources.every(Boolean);
  const staleCount = sources.filter((v) => !v).length;

  return (
    <div className="space-y-6">
      {/* Status + tab bar */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
          <span className="relative flex h-2 w-2">
            {allLive && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-400 opacity-70" />}
            <span className={cn("relative inline-flex h-2 w-2 rounded-full", allLive ? "bg-mint-400" : "bg-amber-400")} />
          </span>
          <span className="mono">
            {allLive
              ? "Live market data"
              : staleCount === sources.length
                ? "Cached snapshot"
                : `Live · ${staleCount} feed${staleCount === 1 ? "" : "s"} stale`}
          </span>
        </div>
        <div className="flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-line bg-ink-950/50 p-1.5">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors",
                  active ? "bg-gold-500/15 text-gold-100 ring-1 ring-gold-500/30" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Always-visible global KPI strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Tile label="Market Cap" value={compactUsd(g.data?.marketCap)} sub={g.data ? pct(g.data.mcapChange24h) : undefined} subTone={(g.data?.mcapChange24h ?? 0) >= 0 ? "up" : "down"} loading={g.loading} />
        <Tile label="24h Volume" value={compactUsd(g.data?.volume24h)} loading={g.loading} />
        <Tile label="BTC Dom." value={g.data ? `${g.data.btcDominance.toFixed(1)}%` : "-"} sub={g.data ? `ETH ${g.data.ethDominance.toFixed(1)}%` : undefined} loading={g.loading} />
        <FearGreedTile fg={g.data?.fearGreed ?? null} loading={g.loading} />
        <Tile label="ETH Gas" value={g.data?.gasGwei != null ? `${g.data.gasGwei} gwei` : "-"} icon={<Fuel className="h-3.5 w-3.5 text-gold-300" />} loading={g.loading} />
      </div>

      {/* Tab panels */}
      {tab === "overview" && <Overview g={g.data} d={d.data} c={c.data} />}
      {tab === "coins" && <CoinsPanel c={c.data} loading={c.loading} />}
      {tab === "defi" && <DefiPanel d={d.data} loading={d.loading} />}
      {tab === "perps" && <PerpPanel p={p.data} loading={p.loading} />}
      {tab === "dex" && <DexPanel x={x.data} loading={x.loading} />}
      {tab === "yields" && <YieldsPanel y={y.data} loading={y.loading} />}
      {tab === "trending" && <TrendingPanel c={c.data} loading={c.loading} />}

      <p className="text-center text-[11px] text-zinc-600">
        Data: CoinGecko · DefiLlama · Hyperliquid · alternative.me. Not financial advice.
      </p>
    </div>
  );
}

/* ---------------- panels ---------------- */

function Overview({ g, d, c }: { g: GlobalMarket | null; d: DefiMarket | null; c: CoinsResp | null }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCardMini label="Total DeFi TVL" value={compactUsd(d?.totalTvl)} accent="mint" trend={d?.tvlTrend ?? []} />
        <StatCardMini label="Stablecoin Mcap" value={compactUsd(d?.stableMcap ?? g?.stableMcap)} accent="gold" />
        <StatCardMini label="DeFi Mcap" value={compactUsd(g?.defiMcap)} sub={g?.defiMcap ? undefined : "add CMC key"} />
      </div>
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Top Gainers (24h)" icon={<TrendingUp className="h-4 w-4 text-mint-400" />}>
          <MoverList rows={c?.gainers ?? []} />
        </Panel>
        <Panel title="Top Losers (24h)" icon={<TrendingDown className="h-4 w-4 text-red-400" />}>
          <MoverList rows={c?.losers ?? []} />
        </Panel>
      </section>
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PerpChart coin={{ id: "bitcoin", symbol: "BTC", base: 64000 }} />
        <PerpChart coin={{ id: "ethereum", symbol: "ETH", base: 3400 }} />
      </section>
    </div>
  );
}

function CoinsPanel({ c, loading }: { c: CoinsResp | null; loading: boolean }) {
  const base = c?.list ?? [];
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<CoinRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "rank", dir: "asc" });
  const query = q.trim().toLowerCase();

  // Live price flash - fires ONLY on a real price delta between two real polls.
  //
  // ⚠️ Keyed by `r.id`, the CoinGecko id, NOT by `r.symbol`.
  //
  // Ticker symbols are not unique in crypto - plenty of coins share one. Two
  // rows with the same symbol overwrote each other's previous price on every
  // poll, so both flashed on every tick and the direction was whichever row
  // happened to be written last. `CoinRow.id` exists for exactly this ("links
  // each row to its coin detail page") and is already used for the row's link.
  const prevPrices = useRef<Map<string, number>>(new Map());
  const [flash, setFlash] = useState<Map<string, "up" | "down">>(new Map());
  useEffect(() => {
    const list = c?.list ?? [];
    if (!list.length) return;
    const next = new Map<string, "up" | "down">();
    for (const r of list) {
      const prev = prevPrices.current.get(r.id);
      if (prev != null && r.price !== prev) next.set(r.id, r.price > prev ? "up" : "down");
      prevPrices.current.set(r.id, r.price);
    }
    if (!next.size) return;
    setFlash(next);
    const t = setTimeout(() => setFlash(new Map()), 1200);
    return () => clearTimeout(t);
  }, [c]);

  // Any coin - not just the top 250 - via the on-demand search route (debounced).
  //
  // ⚠️ The cleanup cancelled the TIMER but never the REQUEST, and there was no
  // sequence guard. Type "bit", pause past the 350ms debounce, keep typing to
  // "bitc": two requests are in flight and whichever the network returns last
  // wins - which can be the one for the query you have already moved past.
  //
  // The stale `.finally` was the more visible half: it set `searching = false`
  // while the newer request was still running, and the empty-state below reads
  // `!rows.length && !searching`, so the reader got a "No coins match" flash
  // mid-typing for a search that had not finished.
  //
  // `usePolledJson` above and `CoinDetailClient` both already had an `active`
  // flag; this one did not.
  useEffect(() => {
    if (query.length < 2) { setRemote([]); setSearching(false); return; }
    setSearching(true);
    let active = true;
    const ctrl = new AbortController();
    const id = setTimeout(() => {
      fetch(`/api/markets/search?q=${encodeURIComponent(query)}`, { cache: "no-store", signal: ctrl.signal })
        .then((r) => r.json())
        .then((j) => { if (active) setRemote(Array.isArray(j.list) ? j.list : []); })
        .catch(() => { if (active) setRemote([]); })
        .finally(() => { if (active) setSearching(false); });
    }, 350);
    return () => {
      active = false;
      clearTimeout(id);
      ctrl.abort();
    };
  }, [query]);

  const local = query ? base.filter((r) => r.name.toLowerCase().includes(query) || r.symbol.toLowerCase().includes(query)) : base;
  // Also by id, for the same reason as the flash map above: de-duping search
  // results by SYMBOL silently dropped any coin that happens to share a ticker
  // with one of the top 250 - which defeats the whole point of the search route
  // ("finds ANY coin, not just the top 250").
  const seen = new Set(local.map((r) => r.id));
  const merged = query ? [...local, ...remote.filter((r) => !seen.has(r.id))] : base;
  const rows = sortCoins(merged, sort.key, sort.dir);

  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: defaultDirFor(key) }));

  return (
    <Panel title={query ? `Coins matching "${q.trim()}"` : "Top Coins by Market Cap"} icon={<LineChart className="h-4 w-4 text-gold-300" />}>
      <div className="mb-2 flex items-center justify-end">
        <UpdatedPill ts={c?.ts} />
      </div>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search any coin - name or symbol (BTC, Solana, PEPE…)"
          className="w-full rounded-xl border border-white/10 bg-ink-950/60 py-2.5 pl-9 pr-9 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-gold-500/40 focus:ring-2 focus:ring-gold-500/15"
        />
        {q && (
          <button onClick={() => setQ("")} aria-label="Clear" className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-500 hover:text-zinc-200">
            <span className="text-sm">×</span>
          </button>
        )}
      </div>
      {query && !rows.length && !searching ? (
        <p className="py-6 text-center text-sm text-zinc-500">No coins match “{q.trim()}”.</p>
      ) : loading && !rows.length ? (
        <SkeletonRows />
      ) : rows.length ? (
        <div className="-mx-2 overflow-x-auto md:mx-0 md:max-h-[65vh] md:overflow-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-white/10 bg-ink-950 text-[11px] uppercase tracking-wide text-zinc-500">
                <SortTh label="#" col="rank" sort={sort} onSort={onSort} align="left" />
                <SortTh label="Coin" col="name" sort={sort} onSort={onSort} align="left" />
                <SortTh label="Price" col="price" sort={sort} onSort={onSort} />
                <SortTh label="1h" col="change1h" sort={sort} onSort={onSort} />
                <SortTh label="24h" col="change24h" sort={sort} onSort={onSort} />
                <SortTh label="7d" col="change7d" sort={sort} onSort={onSort} />
                <SortTh label="Market Cap" col="marketCap" sort={sort} onSort={onSort} className="hidden md:table-cell" />
                <SortTh label="Volume (24h)" col="volume24h" sort={sort} onSort={onSort} className="hidden lg:table-cell" />
                <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Last 7d</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-white/[0.03]">
                  <td className="mono px-2 py-2.5 text-left text-[11px] text-zinc-600">{r.rank}</td>
                  <td className="px-2 py-2.5">
                    {r.id ? (
                      <Link href={`/markets/${r.id}`} className="group flex items-center gap-2.5">
                        {r.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.image} alt="" width={22} height={22} loading="lazy" className="h-[22px] w-[22px] rounded-full ring-1 ring-white/10" onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")} />
                        )}
                        <span className="font-semibold text-zinc-100 transition-colors group-hover:text-gold-200">{r.name}</span>
                        <span className="mono text-[11px] text-zinc-500">{r.symbol}</span>
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2.5">
                        {r.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.image} alt="" width={22} height={22} loading="lazy" className="h-[22px] w-[22px] rounded-full ring-1 ring-white/10" onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")} />
                        )}
                        <span className="font-semibold text-zinc-100">{r.name}</span>
                        <span className="mono text-[11px] text-zinc-500">{r.symbol}</span>
                      </div>
                    )}
                  </td>
                  <td className={cn("mono px-2 py-2.5 text-right font-medium text-zinc-100", flash.get(r.id) === "up" && "flash-up", flash.get(r.id) === "down" && "flash-down")}>{coinPrice(r.price)}</td>
                  <ChangeCell v={r.change1h} />
                  <ChangeCell v={r.change24h} />
                  <ChangeCell v={r.change7d} />
                  <td className="mono hidden px-2 py-2.5 text-right text-zinc-300 md:table-cell">{compactUsd(r.marketCap)}</td>
                  <td className="mono hidden px-2 py-2.5 text-right text-zinc-400 lg:table-cell">{compactUsd(r.volume24h)}</td>
                  <td className="hidden px-2 py-2.5 sm:table-cell">
                    <div className="ml-auto w-24">
                      <Sparkline data={r.sparkline} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="py-4 text-center text-sm text-zinc-500">Coin data is loading…</p>
      )}
    </Panel>
  );
}

/** A sortable column header cell. Shows the active sort direction. */
function SortTh({ label, col, sort, onSort, align = "right", className }: { label: string; col: SortKey; sort: { key: SortKey; dir: SortDir }; onSort: (k: SortKey) => void; align?: "left" | "right"; className?: string }) {
  const active = sort.key === col;
  return (
    <th className={cn("px-2 py-2 font-medium", align === "left" ? "text-left" : "text-right", className)}>
      <button
        onClick={() => onSort(col)}
        className={cn(
          "inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-zinc-200",
          active ? "text-gold-200" : "text-zinc-500",
          align === "right" && "flex-row-reverse"
        )}
      >
        {label}
        {active ? (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
      </button>
    </th>
  );
}

/** Honest data-freshness pill: shows how old the current snapshot's server
 *  timestamp is (mint when fresh, amber when stale). No fake "live" claim. */
function UpdatedPill({ ts }: { ts?: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) setNow(Date.now()); }, 1000);
    return () => clearInterval(id);
  }, []);
  if (!ts) return null;
  const s = Math.max(0, Math.round((now - ts) / 1000));
  const label = s < 3 ? "just now" : s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`;
  const fresh = s < 90;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
      <span className={cn("h-1.5 w-1.5 rounded-full", fresh ? "bg-mint-400" : "bg-amber-400")} />
      Updated {label}
    </span>
  );
}

function ChangeCell({ v }: { v: number }) {
  return (
    <td className={cn("mono px-2 py-2.5 text-right text-[13px]", v >= 0 ? "text-mint-400" : "text-red-400")}>{pct(v, 1)}</td>
  );
}

function DefiPanel({ d, loading }: { d: DefiMarket | null; loading: boolean }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCardMini label="Total DeFi TVL" value={compactUsd(d?.totalTvl)} accent="mint" trend={d?.tvlTrend ?? []} />
        <StatCardMini label="Stablecoin Mcap" value={compactUsd(d?.stableMcap)} accent="gold" />
        <StatCardMini label="Tracked Protocols" value={`${d?.topProtocols?.length ? "Top 8" : "-"}`} />
      </div>
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Top Protocols by TVL" icon={<Activity className="h-4 w-4 text-gold-300" />}>
          <RankList loading={loading} rows={(d?.topProtocols ?? []).map((r) => ({ name: r.name, logo: r.logo, meta: r.chain, value: compactUsd(r.tvl), change: r.change1d }))} />
        </Panel>
        <Panel title="Top Chains by TVL" icon={<Layers className="h-4 w-4 text-gold-300" />}>
          <RankList loading={loading} rows={(d?.topChains ?? []).map((r) => ({ name: r.name, value: compactUsd(r.tvl) }))} />
        </Panel>
      </section>
    </div>
  );
}

function PerpPanel({ p, loading }: { p: PerpResp | null; loading: boolean }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCardMini label="Perp DEX Volume (24h)" value={compactUsd(p?.totalVolume24h)} accent="gold" />
        <StatCardMini label="Open Interest (Hyperliquid)" value={compactUsd(p?.totalOi)} accent="mint" />
      </div>
      <Panel title="Top Perp DEXs (24h Volume)" icon={<Activity className="h-4 w-4 text-gold-300" />}>
        <RankList loading={loading} rows={(p?.dexs ?? []).map((r) => ({ name: r.name, logo: r.logo, value: compactUsd(r.volume24h), change: r.change1d, href: r.slug ? `/markets/protocol/derivatives/${r.slug}` : undefined }))} />
      </Panel>
      <Panel title="Live Perp Markets - funding & open interest (Hyperliquid)" icon={<Flame className="h-4 w-4 text-gold-300" />}>
        {loading && !p?.markets?.length ? (
          <SkeletonRows />
        ) : (p?.markets ?? []).length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
                  <th className="py-2 font-medium">Market</th>
                  <th className="py-2 text-right font-medium">Price</th>
                  <th className="py-2 text-right font-medium">Funding /1h</th>
                  <th className="py-2 text-right font-medium">Open Interest</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {p!.markets.map((m) => (
                  <tr key={m.coin}>
                    <td className="py-2 font-semibold text-zinc-200">{m.coin}-PERP</td>
                    <td className="mono py-2 text-right text-zinc-300">${m.price.toLocaleString("en-US", { maximumFractionDigits: m.price >= 100 ? 1 : 4 })}</td>
                    <td className={cn("mono py-2 text-right", m.funding >= 0 ? "text-mint-400" : "text-red-400")}>{(m.funding * 100).toFixed(4)}%</td>
                    <td className="mono py-2 text-right text-zinc-300">{compactUsd(m.openInterest)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-zinc-500">Perp market data is loading…</p>
        )}
      </Panel>
    </div>
  );
}

function DexPanel({ x, loading }: { x: DexResp | null; loading: boolean }) {
  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Panel title="Top DEXs (24h Volume)" icon={<Coins className="h-4 w-4 text-gold-300" />}>
        <RankList loading={loading} rows={(x?.dexs ?? []).map((r) => ({ name: r.name, logo: r.logo, value: compactUsd(r.volume24h), change: r.change1d, href: r.slug ? `/markets/protocol/dexs/${r.slug}` : undefined }))} />
      </Panel>
      <Panel title="Top Protocols by Fees (24h)" icon={<Percent className="h-4 w-4 text-gold-300" />}>
        <RankList loading={loading} rows={(x?.fees ?? []).map((r) => ({ name: r.name, logo: r.logo, value: compactUsd(r.fees24h), href: r.slug ? `/markets/protocol/fees/${r.slug}` : undefined }))} />
      </Panel>
    </section>
  );
}

function YieldsPanel({ y, loading }: { y: YieldResp | null; loading: boolean }) {
  return (
    <Panel title="Top Yield Opportunities (TVL ≥ $1M)" icon={<Percent className="h-4 w-4 text-gold-300" />}>
      {loading && !y?.pools?.length ? (
        <SkeletonRows />
      ) : (y?.pools ?? []).length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[440px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
                <th className="py-2 font-medium">Pool</th>
                <th className="py-2 font-medium">Chain</th>
                <th className="py-2 text-right font-medium">APY</th>
                <th className="py-2 text-right font-medium">TVL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {y!.pools.map((pool, i) => (
                <tr key={`${pool.project}-${pool.symbol}-${i}`}>
                  <td className="py-2">
                    <span className="font-semibold text-zinc-200">{pool.symbol}</span>{" "}
                    <span className="text-[11px] text-zinc-500">{pool.project}</span>
                  </td>
                  <td className="py-2 text-zinc-400">{pool.chain}</td>
                  <td className="mono py-2 text-right font-semibold text-mint-300">{apyFmt(pool.apy)}</td>
                  <td className="mono py-2 text-right text-zinc-300">{compactUsd(pool.tvl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="py-4 text-center text-sm text-zinc-500">Yield data is loading…</p>
      )}
    </Panel>
  );
}

function TrendingPanel({ c, loading }: { c: CoinsResp | null; loading: boolean }) {
  return (
    <div className="space-y-6">
      <Panel title="Trending Now" icon={<Flame className="h-4 w-4 text-gold-300" />}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(c?.trending ?? []).map((t) => {
            const inner = (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {t.thumb && <img src={t.thumb} alt="" width={20} height={20} loading="lazy" className="h-5 w-5 rounded-full ring-1 ring-white/10" onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")} />}
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-200 group-hover:text-gold-200">{t.name}</span>
                <span className="mono shrink-0 text-[11px] text-zinc-500">{t.symbol}</span>
                <span className={cn("mono text-[11px]", t.change24h >= 0 ? "text-mint-400" : "text-red-400")}>{pct(t.change24h, 1)}</span>
              </>
            );
            return t.id ? (
              <Link key={t.symbol + t.name} href={`/markets/${t.id}`} className="group flex items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2 transition-colors hover:bg-white/[0.08]">
                {inner}
              </Link>
            ) : (
              <div key={t.symbol + t.name} className="flex items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2">{inner}</div>
            );
          })}
          {!loading && !(c?.trending ?? []).length && <p className="col-span-full py-3 text-center text-sm text-zinc-500">Trending data is loading…</p>}
        </div>
      </Panel>
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Top Gainers (24h)" icon={<TrendingUp className="h-4 w-4 text-mint-400" />}>
          <MoverList rows={c?.gainers ?? []} />
        </Panel>
        <Panel title="Top Losers (24h)" icon={<TrendingDown className="h-4 w-4 text-red-400" />}>
          <MoverList rows={c?.losers ?? []} />
        </Panel>
      </section>
      <TrendingNews />
    </div>
  );
}

type NewsHeadline = { title: string; url: string; source: string; category: string; publishedAt: number };

// Latest trading/market news inside the Markets hub (from the /news aggregator).
function TrendingNews() {
  const [items, setItems] = useState<NewsHeadline[]>([]);
  const [loading, setLoading] = useState(true);
  // A tenth poller on this page, and the only one that swallowed its failure
  // outright (`.catch(() => {})`): a failed fetch left the panel on whatever it
  // had, with nothing retried for three minutes and nothing said.
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/news?pageSize=10", { cache: "no-store" });
      if (!r.ok) throw new Error("bad status");
      const j = await r.json();
      setItems(Array.isArray(j.items) ? j.items : []);
    } finally {
      setLoading(false);
    }
  }, []);
  useLiveData({ load, intervalMs: 180_000, wakeMinAgeMs: 180_000 });
  return (
    <Panel title="Latest Trading News" icon={<Newspaper className="h-4 w-4 text-gold-300" />}>
      {loading && !items.length ? (
        <SkeletonRows />
      ) : items.length ? (
        <ul className="divide-y divide-white/5">
          {items.map((n) => (
            <li key={n.url}>
              <a href={n.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 py-2.5 transition-colors hover:bg-white/[0.03]">
                <span className="mt-0.5 shrink-0 rounded-full bg-gold-500/10 px-2 py-0.5 text-[10px] font-medium text-gold-200">{n.category}</span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm text-zinc-200">{n.title}</span>
                  <span className="mt-0.5 block text-[11px] text-zinc-500">{n.source}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-4 text-center text-sm text-zinc-500">
          News is loading… see the full <a href="/news" className="text-gold-200 hover:underline">news hub</a>.
        </p>
      )}
      <div className="mt-3 text-right">
        <a href="/news" className="text-[12px] font-medium text-gold-200 hover:underline">Open full news hub →</a>
      </div>
    </Panel>
  );
}

/* ---------------- shared bits ---------------- */

function Panel({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="surface rounded-2xl p-5">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <p className="text-sm font-semibold text-zinc-100">{title}</p>
      </div>
      {children}
    </div>
  );
}

type RankRow = { name: string; logo?: string | null; meta?: string; value: string; change?: number; href?: string };
function RankList({ rows, loading }: { rows: RankRow[]; loading?: boolean }) {
  if (loading && !rows.length) return <SkeletonRows />;
  if (!rows.length) return <p className="py-4 text-center text-sm text-zinc-500">Loading…</p>;
  return (
    <div className="divide-y divide-white/5">
      {rows.map((r, i) => {
        const inner = (
          <>
            <span className="mono w-4 shrink-0 text-[11px] text-zinc-600">{i + 1}</span>
            {r.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.logo} alt="" width={20} height={20} loading="lazy" className="h-5 w-5 rounded-full ring-1 ring-white/10" onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")} />
            )}
            <span className="min-w-0 flex-1 truncate text-sm text-zinc-200 group-hover:text-gold-200">{r.name}</span>
            {r.meta && <span className="hidden shrink-0 text-[11px] text-zinc-500 sm:inline">{r.meta}</span>}
            <span className="mono shrink-0 text-right text-sm text-zinc-300">{r.value}</span>
            {r.change !== undefined && (
              <span className={cn("mono w-16 shrink-0 text-right text-[11px]", r.change >= 0 ? "text-mint-400" : "text-red-400")}>{pct(r.change, 1)}</span>
            )}
          </>
        );
        return r.href ? (
          <Link key={r.name} href={r.href} className="group flex items-center gap-3 py-2 transition-colors hover:bg-white/[0.03]">
            {inner}
          </Link>
        ) : (
          <div key={r.name} className="flex items-center gap-3 py-2">{inner}</div>
        );
      })}
    </div>
  );
}

function MoverList({ rows }: { rows: MoverCoin[] }) {
  if (!rows.length) return <SkeletonRows />;
  return (
    <div className="divide-y divide-white/5">
      {rows.map((r, i) => {
        const inner = (
          <>
            {r.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.image} alt="" width={20} height={20} loading="lazy" className="h-5 w-5 rounded-full ring-1 ring-white/10" onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")} />
            )}
            <span className="min-w-0 flex-1 truncate text-sm text-zinc-200 group-hover:text-gold-200">{r.name}</span>
            <span className="mono shrink-0 text-[11px] text-zinc-500">{r.symbol}</span>
            <span className="mono w-20 shrink-0 text-right text-sm text-zinc-300">${r.price.toLocaleString("en-US", { maximumFractionDigits: r.price >= 1 ? 2 : 6 })}</span>
            <span className={cn("mono w-16 shrink-0 text-right text-[11px]", r.change24h >= 0 ? "text-mint-400" : "text-red-400")}>{pct(r.change24h, 1)}</span>
          </>
        );
        return r.id ? (
          <Link key={r.id} href={`/markets/${r.id}`} className="group flex items-center gap-3 py-2 transition-colors hover:bg-white/[0.03]">
            {inner}
          </Link>
        ) : (
          <div key={r.id} className="flex items-center gap-3 py-2">{inner}</div>
        );
      })}
    </div>
  );
}

function Tile({ label, value, sub, subTone, icon, loading }: { label: string; value: string; sub?: string; subTone?: "up" | "down"; icon?: React.ReactNode; loading?: boolean }) {
  return (
    <div className="surface lift rounded-2xl p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">{icon}{label}</p>
      <p className={cn("mono mt-1.5 text-xl font-bold text-zinc-50", loading && "animate-pulse text-zinc-600")}>{loading ? "…" : value}</p>
      {sub && (
        <p className={cn("mono mt-1 inline-flex items-center gap-1 text-[11px]", subTone === "up" ? "text-mint-400" : subTone === "down" ? "text-red-400" : "text-zinc-500")}>
          {subTone === "up" ? <TrendingUp className="h-3 w-3" /> : subTone === "down" ? <TrendingDown className="h-3 w-3" /> : null}
          {sub}
        </p>
      )}
    </div>
  );
}

function StatCardMini({ label, value, sub, accent, trend }: { label: string; value: string; sub?: string; accent?: "mint" | "gold"; trend?: number[] }) {
  return (
    <div className="surface lift rounded-2xl p-5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={cn("mono mt-1.5 text-2xl font-bold", accent === "mint" ? "text-mint-gradient" : accent === "gold" ? "text-gold-gradient" : "text-zinc-50")}>{value}</p>
      {sub && <p className="mt-1 text-[11px] text-zinc-600">{sub}</p>}
      {trend && trend.length > 1 && (
        <div className="mt-3">
          <Sparkline data={trend} />
        </div>
      )}
    </div>
  );
}

function FearGreedTile({ fg, loading }: { fg: { value: number; label: string } | null; loading?: boolean }) {
  const v = fg?.value ?? 50;
  const { label, tone } = fngLabel(v);
  const barColor = tone === "red" ? "bg-red-400" : tone === "amber" ? "bg-amber-400" : "bg-mint-400";
  const textColor = tone === "red" ? "text-red-300" : tone === "amber" ? "text-amber-300" : "text-mint-300";
  return (
    <div className="surface lift rounded-2xl p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Fear & Greed</p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className={cn("mono text-xl font-bold", loading ? "animate-pulse text-zinc-600" : textColor)}>{loading ? "…" : v}</span>
        {!loading && <span className={cn("text-[11px] font-medium", textColor)}>{fg?.label || label}</span>}
      </div>
      <div className="relative mt-2.5 h-1.5 rounded-full bg-gradient-to-r from-red-500/50 via-amber-400/50 to-mint-500/50">
        <span className={cn("absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full ring-2 ring-ink-950", barColor)} style={{ left: `calc(${Math.max(0, Math.min(100, v))}% - 6px)` }} />
      </div>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) return <div className="h-8" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 100;
  const h = 28;
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * w).toFixed(2)},${(h - ((v - min) / range) * h).toFixed(2)}`).join(" ");
  const up = data[data.length - 1] >= data[0];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-8 w-full" aria-hidden>
      <polyline points={pts} fill="none" stroke={up ? "var(--chart-mint)" : "var(--chart-gold)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-8 animate-pulse rounded-lg bg-white/5" />
      ))}
    </div>
  );
}
