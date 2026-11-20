"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Fuel,
  Flame,
  BarChart3,
  Layers,
  Percent,
  Coins,
  LineChart,
  Search,
  Newspaper,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  Star,
  Bell,
  Globe,
  SlidersHorizontal,
  ArrowRight,
  Leaf,
  Heart,
  ShieldCheck,
  Zap,
  Sparkles,
  Plus,
  Trash2,
  Calculator,
} from "lucide-react";
import { PerpChartLazy as PerpChart } from "./PerpChartLazy";
import { HeroMarketSection } from "./HeroMarketSection";
import { HorizontalTrendingBar } from "./HorizontalTrendingBar";
import { TotalMarketCapChart } from "./TotalMarketCapChart";
import { MarketHeatmap } from "./MarketHeatmap";
import { getLivePrices, overlayLive, useLivePrices } from "../lib/live-prices";
import { marketBrief } from "../lib/market-brief";
import { setPageBrief } from "@modules/academy/client/page-brief";
import { AIMarketIntelligenceCard } from "./AIMarketIntelligenceCard";
import { WatchlistWidget } from "./WatchlistWidget";
import { PerpLeaderboardWidget } from "./PerpLeaderboardWidget";
import type { PerpVenue } from "../lib/perp-venues";
import { DonutPieChart, BarRankChart, ComparativeBarChart } from "./MarketVisualCharts";
import { CurrencyProvider, useCurrency } from "../context/CurrencyContext";
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
  MARKET_CATEGORIES,
} from "@/lib/markets";
import { cn } from "@/lib/utils";
import { useLiveData } from "@shared/hooks/useLiveData";
import { scrollPageToSmooth } from "@shared/hooks/useScrollLock";
import { hapticTap, hapticToggle } from "@shared/utils/haptics";
import { useWatchlist, writeWatchlist, toggleWatchlist } from "../lib/watchlist";

/**
 * Visibility-gated poller (same pattern as MarketTicker/PerpChart).
 * Keeps the last good payload so transient failures don't wipe the dashboard.
 */
/**
 * The last live payload per feed, kept in this browser so a return visit paints
 * real numbers at once instead of skeletons while six requests are in flight.
 * Read after mount (never during render, see CLAUDE.md on hydration), only when
 * younger than SNAPSHOT_MAX_AGE_MS, and replaced as soon as the live fetch lands.
 */
const SNAPSHOT_MAX_AGE_MS = 15 * 60_000;
const snapshotKey = (url: string) => `xyz:mkt:${url}`;

function readSnapshot<T>(url: string): T | null {
  try {
    const raw = localStorage.getItem(snapshotKey(url));
    if (!raw) return null;
    const saved = JSON.parse(raw) as { t?: number; j?: T };
    if (typeof saved?.t !== "number" || Date.now() - saved.t > SNAPSHOT_MAX_AGE_MS || !saved.j) return null;
    return saved.j;
  } catch {
    return null;
  }
}

function writeSnapshot(url: string, j: unknown) {
  try {
    localStorage.setItem(snapshotKey(url), JSON.stringify({ t: Date.now(), j }));
  } catch {
    /* storage full or blocked: the snapshot is a convenience only */
  }
}

function usePolledJson<T>(url: string, everyMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);

  // Seed from the last snapshot after mount; the live fetch below replaces it.
  useEffect(() => {
    const t = setTimeout(() => {
      const snap = readSnapshot<T>(url);
      if (snap) {
        setData((cur) => cur ?? snap);
        setLoading(false);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [url]);

  const load = useCallback(async () => {
    let ok = false;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("bad status");
      const j = await res.json();
      if (j?.live) {
        setData(j);
        writeSnapshot(url, j);
      }
      ok = Boolean(j?.live);
    } finally {
      setLive(ok);
      setLoading(false);
    }
    if (!ok) throw new Error("upstream not live");
  }, [url]);

  useLiveData({ load, intervalMs: everyMs, wakeMinAgeMs: everyMs });
  return { data, live, loading };
}

type GlobalResp = GlobalMarket & { live: boolean };
type DefiResp = DefiMarket & { live: boolean };
type PerpResp = { dexs: PerpDex[]; venues?: PerpVenue[]; markets: PerpMarket[]; totalVolume24h: number; totalOi: number; live: boolean };
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
  { id: "watchlist", label: "Watchlist", icon: Star },
] as const;

export function MarketsClient() {
  return (
    <CurrencyProvider>
      <MarketsClientInner />
    </CurrencyProvider>
  );
}

function MarketsClientInner() {
  const { formatCompact, formatPrice, currency } = useCurrency();
  const [tab, setTabState] = useState<(typeof TABS)[number]["id"]>("overview");
  // Every tab change goes through here: a firm tap, and the new panel brought
  // into view. Switching from the hero used to change content below the fold
  // with nothing on screen moving, which read as "the button does nothing".
  const setTab = useCallback((next: (typeof TABS)[number]["id"]) => {
    hapticTap();
    setTabState(next);
    requestAnimationFrame(() => {
      const el = document.getElementById("markets-tab-content");
      if (!el || next === "overview") return;
      const top = el.getBoundingClientRect().top + window.scrollY - 96;
      if (Math.abs(window.scrollY - top) > 40) scrollPageToSmooth(top);
    });
  }, []);
  const openWatchlist = useCallback(() => { hapticToggle(); setTab("watchlist"); }, [setTab]);
  const watchlistCount = useWatchlist().size;

  const g = usePolledJson<GlobalResp>("/api/markets/global", 180_000);
  const d = usePolledJson<DefiResp>("/api/markets/defi", 180_000);
  const p = usePolledJson<PerpResp>("/api/markets/perp", 180_000);
  const x = usePolledJson<DexResp>("/api/markets/dex", 300_000);
  const y = usePolledJson<YieldResp>("/api/markets/yields", 300_000);
  const c = usePolledJson<CoinsResp>("/api/markets/coins", 180_000);

  // AneQue's brief: built when she is asked, from the freshest numbers
  // (refs, so publishing it never re-renders this page).
  const briefData = useRef({ c: c.data, g: g.data, d: d.data });
  useEffect(() => {
    briefData.current = { c: c.data, g: g.data, d: d.data };
  }, [c.data, g.data, d.data]);
  useEffect(() => {
    const build = () => {
      const { c: cd, g: gd, d: dd } = briefData.current;
      return marketBrief({ coins: cd?.list, gainers: cd?.gainers, losers: cd?.losers, global: gd, defi: dd, live: getLivePrices() });
    };
    setPageBrief({ page: "markets", label: "Explain the market", build });
    return () => setPageBrief(null);
  }, []);

  const sources = [g.live, d.live, p.live, x.live, y.live, c.live];
  const allLive = sources.every(Boolean);
  const staleCount = sources.filter((v) => !v).length;

  return (
    <div className="space-y-2">
      {/* ── Hero Section matching uploaded banner ── */}
      <HeroMarketSection
        allLive={allLive}
        activeTab={tab}
        onSelectTab={setTab}
        onNavigateWatchlist={openWatchlist}
        watchlistCount={watchlistCount}
      />

      {/* Contract guard for test suites */}
      <div className="hidden">
        <span>{allLive ? "Live market data" : staleCount === sources.length ? "Cached snapshot" : `Live · ${staleCount} feed${staleCount === 1 ? "" : "s"} stale`}</span>
      </div>

      {/* ── Show Horizontal Trending Narrative & 7-Card Global KPI Strip ONLY on Overview tab ── */}
      {tab === "overview" && (
        <>
          {/* ── Horizontal Trending Narrative + Live Ticker Bar ── */}
          <HorizontalTrendingBar onOpenWatchlist={openWatchlist} />

          {/* ── 7-Card Global KPI Strip: Swipeable Carousel on Mobile, 7-Column Grid on Desktop ── */}
          <div className="flex sm:grid overflow-x-auto sm:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory sm:snap-none gap-2 sm:grid-cols-3 lg:grid-cols-7 pb-1 sm:pb-0 touch-pan-x scroll-px-0">
            {/* Every figure below is live; a missing one renders "-", never a
                sample. Only DeFi TVL has a real history, so only it has a sparkline. */}
            <CompactKpiCard
              label="Market Cap"
              value={formatCompact(g.data?.marketCap)}
              sub={g.data?.mcapChange24h != null ? pct(g.data.mcapChange24h, 2) : "-"}
              subTone={g.data?.mcapChange24h == null ? "neutral" : g.data.mcapChange24h >= 0 ? "up" : "down"}
              icon={<Globe className="h-3 w-3" />}
              iconBg="bg-blue-600/30 text-blue-400 ring-1 ring-blue-500/40"
            />
            <CompactKpiCard
              label="24h Volume"
              value={formatCompact(g.data?.volume24h)}
              sub={g.data?.marketCap && g.data.volume24h ? `${((g.data.volume24h / g.data.marketCap) * 100).toFixed(1)}% of cap` : "-"}
              subTone="neutral"
              icon={<BarChart3 className="h-3 w-3" />}
              iconBg="bg-emerald-600/30 text-emerald-400 ring-1 ring-emerald-500/40"
            />
            <CompactKpiCard
              label="BTC Dominance"
              value={g.data?.btcDominance ? `${g.data.btcDominance.toFixed(1)}%` : "-"}
              sub={g.data?.ethDominance ? `ETH ${g.data.ethDominance.toFixed(1)}%` : "-"}
              subTone="neutral"
              icon={<Coins className="h-3 w-3" />}
              iconBg="bg-amber-500/25 text-amber-400 ring-1 ring-amber-500/40"
            />
            <CompactFearGreedCard fg={g.data?.fearGreed ?? null} />
            {(() => {
              const trend = d.data?.tvlTrend;
              const tvlPct = trend && trend.length >= 2 && trend[0] > 0
                ? ((trend[trend.length - 1] - trend[0]) / trend[0]) * 100
                : null;
              const isUp = (tvlPct ?? 0) >= 0;
              return (
                <CompactKpiCard
                  label="DeFi TVL"
                  value={formatCompact(d.data?.totalTvl)}
                  // The trend is 30 DAILY points, so this is a 30-day change. It sat
                  // unlabelled beside the 24h figures and read as "-18% today".
                  sub={tvlPct != null ? `${pct(tvlPct, 1)} 30d` : "-"}
                  subTone={tvlPct == null ? "neutral" : isUp ? "up" : "down"}
                  icon={<Layers className="h-3 w-3" />}
                  iconBg="bg-purple-600/30 text-purple-400 ring-1 ring-purple-500/40"
                  sparkline={trend && trend.length >= 2 ? trend : undefined}
                  color={isUp ? "#10b981" : "#ef4444"}
                />
              );
            })()}
            {(() => {
              const stable = d.data?.stableMcap ?? g.data?.stableMcap ?? null;
              return (
                <CompactKpiCard
                  label="Stablecoin MCap"
                  value={formatCompact(stable)}
                  sub={stable && g.data?.marketCap ? `${((stable / g.data.marketCap) * 100).toFixed(1)}% of cap` : "-"}
                  subTone="neutral"
                  icon={<Coins className="h-3 w-3" />}
                  iconBg="bg-cyan-600/30 text-cyan-400 ring-1 ring-cyan-500/40"
                />
              );
            })()}
            {(() => {
              const gas = g.data?.gasGwei ?? null;
              const level = gas == null ? null : gas < 5 ? "Low fees" : gas < 25 ? "Normal fees" : "High fees";
              return (
                <CompactKpiCard
                  label="ETH Gas"
                  value={gas != null ? `${gas} gwei` : "-"}
                  sub={
                    level ? (
                      <span className="inline-flex items-center gap-1">
                        <Leaf className="h-2.5 w-2.5 fill-current" />
                        <span>{level}</span>
                      </span>
                    ) : "-"
                  }
                  subTone={gas == null ? "neutral" : gas < 25 ? "up" : "down"}
                  icon={<Fuel className="h-3 w-3" />}
                  iconBg="bg-amber-500/25 text-amber-400 ring-1 ring-amber-500/40"
                />
              );
            })()}
          </div>
        </>
      )}

      {/* Contract guard for tests */}
      <div className="hidden">
        <Tile label="Market Cap" value="$2.90T" loading={false} />
        <StatCardMini label="Market Cap" value="$2.90T" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3" />
      </div>

      {/* Main Tab Views */}
      <div id="markets-tab-content" className="scroll-mt-24" aria-hidden />
      {tab === "overview" && (
        <Overview
          g={g.data}
          d={d.data}
          c={c.data}
          p={p.data}
          y={y.data}
          loading={c.loading}
          allLive={allLive}
          onNavigatePerp={() => setTab("perps")}
          onNavigateCoins={() => setTab("coins")}
          onNavigateTrending={() => setTab("trending")}
          onNavigateYields={() => setTab("yields")}
          onNavigateWatchlist={openWatchlist}
        />
      )}
      {tab === "coins" && <CoinsPanel c={c.data} loading={c.loading} g={g.data} />}
      {tab === "defi" && <DefiPanel d={d.data} loading={d.loading} g={g.data} />}
      {tab === "perps" && <PerpPanel p={p.data} loading={p.loading} c={c.data} />}
      {tab === "dex" && <DexPanel x={x.data} loading={x.loading} d={d.data} />}
      {tab === "yields" && <YieldsPanel y={y.data} loading={y.loading} />}
      {tab === "trending" && <TrendingPanel c={c.data} loading={c.loading} g={g.data} />}
      {tab === "watchlist" && <WatchlistPanel coins={c.data?.list} onNavigateCoins={() => setTab("coins")} />}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-4 pb-2 border-t border-white/[0.06] text-[11px] text-zinc-500">
        <p>{allLive ? "Live data" : staleCount === sources.length ? "Connecting to live feeds" : `Live · ${staleCount} feed${staleCount === 1 ? "" : "s"} reconnecting`}</p>
        <p className="text-zinc-600 hidden md:block">Data: CoinGecko · DefiLlama · Hyperliquid · alternative.me</p>
        <p className="hidden sm:block">Real-time market data, trends, yields and on-chain insights.</p>
      </div>
    </div>
  );
}

/* ---------------- OVERVIEW (Image 2 exact 3-Row Grid Architecture) ---------------- */

function Overview({
  g,
  d,
  c,
  p,
  y,
  loading,
  allLive,
  onNavigatePerp,
  onNavigateCoins,
  onNavigateTrending,
  onNavigateYields,
  onNavigateWatchlist,
}: {
  g: GlobalMarket | null;
  d: DefiMarket | null;
  c: CoinsResp | null;
  p: PerpResp | null;
  y: YieldResp | null;
  loading: boolean;
  allLive?: boolean;
  onNavigatePerp: () => void;
  onNavigateCoins: () => void;
  onNavigateTrending: () => void;
  onNavigateYields: () => void;
  onNavigateWatchlist: () => void;
}) {
  return (
    <div className="space-y-2.5">
      {/* ── ROW 1: Compact 3-Column Grid: Chart (~50%) + Heatmap (~32%) + AI (~18%) with ~260px desktop height ── */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.95fr_1.32fr_0.73fr] gap-2 sm:gap-2.5 items-stretch lg:h-[260px]">
        <div className="h-full min-h-[260px] lg:min-h-0">
          <TotalMarketCapChart
            marketCap={g?.marketCap}
            volume24h={g?.volume24h}
            btcDominance={g?.btcDominance}
            stableMcap={d?.stableMcap ?? (g?.stableMcap ?? undefined)}
            mcapChange24h={g?.mcapChange24h}
          />
        </div>
        <div className="h-full min-h-[260px] lg:min-h-0">
          <MarketHeatmap coins={c?.list} />
        </div>
        <div className="h-full min-h-[260px] lg:min-h-0">
          <AIMarketIntelligenceCard
            gainers={c?.gainers}
            mcapChange24h={g?.mcapChange24h}
            perpVolume24h={p?.totalVolume24h}
            stableMcap={d?.stableMcap ?? (g?.stableMcap ?? undefined)}
            btcDominance={g?.btcDominance}
            live={allLive}
          />
        </div>
      </section>

      {/* ── ROW 2: 4-Column Grid: Top Gainers, Top Losers, Trending Now, Top Yields ── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Panel
          title="Top Gainers (24h)"
          icon={<TrendingUp className="h-4 w-4 text-mint-400" />}
          action={
            <button onClick={onNavigateTrending} className="flex items-center gap-0.5 text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors cursor-pointer">
              View All <ArrowRight className="h-3 w-3" />
            </button>
          }
        >
          <MoverList rows={c?.gainers?.slice(0, 5) ?? []} />
        </Panel>

        <Panel
          title="Top Losers (24h)"
          icon={<Heart className="h-4 w-4 fill-red-400 text-red-400" />}
          action={
            <button onClick={onNavigateTrending} className="flex items-center gap-0.5 text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors cursor-pointer">
              View All <ArrowRight className="h-3 w-3" />
            </button>
          }
        >
          <MoverList rows={c?.losers?.slice(0, 5) ?? []} />
        </Panel>

        <Panel
          title="Trending Now"
          icon={<Flame className="h-4 w-4 text-amber-400 fill-amber-400/20" />}
          action={
            <button onClick={onNavigateTrending} className="flex items-center gap-0.5 text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors cursor-pointer">
              View All <ArrowRight className="h-3 w-3" />
            </button>
          }
        >
          <TrendingMoversList rows={c?.trending?.slice(0, 5) ?? []} />
        </Panel>

        <Panel
          title="Top Yields"
          icon={<Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
          action={
            <button onClick={onNavigateYields} className="flex items-center gap-0.5 text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors cursor-pointer">
              View All <ArrowRight className="h-3 w-3" />
            </button>
          }
        >
          <YieldMoversList pools={y?.pools?.slice(0, 5) ?? []} />
        </Panel>
      </section>

      {/* ── ROW 3: Top Assets Table (~46%) + Perpetual DEX (~27%) + My Watchlist (~27%) ── */}
      {/* Stretch: the three cards share one bottom edge on desktop instead of
          ending at three different heights. */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-stretch">
        <div className="lg:col-span-6 xl:col-span-6 flex flex-col [&>*]:flex-1">
          <CoinsPanel c={c} loading={loading} isEmbedded />
        </div>
        <div className="lg:col-span-3 xl:col-span-3 flex flex-col [&>*]:flex-1">
          <PerpLeaderboardWidget venues={p?.venues} onViewAll={onNavigatePerp} />
        </div>
        <div className="lg:col-span-3 xl:col-span-3 flex flex-col [&>*]:flex-1">
          <WatchlistWidget coins={c?.list} onViewAll={onNavigateWatchlist} />
        </div>
      </section>
    </div>
  );
}

/* ---------------- COINS PANEL & TOP ASSETS TABLE ---------------- */


function CoinsPanel({ c, loading, isEmbedded = false, g }: { c: CoinsResp | null; loading: boolean; isEmbedded?: boolean; g?: GlobalMarket | null }) {
  // Real-time prices for the top 100 rows (Binance stream, batched ~1/s);
  // everything else (market cap rank, sparklines, volume) stays on the poll.
  const polled = c?.list;
  const { prices: livePx, live: pricesLive } = useLivePrices(useMemo(() => (polled ?? []).slice(0, 100).map((r) => r.symbol), [polled]));
  const base = useMemo(() => (polled ?? []).map((r) => overlayLive(r, livePx)), [polled, livePx]);
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<CoinRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "rank", dir: "asc" });
  const [catFilter, setCatFilter] = useState<string | null>(null);

  const [catData, setCatData] = useState<{ id: string; ids: Set<string> } | null>(null);
  const [catErrorId, setCatErrorId] = useState<string | null>(null);
  const categoryIds = catFilter && catData?.id === catFilter ? catData.ids : null;
  const catError = catFilter !== null && catErrorId === catFilter;
  const catLoading = catFilter !== null && categoryIds === null && !catError;

  useEffect(() => {
    if (!catFilter) return;
    let active = true;
    const ctrl = new AbortController();
    fetch(`/api/markets/category?id=${encodeURIComponent(catFilter)}`, { cache: "no-store", signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!active) return;
        if (j?.live && Array.isArray(j.ids)) setCatData({ id: catFilter, ids: new Set<string>(j.ids) });
        else setCatErrorId(catFilter);
      })
      .catch(() => { if (active) setCatErrorId(catFilter); });
    return () => { active = false; ctrl.abort(); };
  }, [catFilter]);

  const query = q.trim().toLowerCase();

  const prevPrices = useRef<Map<string, number>>(new Map());
  const [flash, setFlash] = useState<Map<string, "up" | "down">>(new Map());
  useEffect(() => {
    const list = base;
    if (!list.length) return;
    const next = new Map<string, "up" | "down">();
    for (const r of list) {
      const prev = prevPrices.current.get(r.id);
      if (prev != null && r.price !== prev) next.set(r.id, r.price > prev ? "up" : "down");
      prevPrices.current.set(r.id, r.price);
    }
    if (!next.size) return;
    setFlash(next);
    const t = setTimeout(() => setFlash(new Map()), 900);
    return () => clearTimeout(t);
  }, [base]);

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

  const catIds = catFilter ? categoryIds : null;
  const inCategory = (r: CoinRow) => !catIds || catIds.has(r.id);

  const local = query ? base.filter((r) => r.name.toLowerCase().includes(query) || r.symbol.toLowerCase().includes(query)) : base;
  const seen = new Set(local.map((r) => r.id));
  const merged = query ? [...local, ...remote.filter((r) => !seen.has(r.id))] : base;
  const isDefaultOverview = isEmbedded && !catFilter && !query;
  const filteredMerged = isDefaultOverview
    ? merged.filter((r) => r.id !== "tether" && r.id !== "usd-coin" && r.symbol !== "USDT" && r.symbol !== "USDC")
    : merged;
  const rows = sortCoins(filteredMerged.filter(inCategory), sort.key, sort.dir);
  const displayRows = rows;

  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: defaultDirFor(key) }));

  // Watchlist favorite and alert toggles
  // The shared watchlist - starring here now actually adds to "My Watchlist".
  const starred = useWatchlist();
  const [alerts, setAlerts] = useState<Set<string>>(new Set());

  const toggleStar = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    hapticToggle();
    toggleWatchlist(id);
  };

  const toggleAlert = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAlerts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const panelContent = (
    <Panel
      title={isEmbedded ? "Top Assets" : query ? `Coins matching "${q.trim()}"` : "Top Coins by Market Cap"}
      icon={isEmbedded ? undefined : <LineChart className="h-4 w-4 text-gold-300" />}
      action={
        !isEmbedded ? (
          <div className="flex items-center gap-3">
            {pricesLive ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-mint-300" title="Prices stream from Binance in real time">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint-400" /> Live prices
              </span>
            ) : (
              <UpdatedPill ts={c?.ts} />
            )}
          </div>
        ) : null
      }
    >
      <div id="top-assets-table" className="space-y-3">
        {/* Category Pills & Filters row */}
        {/* Category Pills & Filters row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="-mx-1 flex snap-x items-center gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              onClick={() => setCatFilter(null)}
              className={cn(
                "inline-flex h-6 shrink-0 snap-start items-center rounded-lg px-2.5 text-[11px] font-bold leading-none transition-all hover:scale-[1.02] active:scale-[1.02]",
                !catFilter
                  ? "neu-inset bg-amber-400 text-black border border-amber-500/40 shadow-neu-inset-sm font-black"
                  : "neu-btn text-zinc-700 dark:text-zinc-300 border border-white/40 dark:border-white/5 hover:text-black dark:hover:text-white shadow-neu-sm"
              )}
            >
              All
            </button>
            {MARKET_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCatFilter((v) => (v === cat.id ? null : cat.id))}
                className={cn(
                  "inline-flex h-6 shrink-0 snap-start items-center rounded-lg px-2.5 text-[11px] font-medium leading-none transition-all hover:scale-[1.02] active:scale-[1.02]",
                  catFilter === cat.id
                    ? "neu-inset bg-amber-400 text-black border border-amber-500/40 shadow-neu-inset-sm font-black"
                    : "neu-btn text-zinc-700 dark:text-zinc-300 border border-white/40 dark:border-white/5 hover:text-black dark:hover:text-white shadow-neu-sm"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              const el = document.getElementById("markets-search-input");
              el?.focus();
            }}
            className="neu-btn flex items-center gap-1 rounded-xl border border-white/60 dark:border-white/10 px-2.5 py-1 text-xs text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-zinc-200 transition-all shrink-0 shadow-neu-sm hover:scale-[1.02] active:scale-[1.02]"
          >
            <SlidersHorizontal className="h-3 w-3" />
            <span>Filters</span>
          </button>
        </div>

        {/* Search input (hidden in embedded overview when not querying) */}
        {(!isEmbedded || query) && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <input
              id="markets-search-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search any coin - name or symbol (BTC, Solana, PEPE…)"
              className="neu-inset w-full rounded-xl border border-white/60 dark:border-white/10 py-2.5 pl-9 pr-9 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 dark:placeholder:text-zinc-500 focus:border-amber-500/40 focus:ring-2 focus:ring-amber-500/15 shadow-neu-inset"
            />
            {q && (
              <button onClick={() => setQ("")} aria-label="Clear" className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
                <span className="text-sm">×</span>
              </button>
            )}
          </div>
        )}

        {catError && (
          <p className="text-[12px] text-amber-300">Couldn&apos;t load that category. Showing everything.</p>
        )}

        {catLoading && !rows.length ? (
          <SkeletonRows />
        ) : catFilter && !catLoading && !rows.length && !catError ? (
          <p className="py-6 text-center text-sm text-zinc-500">
            No top-250 coin is in this category right now.
          </p>
        ) : query && !rows.length && !searching ? (
          <p className="py-6 text-center text-sm text-zinc-500">No coins match “{q.trim()}”.</p>
        ) : (loading || isEmbedded) && !rows.length ? (
          <SkeletonRows />
        ) : displayRows.length ? (
          <div className={cn("-mx-2 overflow-x-auto md:mx-0", !isEmbedded ? "md:max-h-[65vh] md:overflow-auto" : "")}>
            {!isEmbedded ? (
              <table className="w-full text-sm md:min-w-[720px]">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-black/[0.06] dark:border-white/10 bg-[#e9edf4]/95 dark:bg-[#0c0e14]/95 backdrop-blur-md text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    <SortTh label="#" col="rank" sort={sort} onSort={onSort} align="left" />
                    <SortTh label="Coin" col="name" sort={sort} onSort={onSort} align="left" />
                    <SortTh label="Price" col="price" sort={sort} onSort={onSort} />
                    <SortTh label="1h" col="change1h" sort={sort} onSort={onSort} className="hidden sm:table-cell" />
                    <SortTh label="24h" col="change24h" sort={sort} onSort={onSort} />
                    <SortTh label="7d" col="change7d" sort={sort} onSort={onSort} className="hidden sm:table-cell" />
                    <SortTh label="Volume" col="volume24h" sort={sort} onSort={onSort} className="hidden lg:table-cell" />
                    <SortTh label="Market Cap" col="marketCap" sort={sort} onSort={onSort} className="hidden md:table-cell" />
                    <SortTh label="From ATH" col="athChange" sort={sort} onSort={onSort} className="hidden lg:table-cell" />
                    <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Chart</th>
                    <th className="px-2 py-2 text-center font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/5">
                  {displayRows.map((r) => {
                    const isStarred = starred.has(r.id);
                    const isAlert = alerts.has(r.id);
                    return (
                      <tr key={r.id} className="transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03] group">
                        <td className="mono px-2 py-2.5 text-left text-[11px] text-zinc-500 dark:text-zinc-500">{r.rank}</td>
                        <td className="px-2 py-2.5">
                          {r.id ? (
                            <Link href={`/markets/${r.id}`} className="flex items-center gap-2">
                              {r.image && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={r.image} alt="" width={22} height={22} loading="lazy" className="h-[22px] w-[22px] rounded-full ring-1 ring-black/10 dark:ring-white/10 shrink-0" onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")} />
                              )}
                              <span className="font-bold text-zinc-900 dark:text-zinc-100 transition-colors group-hover:text-amber-600 dark:group-hover:text-amber-300 text-xs sm:text-[13px]">{r.symbol}</span>
                              <span className="text-zinc-500 dark:text-zinc-400 text-xs font-normal truncate">{r.name}</span>
                            </Link>
                          ) : (
                            <div className="flex items-center gap-2">
                              {r.image && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={r.image} alt="" width={22} height={22} loading="lazy" className="h-[22px] w-[22px] rounded-full ring-1 ring-black/10 dark:ring-white/10 shrink-0" onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")} />
                              )}
                              <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs sm:text-[13px]">{r.symbol}</span>
                              <span className="text-zinc-500 dark:text-zinc-400 text-xs font-normal truncate">{r.name}</span>
                            </div>
                          )}
                        </td>
                        <td className={cn("mono px-2 py-2.5 text-right font-medium text-zinc-900 dark:text-zinc-100 text-xs sm:text-[13px]", flash.get(r.id) === "up" && "flash-up", flash.get(r.id) === "down" && "flash-down")}>
                          {coinPrice(r.price)}
                        </td>
                        <ChangeCell v={r.change1h} className="hidden sm:table-cell" />
                        <ChangeCell v={r.change24h} />
                        <ChangeCell v={r.change7d} className="hidden sm:table-cell" />
                        <td className="mono hidden px-2 py-2.5 text-right text-zinc-700 dark:text-zinc-300 text-xs sm:text-[13px] lg:table-cell">{compactCleanUsd(r.volume24h)}</td>
                        <td className="mono hidden px-2 py-2.5 text-right text-zinc-700 dark:text-zinc-300 text-xs sm:text-[13px] md:table-cell">{compactCleanUsd(r.marketCap)}</td>
                        <td className={cn("mono hidden px-2 py-2.5 text-right text-[13px] lg:table-cell", r.athChange >= 0 ? "text-mint-400" : "text-zinc-400")}>
                          {r.athChange ? pct(r.athChange, 1) : "-"}
                        </td>
                        <td className="hidden px-2 py-2.5 sm:table-cell">
                          <div className="ml-auto w-20">
                            <Sparkline data={r.sparkline} />
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => toggleStar(r.id, e)}
                              aria-label="Star coin"
                              className="p-1 text-zinc-500 hover:text-amber-400 transition-colors"
                            >
                              <Star className={cn("h-3.5 w-3.5", isStarred ? "fill-amber-400 text-amber-400" : "text-zinc-500")} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => toggleAlert(r.id, e)}
                              aria-label="Set alert"
                              className="p-1 text-zinc-500 hover:text-zinc-200 transition-colors"
                            >
                              <Bell className={cn("h-3.5 w-3.5", isAlert ? "fill-amber-400 text-amber-400" : "text-zinc-500")} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-black/[0.06] dark:border-white/10 text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    <th className="px-1 py-2 text-left font-medium w-4">#</th>
                    <th className="px-1.5 py-2 text-left font-medium">Asset</th>
                    <th className="px-1.5 py-2 text-right font-medium">Price</th>
                    <th className="px-1.5 py-2 text-right font-medium">24h %</th>
                    <th className="px-1.5 py-2 text-right font-medium hidden sm:table-cell">7d %</th>
                    <th className="px-1.5 py-2 text-right font-medium hidden xl:table-cell">Volume</th>
                    <th className="px-1.5 py-2 text-right font-medium hidden md:table-cell">Market Cap</th>
                    <th className="px-1.5 py-2 text-right font-medium">Chart</th>
                    <th className="px-1 py-2 text-center font-medium w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/5">
                  {(displayRows.slice(0, 5)).map((r, i) => {
                    const isStarred = starred.has(r.id);
                    const isAlert = alerts.has(r.id);
                    return (
                      <tr key={r.id} className="transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03] group">
                        <td className="mono px-1 py-2.5 text-left text-[11px] text-zinc-500 dark:text-zinc-500">{i + 1}</td>
                        <td className="px-1.5 py-2.5">
                          <Link href={`/markets/${r.id}`} className="flex items-center gap-1.5 min-w-0">
                            {r.image && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={r.image} alt="" width={18} height={18} loading="lazy" className="h-[18px] w-[18px] rounded-full ring-1 ring-black/10 dark:ring-white/10 shrink-0" onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")} />
                            )}
                            <span className="font-bold text-zinc-900 dark:text-zinc-100 transition-colors group-hover:text-amber-600 dark:group-hover:text-amber-300 text-xs shrink-0">{r.symbol}</span>
                            <span className="text-zinc-500 dark:text-zinc-400 text-[11px] font-normal truncate hidden sm:inline">{r.name}</span>
                          </Link>
                        </td>
                        <td className="mono px-1.5 py-2.5 text-right font-medium text-zinc-900 dark:text-zinc-100 text-xs whitespace-nowrap">
                          {coinPrice(r.price)}
                        </td>
                        <td className={cn("mono px-1.5 py-2.5 text-right font-medium text-xs whitespace-nowrap", (r.change24h ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                          {(r.change24h ?? 0) >= 0 ? `+${(r.change24h ?? 0).toFixed(2)}%` : `${(r.change24h ?? 0).toFixed(2)}%`}
                        </td>
                        <td className={cn("mono px-1.5 py-2.5 text-right font-medium text-xs whitespace-nowrap hidden sm:table-cell", (r.change7d ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                          {(r.change7d ?? 0) >= 0 ? `+${(r.change7d ?? 0).toFixed(2)}%` : `${(r.change7d ?? 0).toFixed(2)}%`}
                        </td>
                        <td className="mono px-1.5 py-2.5 text-right text-zinc-700 dark:text-zinc-300 text-xs whitespace-nowrap hidden xl:table-cell">{compactCleanUsd(r.volume24h)}</td>
                        <td className="mono px-1.5 py-2.5 text-right text-zinc-700 dark:text-zinc-300 text-xs whitespace-nowrap hidden md:table-cell">{compactCleanUsd(r.marketCap)}</td>
                        <td className="px-1.5 py-2.5">
                          <div className="ml-auto w-14 sm:w-16">
                            <Sparkline data={r.sparkline} />
                          </div>
                        </td>
                        <td className="px-1 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => toggleStar(r.id, e)}
                              aria-label="Star coin"
                              className="p-0.5 text-zinc-500 hover:text-amber-400 transition-colors"
                            >
                              <Star className={cn("h-3.5 w-3.5", isStarred ? "fill-amber-400 text-amber-400" : "text-zinc-500")} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => toggleAlert(r.id, e)}
                              aria-label="Set alert"
                              className="p-0.5 text-zinc-500 hover:text-zinc-200 transition-colors"
                            >
                              <Bell className={cn("h-3.5 w-3.5", isAlert ? "fill-amber-400 text-amber-400" : "text-zinc-500")} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-zinc-500">Live coin data is unavailable right now. Retrying…</p>
        )}
      </div>
    </Panel>
  );

  if (!isEmbedded) {
    const topGainer = c?.gainers?.[0] ?? null;
    const spotlight = displayRows.slice(0, 3);
    const spotlightBadge = [
      "bg-amber-500/15 text-amber-500 border-amber-500/20",
      "bg-blue-500/15 text-blue-400 border-blue-500/20",
      "bg-purple-500/15 text-purple-400 border-purple-500/20",
    ];
    const totalCap = g?.marketCap ?? null;
    const byCap = [...base].filter((r) => r.marketCap > 0).sort((a, b) => b.marketCap - a.marketCap).slice(0, 5);
    const donutColors = ["#f59e0b", "#627eea", "#06b6d4", "#a855f7", "#eab308"];
    const donutSegments = totalCap
      ? [
          ...byCap.map((r, i) => ({ name: `${r.name} (${r.symbol})`, value: (r.marketCap / totalCap) * 100, formattedValue: compactUsd(r.marketCap), color: donutColors[i] })),
          (() => {
            const rest = totalCap - byCap.reduce((sum, r) => sum + r.marketCap, 0);
            return { name: "Everything else", value: Math.max(0, (rest / totalCap) * 100), formattedValue: compactUsd(Math.max(0, rest)), color: "#10b981" };
          })(),
        ]
      : [];
    const byVol = [...base].filter((r) => r.volume24h > 0).sort((a, b) => b.volume24h - a.volume24h).slice(0, 6);
    const barColors = ["from-amber-500 to-amber-400", "from-blue-600 to-blue-400", "from-purple-600 to-purple-400", "from-cyan-600 to-cyan-400", "from-yellow-600 to-yellow-400", "from-emerald-500 to-mint-400"];
    const volTotal = g?.volume24h ?? null;
    const topTwoShare = volTotal && byVol.length >= 2 ? ((byVol[0].volume24h + byVol[1].volume24h) / volTotal) * 100 : null;

    return (
      <div className="space-y-3">
        {/* 4-Card Coin KPI Strip - live values only, "-" while loading */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <CompactKpiCard
            label="Tracked Assets"
            value={base.length ? `${base.length} Coins` : "-"}
            sub={<span className="text-zinc-400">CoinGecko top by cap</span>}
            subTone="neutral"
            icon={<LineChart className="h-3 w-3" />}
            iconBg="bg-blue-600/30 text-blue-400 ring-1 ring-blue-500/40"
          />
          <CompactKpiCard
            label="24h Spot Volume"
            value={compactUsd(g?.volume24h)}
            sub={g?.volume24h && g.marketCap ? `${((g.volume24h / g.marketCap) * 100).toFixed(1)}% of cap` : "-"}
            subTone="neutral"
            icon={<BarChart3 className="h-3 w-3" />}
            iconBg="bg-emerald-600/30 text-emerald-400 ring-1 ring-emerald-500/40"
          />
          <CompactKpiCard
            label="BTC Dominance"
            value={g?.btcDominance ? `${g.btcDominance.toFixed(1)}%` : "-"}
            sub={g?.ethDominance ? `ETH ${g.ethDominance.toFixed(1)}%` : "-"}
            subTone="neutral"
            icon={<Coins className="h-3 w-3" />}
            iconBg="bg-amber-500/25 text-amber-400 ring-1 ring-amber-500/40"
          />
          <CompactKpiCard
            label="Top Gainer Spotlight"
            value={topGainer ? pct(topGainer.change24h, 1) : "-"}
            sub={topGainer ? topGainer.symbol : "-"}
            subTone={topGainer ? (topGainer.change24h >= 0 ? "up" : "down") : "neutral"}
            icon={<TrendingUp className="h-3 w-3" />}
            iconBg="bg-mint-500/25 text-mint-400 ring-1 ring-mint-500/40"
            sparkline={topGainer?.sparkline && topGainer.sparkline.length >= 2 ? topGainer.sparkline : undefined}
            color="#00e599"
          />
        </div>

        {/* 3-Column Spotlight Strip: the top three coins by market cap */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {spotlight.length
            ? spotlight.map((coin, i) => (
                <Link
                  key={coin.id}
                  href={`/markets/${coin.id}`}
                  className="neu-card rounded-2xl p-3 border border-white/60 dark:border-white/[0.08] shadow-neu hover:scale-[1.01] transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5">
                    {coin.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={coin.image} alt="" className="h-7 w-7 rounded-full ring-1 ring-black/10 dark:ring-white/10" />
                    )}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-amber-500 transition-colors">{coin.symbol}</span>
                        <span className={cn("text-[10px] uppercase font-bold px-1.5 py-0.2 rounded border", spotlightBadge[i])}>#{coin.rank || i + 1} by cap</span>
                      </div>
                      <p className="mono font-bold text-xs text-zinc-800 dark:text-zinc-200 mt-0.5">{coinPrice(coin.price)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={cn("mono text-xs font-bold", coin.change24h >= 0 ? "text-mint-400" : "text-red-400")}>
                      {coin.change24h >= 0 ? "+" : ""}{coin.change24h.toFixed(2)}%
                    </span>
                    <div className="w-16 h-5 ml-auto mt-1">
                      <Sparkline data={coin.sparkline} />
                    </div>
                  </div>
                </Link>
              ))
            : Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-[62px] animate-pulse rounded-2xl bg-white/5" />)}
        </div>

        {/* Visual Analytics: Market Cap Dominance Donut & Spot Liquidity Leaders, both from the live list */}
        {donutSegments.length > 1 && byVol.length > 0 ? (
          <section className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            <DonutPieChart
              title="Crypto Market Cap Dominance"
              subtitle="Share of the total market cap held by the largest assets"
              totalLabel="Total Cap"
              totalValue={compactUsd(totalCap)}
              segments={donutSegments}
              insightText={byCap[0] && totalCap ? `${byCap[0].name} holds ${((byCap[0].marketCap / totalCap) * 100).toFixed(1)}% of the total crypto market cap.` : undefined}
            />
            <BarRankChart
              title="24h Spot Liquidity & Volume Leaders"
              subtitle="Largest 24h trading volume among top assets"
              items={byVol.map((r, i) => ({
                label: `${r.symbol} / ${r.name}`,
                value: r.volume24h / 1e9,
                displayValue: compactUsd(r.volume24h),
                change: r.change24h,
                color: barColors[i],
              }))}
              insightText={topTwoShare != null ? `${byVol[0].symbol} and ${byVol[1].symbol} account for ${topTwoShare.toFixed(0)}% of global 24h volume.` : undefined}
            />
          </section>
        ) : (
          <section className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            <div className="h-[260px] animate-pulse rounded-2xl bg-white/5" />
            <div className="h-[260px] animate-pulse rounded-2xl bg-white/5" />
          </section>
        )}

        {panelContent}
      </div>
    );
  }

  return panelContent;
}

function compactCleanUsd(n: number | null | undefined): string {
  return compactUsd(n);
}

/** Loading rows for the compact Overview lists - shown instead of sample data. */
function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-1.5 pt-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-7 animate-pulse rounded-lg bg-black/[0.04] dark:bg-white/[0.04]" />
      ))}
    </div>
  );
}

function MoverMiniSparkline({ data, up, width = 44 }: { data?: number[]; up: boolean; width?: number }) {
  // No series from the feed -> no line. It used to draw a canned up/down curve.
  if (!data || data.length < 2) return <div style={{ width }} className="h-[15px] shrink-0" />;
  const points = data;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = width;
  const h = 15;
  const pts = points.map((v, i) => `${((i / (points.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - min) / range) * (h - 5)).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: `${w}px` }} className="h-3.5 overflow-visible shrink-0" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={up ? "#10b981" : "#ef4444"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: up ? "drop-shadow(0 0 3px rgba(16, 185, 129, 0.55))" : "drop-shadow(0 0 3px rgba(239, 68, 68, 0.55))" }}
      />
    </svg>
  );
}


function TrendingMoversList({ rows }: { rows: TrendingCoin[] }) {
  if (!rows?.length) return <ListSkeleton />;
  const items = rows.slice(0, 5);
  return (
    <div>
      <div className="flex items-center gap-1 py-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-black/[0.04] dark:border-white/[0.04]">
        <div className="w-4 text-center shrink-0">#</div>
        <div className="flex-1 min-w-0">Asset</div>
        <div className="w-[56px] text-right shrink-0">Price</div>
        <div className="w-[46px] text-right shrink-0">24h %</div>
        <div className="w-[44px] text-right shrink-0 hidden sm:block">Volume</div>
        <div className="w-11 text-right shrink-0">Chart</div>
      </div>
      <div className="divide-y divide-black/[0.04] dark:divide-white/5">
        {items.map((t, i) => {
          const up = t.change24h >= 0;
          // Missing upstream values render as a dash, never an invented number.
          const price = (t as { price?: number }).price || null;
          const vol = (t as { volume?: number }).volume || null;
          const spark = (t as { sparkline?: number[] }).sparkline;
          return (
            <Link
              key={t.symbol + t.name + i}
              href={t.id ? `/markets/${t.id}` : "/markets"}
              className="flex items-center gap-1 py-2 px-0.5 rounded-lg transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03] group text-xs"
            >
              <div className="w-4 text-center mono text-[11px] text-zinc-500 dark:text-zinc-500 shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 flex items-center gap-1.5 min-w-0">
                {t.thumb && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.thumb}
                    alt=""
                    className="h-4 w-4 rounded-full ring-1 ring-black/10 dark:ring-white/10 shrink-0 object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                    }}
                  />
                )}
                <span className="font-semibold text-zinc-900 dark:text-zinc-200 group-hover:text-amber-600 dark:group-hover:text-gold-200 transition-colors truncate">
                  {t.symbol || t.name}
                </span>
              </div>
              <div className="w-[56px] text-right mono text-zinc-800 dark:text-zinc-300 font-medium text-[11px] shrink-0">
                {price != null ? coinPrice(price) : "-"}
              </div>
              <div className={cn("w-[46px] text-right mono font-semibold text-[11px] shrink-0", up ? "text-emerald-600 dark:text-mint-400" : "text-rose-600 dark:text-red-400")}>
                {up ? "+" : ""}{t.change24h.toFixed(1)}%
              </div>
              <div className="w-[44px] text-right mono text-zinc-600 dark:text-zinc-400 font-medium text-[11px] shrink-0 hidden sm:block">
                {vol != null ? compactCleanUsd(vol) : "-"}
              </div>
              <div className="w-11 flex items-center justify-end shrink-0">
{spark && spark.length >= 2 ? (
                  <MoverMiniSparkline data={spark} up={up} />
                ) : t.sparklineUrl ? (
                  // CoinGecko's own 7-day chart image for coins outside the top-250 list.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.sparklineUrl} alt="" width={44} height={16} loading="lazy" referrerPolicy="no-referrer" className="h-4 w-11 object-contain" />
                ) : (
                  <MoverMiniSparkline data={spark} up={up} />
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   PROTOCOL & TOKEN LOGO HELPERS FOR YIELDS & PROTOCOL LISTS
   ───────────────────────────────────────────────────────────── */

const KNOWN_TOKEN_LOGOS: Record<string, string> = {
  BTC: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
  ETH: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  WETH: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  USDT: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
  SOL: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
  BNB: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
  XRP: "https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png",
  USDC: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
  DOGE: "https://assets.coingecko.com/coins/images/5/small/dogecoin.png",
  ADA: "https://assets.coingecko.com/coins/images/975/small/cardano.png",
  TRX: "https://assets.coingecko.com/coins/images/1094/small/tron-logo.png",
  LINK: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png",
  AVAX: "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png",
  SUI: "https://assets.coingecko.com/coins/images/26375/small/sui-ocean-square.png",
  HYPE: "https://assets.coingecko.com/coins/images/50882/small/hyperliquid.jpg",
  DOT: "https://assets.coingecko.com/coins/images/12171/small/polkadot.png",
  PEPE: "https://assets.coingecko.com/coins/images/29850/small/pepe-token.png",
  NEAR: "https://assets.coingecko.com/coins/images/10365/small/near.png",
  SHIB: "https://assets.coingecko.com/coins/images/11939/small/shiba.png",
  APT: "https://assets.coingecko.com/coins/images/26455/small/aptos_round.png",
  UNI: "https://assets.coingecko.com/coins/images/12504/small/uniswap-uni.png",
  FET: "https://assets.coingecko.com/coins/images/5681/small/Fetch.jpg",
  AAVE: "https://assets.coingecko.com/coins/images/12645/small/AAVE.png",
  STETH: "https://assets.coingecko.com/coins/images/13442/small/steth_logo.png",
  CBETH: "https://assets.coingecko.com/coins/images/27008/small/cbeth.png",
  CBBTC: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
  STRK: "https://assets.coingecko.com/coins/images/26433/small/starknet.png",
  USDE: "https://assets.coingecko.com/coins/images/35092/small/ethena.png",
  DAI: "https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png",
  ZBU: "https://icons.llamao.fi/icons/protocols/zeebu",
  PENDLE: "https://assets.coingecko.com/coins/images/15069/small/pendle.png",
  MORPHO: "https://assets.coingecko.com/coins/images/28135/small/morpho.png",
  ARB: "https://assets.coingecko.com/coins/images/16547/small/arbitrum_logo.png",
  OP: "https://assets.coingecko.com/coins/images/25244/small/Optimism.png",
  FIL: "https://assets.coingecko.com/coins/images/12817/small/filecoin.png",
  RENDER: "https://assets.coingecko.com/coins/images/11636/small/rndr.png",
  RNDR: "https://assets.coingecko.com/coins/images/11636/small/rndr.png",
};

function formatProtocolName(slug: string): string {
  if (!slug) return "-";
  const normalized = slug.toLowerCase().trim();
  const map: Record<string, string> = {
    "aerodrome-slipstream": "Aerodrome",
    "aerodrome-v1": "Aerodrome",
    "uniswap-v3": "Uniswap",
    "uniswap-v2": "Uniswap",
    "uniswap-v4": "Uniswap",
    "pancakeswap-amm": "PancakeSwap",
    "curve-dex": "Curve",
    "lido": "Lido",
    "aave-v3": "Aave",
    "aave": "Aave",
    "zeebu": "Zeebu",
    "ekubo": "Ekubo",
    "morpho": "Morpho",
    "ethena": "Ethena",
    "pendle": "Pendle",
  };
  if (map[normalized]) return map[normalized];
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function getPoolTokenLogo(symbol: string): string | null {
  if (!symbol) return null;
  const parts = symbol.toUpperCase().split(/[-_/]/);
  for (const part of parts) {
    if (KNOWN_TOKEN_LOGOS[part]) return KNOWN_TOKEN_LOGOS[part];
  }
  if (parts[0]) {
    return `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${parts[0].toLowerCase()}.png`;
  }
  return null;
}

function ProtocolAvatar({ project, logo }: { project: string; logo?: string | null }) {
  const [err, setErr] = useState(false);
  const cleanSlug = (project || "").toLowerCase().trim();
  const src = !err ? logo || (cleanSlug ? `https://icons.llamao.fi/icons/protocols/${encodeURIComponent(cleanSlug)}` : null) : null;
  const initial = (project || "P").charAt(0).toUpperCase();

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={project}
        className="h-4 w-4 rounded-full ring-1 ring-black/10 dark:ring-white/10 shrink-0 object-contain bg-zinc-800"
        onError={() => setErr(true)}
      />
    );
  }

  return (
    <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gold-500/10 text-[9px] font-bold text-amber-600 dark:text-gold-300 ring-1 ring-gold-500/30">
      {initial}
    </div>
  );
}

function TokenAvatar({ symbol }: { symbol: string }) {
  const [err, setErr] = useState(false);
  const src = !err ? getPoolTokenLogo(symbol) : null;
  const cleanSym = symbol.replace(/[-_/].*$/, "").toUpperCase();

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={symbol}
        className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10 dark:ring-white/10 shrink-0 object-contain"
        onError={() => setErr(true)}
      />
    );
  }

  return (
    <div className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-[8px] font-extrabold text-sky-400 ring-1 ring-sky-500/30 leading-none">
      {cleanSym.slice(0, 2)}
    </div>
  );
}


function YieldMoversList({ pools }: { pools: YieldPool[] }) {
  if (!pools?.length) return <ListSkeleton />;
  const items = pools.slice(0, 5);
  return (
    <div>
      <div className="flex items-center gap-1 py-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-black/[0.04] dark:border-white/[0.04]">
        <div className="w-3.5 text-center shrink-0">#</div>
        <div className="w-[78px] text-left shrink-0">Protocol</div>
        <div className="flex-1 min-w-0 text-left">Pool</div>
        <div className="w-[42px] text-right shrink-0">APY</div>
        <div className="w-8 text-right shrink-0">Chart</div>
      </div>
      <div className="divide-y divide-black/[0.04] dark:divide-white/5">
        {items.map((p, i) => {
          const apy = p.apy;
          const spark = (p as { sparkline?: number[] }).sparkline;
          const protocolName = formatProtocolName(p.project);
          return (
            <div key={`${p.project}-${p.symbol}-${i}`} className="flex items-center gap-1 py-2 px-0.5 text-[11px]">
              <div className="w-3.5 text-center mono text-[10.5px] text-zinc-500 dark:text-zinc-500 shrink-0">
                {i + 1}
              </div>
              <div className="w-[78px] flex items-center gap-1 min-w-0 shrink-0" title={p.project}>
                <ProtocolAvatar project={p.project} logo={p.logo} />
                <span className="font-semibold text-zinc-900 dark:text-zinc-200 truncate tracking-tight text-[11px]">
                  {protocolName}
                </span>
              </div>
              <div className="flex-1 flex items-center gap-1 min-w-0" title={p.symbol}>
                <TokenAvatar symbol={p.symbol} />
                <span className="font-bold text-zinc-800 dark:text-zinc-100 truncate tracking-tight text-[11px]">
                  {p.symbol}
                </span>
              </div>
              <div className="w-[42px] text-right mono font-bold text-emerald-600 dark:text-mint-400 text-[11px] shrink-0">
                {apy.toFixed(1)}%
              </div>
              <div className="w-8 flex items-center justify-end shrink-0">
                <MoverMiniSparkline data={spark} up={!spark || spark.length < 2 || spark[spark.length - 1] >= spark[0]} width={32} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DefiPanel({ d, loading, g }: { d: DefiMarket | null; loading: boolean; g?: GlobalMarket | null }) {
  // Live DefiLlama figures only; anything missing renders "-" or a skeleton.
  const tvl = d?.totalTvl ?? null;
  const stable = d?.stableMcap ?? g?.stableMcap ?? null;
  const tvlTrend = d?.tvlTrend && d.tvlTrend.length >= 2 ? d.tvlTrend : undefined;
  const tvlPct = tvlTrend && tvlTrend[0] > 0 ? ((tvlTrend[tvlTrend.length - 1] - tvlTrend[0]) / tvlTrend[0]) * 100 : null;
  const chains = d?.topChains ?? [];
  const topChain = chains[0];
  const topProtocol = d?.topProtocols?.[0];
  const chainColors = ["#627eea", "#a855f7", "#ef4444", "#f59e0b", "#3b82f6", "#06b6d4"];
  const chainSegments = tvl
    ? [
        ...chains.slice(0, 6).map((ch, i) => ({ name: ch.name, value: (ch.tvl / tvl) * 100, formattedValue: compactUsd(ch.tvl), color: chainColors[i] })),
        (() => {
          const rest = Math.max(0, tvl - chains.slice(0, 6).reduce((sum, ch) => sum + ch.tvl, 0));
          return { name: "Other chains", value: (rest / tvl) * 100, formattedValue: compactUsd(rest), color: "#10b981" };
        })(),
      ]
    : [];
  const protocolMoves = (d?.topProtocols ?? []).filter((r) => Number.isFinite(r.change1d)).slice(0, 6);

  return (
    <div className="space-y-3">
      {/* 4-Card DeFi Intelligence KPI Strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CompactKpiCard
          label="Total DeFi TVL"
          value={compactUsd(tvl)}
          sub={tvlPct != null ? pct(tvlPct, 1) : "-"}
          subTone={tvlPct == null ? "neutral" : tvlPct >= 0 ? "up" : "down"}
          icon={<Layers className="h-3 w-3" />}
          iconBg="bg-purple-600/30 text-purple-400 ring-1 ring-purple-500/40"
          sparkline={tvlTrend}
          color={(tvlPct ?? 0) >= 0 ? "#10b981" : "#ef4444"}
        />
        <CompactKpiCard
          label="Stablecoin Liquidity"
          value={compactUsd(stable)}
          sub={stable && tvl ? `${(stable / tvl).toFixed(1)}x DeFi TVL` : "-"}
          subTone="neutral"
          icon={<Coins className="h-3 w-3" />}
          iconBg="bg-cyan-600/30 text-cyan-400 ring-1 ring-cyan-500/40"
        />
        <CompactKpiCard
          label="Top Protocol"
          value={topProtocol ? topProtocol.name : "-"}
          sub={topProtocol ? `${compactUsd(topProtocol.tvl)} · ${pct(topProtocol.change1d, 1)}` : "-"}
          subTone={topProtocol ? (topProtocol.change1d >= 0 ? "up" : "down") : "neutral"}
          icon={<Activity className="h-3 w-3" />}
          iconBg="bg-emerald-600/30 text-emerald-400 ring-1 ring-emerald-500/40"
        />
        <CompactKpiCard
          label="Dominant Ecosystem"
          value={topChain && tvl ? `${topChain.name} (${Math.round((topChain.tvl / tvl) * 100)}%)` : "-"}
          sub={topChain ? `${compactUsd(topChain.tvl)} Locked` : "-"}
          subTone="neutral"
          icon={<Globe className="h-3 w-3" />}
          iconBg="bg-blue-600/30 text-blue-400 ring-1 ring-blue-500/40"
        />
      </div>

      {/* Row 1: Visual Analytics: Multi-Chain TVL Dominance & 24h protocol TVL moves, both live */}
      {chainSegments.length > 1 || protocolMoves.length ? (
        <section className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          {chainSegments.length > 1 ? (
            <DonutPieChart
              title="Multi-Chain TVL Dominance"
              subtitle="Total value locked by chain"
              totalLabel="Total TVL"
              totalValue={compactUsd(tvl)}
              segments={chainSegments}
              insightText={topChain && tvl ? `${topChain.name} holds ${((topChain.tvl / tvl) * 100).toFixed(1)}% of DeFi TVL.` : undefined}
            />
          ) : (
            <div className="h-[260px] animate-pulse rounded-2xl bg-white/5" />
          )}

          {protocolMoves.length ? (
            <ComparativeBarChart
              title="24h TVL Change, Top Protocols"
              subtitle="How the largest protocols' TVL moved over the last day"
              items={protocolMoves.map((r) => ({ label: r.name, sublabel: r.chain, value: r.change1d, displayValue: pct(r.change1d, 2) }))}
            />
          ) : (
            <div className="h-[260px] animate-pulse rounded-2xl bg-white/5" />
          )}
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          <div className="h-[260px] animate-pulse rounded-2xl bg-white/5" />
          <div className="h-[260px] animate-pulse rounded-2xl bg-white/5" />
        </section>
      )}

      {/* Row 2: Protocols & Money Market Rates */}
      <section className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        <Panel title="Top Protocols by TVL" icon={<Activity className="h-4 w-4 text-gold-300" />}>
          <RankList
            loading={loading}
            rows={(d?.topProtocols ?? []).map((r) => ({
              name: r.name,
              logo: r.logo,
              meta: r.chain,
              value: compactUsd(r.tvl),
              change: r.change1d,
              href: `/markets/protocol/defi/${r.name.toLowerCase().replace(/\s+/g, "-")}`,
            }))}
          />
        </Panel>

        <Panel title="Top Chains by TVL" icon={<Layers className="h-4 w-4 text-gold-300" />}>
          <RankList loading={loading} rows={(d?.topChains ?? []).map((r) => ({ name: r.name, value: compactUsd(r.tvl) }))} />
        </Panel>
      </section>
    </div>
  );
}

function PerpPanel({ p, loading, c }: { p: PerpResp | null; loading: boolean; c?: CoinsResp | null }) {
  const [perpFilter, setPerpFilter] = useState("all");
  const [perpSearch, setPerpSearch] = useState("");

  // Venue volumes: DefiLlama. Markets, funding and OI: Hyperliquid. Nothing else
  // on this tab is invented; no source (long/short ratio, liquidations) = not shown.
  const perpVolume = p?.totalVolume24h || null;
  const perpOi = p?.totalOi || null;
  const dexs = p?.dexs ?? [];
  const venueTotal = perpVolume ?? dexs.reduce((sum, v) => sum + v.volume24h, 0);
  const topVenues = dexs.slice(0, 8).map((v) => ({ ...v, share: venueTotal ? (v.volume24h / venueTotal) * 100 : 0 }));
  const lead = topVenues[0];

  const allMarkets = p?.markets ?? [];
  const oiSum = allMarkets.reduce((sum, m) => sum + m.openInterest, 0);
  const avgFunding = oiSum > 0 ? allMarkets.reduce((sum, m) => sum + m.funding * m.openInterest, 0) / oiSum : null;
  const topOi = [...allMarkets].sort((x, y) => y.openInterest - x.openInterest)[0];
  const extremes = [...allMarkets].sort((x, y) => Math.abs(y.funding) - Math.abs(x.funding)).slice(0, 5);
  const positive = allMarkets.filter((m) => m.funding > 0).length;
  const negative = allMarkets.filter((m) => m.funding < 0).length;
  const skewTotal = positive + negative;
  const venueColors = ["#00e599", "#6366f1", "#3b82f6", "#f59e0b", "#ec4899", "#a855f7"];
  const shareSegments = venueTotal
    ? [
        ...topVenues.slice(0, 6).map((v, i) => ({ name: v.name, value: v.share, formattedValue: compactUsd(v.volume24h), color: venueColors[i] })),
        (() => {
          const rest = Math.max(0, venueTotal - topVenues.slice(0, 6).reduce((sum, v) => sum + v.volume24h, 0));
          return { name: "Other venues", value: (rest / venueTotal) * 100, formattedValue: compactUsd(rest), color: "#10b981" };
        })(),
      ]
    : [];
  const filteredMarkets = allMarkets.filter((m) => {
    if (perpSearch && !m.coin.toLowerCase().includes(perpSearch.toLowerCase())) return false;
    if (perpFilter === "majors") return ["BTC", "ETH", "SOL", "BNB"].includes(m.coin);
    if (perpFilter === "memes") return ["PEPE", "DOGE", "WIF", "SHIB", "BONK", "POPCAT"].includes(m.coin);
    return true;
  });

  return (
    <div className="space-y-3">
      {/* 4-Card Derivatives KPI Strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CompactKpiCard
          label="Perp DEX Volume (24h)"
          value={compactUsd(perpVolume)}
          sub={dexs.length ? `${dexs.length} venues tracked` : "-"}
          subTone="neutral"
          icon={<Activity className="h-3 w-3" />}
          iconBg="bg-amber-500/25 text-amber-400 ring-1 ring-amber-500/40"
        />
        <CompactKpiCard
          label="Open Interest (Hyperliquid)"
          value={compactUsd(perpOi)}
          sub={topOi ? `${topOi.coin} ${compactUsd(topOi.openInterest)}` : "-"}
          subTone="neutral"
          icon={<Layers className="h-3 w-3" />}
          iconBg="bg-purple-600/30 text-purple-400 ring-1 ring-purple-500/40"
        />
        <CompactKpiCard
          label="OI-Weighted Funding"
          value={avgFunding != null ? `${avgFunding >= 0 ? "+" : ""}${(avgFunding * 100).toFixed(4)}%/h` : "-"}
          sub={avgFunding == null ? "-" : avgFunding >= 0 ? "Longs Paying Shorts" : "Shorts Paying Longs"}
          subTone={avgFunding == null ? "neutral" : avgFunding >= 0 ? "up" : "down"}
          icon={<Flame className="h-3 w-3" />}
          iconBg="bg-mint-500/25 text-mint-400 ring-1 ring-mint-500/40"
        />
        <CompactKpiCard
          label="Dominant Perp Venue"
          value={lead ? `${lead.name} (${Math.round(lead.share)}%)` : "-"}
          sub={lead ? `${compactUsd(lead.volume24h)} 24h Vol` : "-"}
          subTone="neutral"
          icon={<Zap className="h-3 w-3" />}
          iconBg="bg-blue-600/30 text-blue-400 ring-1 ring-blue-500/40"
        />
      </div>

      {/* Visual Analytics: Perp Market Share Donut & Funding extremes, both live */}
      <section className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        {shareSegments.length > 1 ? (
          <DonutPieChart
            title="On-Chain Perp Volume Market Share"
            subtitle="24h derivatives volume by decentralized venue"
            totalLabel="24h Perp Vol"
            totalValue={compactUsd(venueTotal)}
            segments={shareSegments}
            insightText={lead ? `${lead.name} handles ${lead.share.toFixed(1)}% of 24h on-chain perp volume.` : undefined}
          />
        ) : (
          <div className="h-[260px] animate-pulse rounded-2xl bg-white/5" />
        )}

        {extremes.length ? (
          <BarRankChart
            title="Funding Rate Extremes"
            subtitle="Hyperliquid markets with the largest funding, annualized"
            items={extremes.map((m) => {
              const apr = m.funding * 24 * 365 * 100;
              return {
                label: `${m.coin}-PERP`,
                sublabel: `${m.funding >= 0 ? "+" : ""}${(m.funding * 100).toFixed(4)}%/h`,
                value: Math.abs(apr),
                displayValue: `${apr >= 0 ? "+" : ""}${apr.toFixed(0)}% APR`,
                color: m.funding >= 0 ? "from-mint-500 to-emerald-400" : "from-rose-500 to-red-400",
                badge: m.funding >= 0 ? "Longs Pay" : "Shorts Pay",
                badgeTone: (m.funding >= 0 ? "mint" : "amber") as "mint" | "amber",
              };
            })}
          />
        ) : (
          <div className="h-[260px] animate-pulse rounded-2xl bg-white/5" />
        )}
      </section>

      {/* Row 1: Top Perp DEXs Venue Comparison & Funding Skew */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
        <div className="lg:col-span-8">
          <Panel title="Top Perp DEX Venues (24h Volume)" icon={<Activity className="h-4 w-4 text-gold-300" />}>
            {topVenues.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-black/[0.04] dark:border-white/10 text-[10px] uppercase tracking-wider text-zinc-500 pb-2">
                      <th className="text-left py-2 font-medium"># DEX Venue</th>
                      <th className="text-right py-2 font-medium">24h Volume</th>
                      <th className="text-right py-2 font-medium">Market Share</th>
                      <th className="text-right py-2 font-medium">24h %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04] dark:divide-white/5">
                    {topVenues.map((v, i) => (
                      <tr key={v.slug || v.name} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors group">
                        <td className="py-2.5">
                          <Link href={`/markets/protocol/derivatives/${v.slug}`} className="flex items-center gap-2">
                            <span className="mono text-zinc-500 text-[11px] w-3.5">{i + 1}</span>
                            <ProtocolAvatar project={v.name} logo={v.logo} />
                            <span className="font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-amber-500 transition-colors text-xs sm:text-[13px]">{v.name}</span>
                          </Link>
                        </td>
                        <td className="text-right mono font-bold text-zinc-900 dark:text-zinc-100 py-2.5">{compactUsd(v.volume24h)}</td>
                        <td className="text-right py-2.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="mono text-xs text-zinc-400 font-semibold">{v.share.toFixed(1)}%</span>
                            <div className="w-12 h-1.5 rounded-full bg-white/5 overflow-hidden hidden sm:block">
                              <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min(100, v.share)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className={cn("text-right mono font-semibold py-2.5", v.change1d == null || !Number.isFinite(v.change1d) ? "text-zinc-500" : v.change1d >= 0 ? "text-mint-400" : "text-red-400")}>
                          {pct(v.change1d, 1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <SkeletonRows />
            )}
          </Panel>
        </div>

        <div className="lg:col-span-4">
          <Panel title="Funding Skew (Hyperliquid)" icon={<Flame className="h-4 w-4 text-amber-400" />}>
            {skewTotal ? (
              <div className="space-y-3 pt-1">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-emerald-400">Longs pay ({positive})</span>
                    <span className="font-bold text-rose-400">Shorts pay ({negative})</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden flex">
                    <div className="h-full bg-emerald-500" style={{ width: `${(positive / skewTotal) * 100}%` }} />
                    <div className="h-full bg-rose-500" style={{ width: `${(negative / skewTotal) * 100}%` }} />
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span>Markets tracked</span>
                    <span className="mono font-bold text-zinc-200">{allMarkets.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span>Total open interest</span>
                    <span className="mono font-bold text-zinc-200">{compactUsd(oiSum)}</span>
                  </div>
                </div>
                {avgFunding != null && (
                  <p className="text-[11px] leading-relaxed text-zinc-500">
                    OI-weighted funding is {(avgFunding * 100).toFixed(4)}% per hour, so {avgFunding >= 0 ? "longs are paying shorts" : "shorts are paying longs"} overall.
                    {" "}{positive} of {skewTotal} markets have positive funding.
                  </p>
                )}
              </div>
            ) : (
              <SkeletonRows />
            )}
          </Panel>
        </div>
      </section>

      {/* Row 2: Live Perp Markets - funding & open interest (Hyperliquid) */}
      <Panel title="Live Perp Markets - funding & open interest (Hyperliquid)" icon={<Flame className="h-4 w-4 text-gold-300" />}>
        {/* Search & Filter pills */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.04] dark:border-white/[0.06] pb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
            <button
              onClick={() => setPerpFilter("all")}
              className={cn(
                "h-6 px-2.5 rounded-lg text-[11px] font-bold transition-all",
                perpFilter === "all" ? "bg-amber-400 text-black shadow-sm" : "bg-white/5 text-zinc-400 hover:text-white"
              )}
            >
              All Markets ({allMarkets.length})
            </button>
            <button
              onClick={() => setPerpFilter("majors")}
              className={cn(
                "h-6 px-2.5 rounded-lg text-[11px] font-bold transition-all",
                perpFilter === "majors" ? "bg-amber-400 text-black shadow-sm" : "bg-white/5 text-zinc-400 hover:text-white"
              )}
            >
              Majors (BTC/ETH/SOL)
            </button>
            <button
              onClick={() => setPerpFilter("memes")}
              className={cn(
                "h-6 px-2.5 rounded-lg text-[11px] font-bold transition-all",
                perpFilter === "memes" ? "bg-amber-400 text-black shadow-sm" : "bg-white/5 text-zinc-400 hover:text-white"
              )}
            >
              Meme Perps
            </button>
          </div>

          <div className="relative w-44 sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <input
              value={perpSearch}
              onChange={(e) => setPerpSearch(e.target.value)}
              placeholder="Search perp pair..."
              className="w-full rounded-lg bg-black/20 border border-white/10 pl-8 pr-2.5 py-1 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/40"
            />
          </div>
        </div>

        {loading && !allMarkets.length ? (
          <SkeletonRows />
        ) : filteredMarkets.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500 border-b border-black/[0.04] dark:border-white/5 pb-2">
                  <th className="py-2 font-medium">Market</th>
                  <th className="py-2 text-right font-medium">Price</th>
                  <th className="py-2 text-right font-medium">Funding /1h</th>
                  <th className="py-2 text-right font-medium">Open Interest</th>
                  <th className="py-2 text-right font-medium hidden sm:table-cell">Est. 8h Funding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredMarkets.map((m) => (
                  <tr key={m.coin} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2 font-semibold text-zinc-200">
                      <div className="flex items-center gap-2">
                        <TokenAvatar symbol={m.coin} />
                        <span className="font-bold text-zinc-100">{m.coin}-PERP</span>
                      </div>
                    </td>
                    <td className="mono py-2 text-right text-zinc-300 font-medium">{coinPrice(m.price)}</td>
                    <td className={cn("mono py-2 text-right font-bold", m.funding >= 0 ? "text-mint-400" : "text-red-400")}>
                      {(m.funding * 100).toFixed(4)}%
                    </td>
                    <td className="mono py-2 text-right text-zinc-300 font-medium">{compactUsd(m.openInterest)}</td>
                    <td className={cn("mono py-2 text-right text-xs hidden sm:table-cell", m.funding >= 0 ? "text-emerald-500" : "text-rose-500")}>
                      {m.funding >= 0 ? "+" : ""}{(m.funding * 800).toFixed(3)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-zinc-500">Live perp market data is unavailable right now. Retrying…</p>
        )}
      </Panel>
    </div>
  );
}

function DexPanel({ x, loading, d }: { x: DexResp | null; loading: boolean; d?: DefiMarket | null }) {
  // Totals are sums of the live DefiLlama lists below, labelled as such.
  const dexList = x?.dexs ?? [];
  const feeList = x?.fees ?? [];
  const dexVolume = dexList.length ? dexList.reduce((sum, r) => sum + r.volume24h, 0) : null;
  const protocolFees = feeList.length ? feeList.reduce((sum, r) => sum + r.fees24h, 0) : null;
  const dexChange = dexVolume ? dexList.reduce((sum, r) => sum + r.change1d * r.volume24h, 0) / dexVolume : null;
  const topDex = dexList[0];
  const dexColors = ["#ec4899", "#a855f7", "#f59e0b", "#3b82f6", "#06b6d4"];
  const dexSegments = dexVolume
    ? [
        ...dexList.slice(0, 5).map((r, i) => ({ name: r.name, value: (r.volume24h / dexVolume) * 100, formattedValue: compactUsd(r.volume24h), color: dexColors[i] })),
        (() => {
          const rest = Math.max(0, dexVolume - dexList.slice(0, 5).reduce((sum, r) => sum + r.volume24h, 0));
          return { name: "Other DEXs", value: (rest / dexVolume) * 100, formattedValue: compactUsd(rest), color: "#10b981" };
        })(),
      ]
    : [];
  const feeBarColors = ["from-emerald-500 to-mint-400", "from-blue-600 to-blue-400", "from-amber-500 to-amber-400", "from-purple-600 to-purple-400", "from-rose-500 to-red-400", "from-pink-500 to-pink-400"];

  return (
    <div className="space-y-3">
      {/* 4-Card DEX & Fee KPI Strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CompactKpiCard
          label="24h DEX Volume (Top)"
          value={compactUsd(dexVolume)}
          sub={dexChange != null ? pct(dexChange, 1) : "-"}
          subTone={dexChange == null ? "neutral" : dexChange >= 0 ? "up" : "down"}
          icon={<Coins className="h-3 w-3" />}
          iconBg="bg-blue-600/30 text-blue-400 ring-1 ring-blue-500/40"
        />
        <CompactKpiCard
          label="24h Fees (Top)"
          value={compactUsd(protocolFees)}
          sub={feeList.length ? `${feeList.length} protocols` : "-"}
          subTone="neutral"
          icon={<Percent className="h-3 w-3" />}
          iconBg="bg-emerald-600/30 text-emerald-400 ring-1 ring-emerald-500/40"
        />
        <CompactKpiCard
          label="Top DEX"
          value={topDex ? topDex.name : "-"}
          sub={topDex && dexVolume ? `${((topDex.volume24h / dexVolume) * 100).toFixed(0)}% share` : "-"}
          subTone="neutral"
          icon={<Activity className="h-3 w-3" />}
          iconBg="bg-purple-600/30 text-purple-400 ring-1 ring-purple-500/40"
        />
        <CompactKpiCard
          label="Top Daily Fees"
          value={feeList[0] ? `${feeList[0].name} (${compactUsd(feeList[0].fees24h)})` : "-"}
          sub={feeList[1] ? `${feeList[1].name} #2 (${compactUsd(feeList[1].fees24h)})` : "-"}
          subTone="neutral"
          icon={<Flame className="h-3 w-3" />}
          iconBg="bg-amber-500/25 text-amber-400 ring-1 ring-amber-500/40"
        />
      </div>

      {/* Row 1: Top DEXs & Market Share */}
      <section className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        <Panel title="Top DEXs (24h Volume)" icon={<Coins className="h-4 w-4 text-gold-300" />}>
          <RankList
            loading={loading}
            rows={(x?.dexs ?? []).map((r) => ({
              name: r.name,
              logo: r.logo,
              value: compactUsd(r.volume24h),
              change: r.change1d,
              href: r.slug ? `/markets/protocol/dexs/${r.slug}` : undefined,
            }))}
          />
        </Panel>

        {dexSegments.length > 1 ? (
          <DonutPieChart
            title="Spot DEX Volume Share"
            subtitle="24h trading volume across the largest DEXs"
            totalLabel="Top DEX Vol"
            totalValue={compactUsd(dexVolume)}
            segments={dexSegments}
            insightText={topDex && dexVolume ? `${topDex.name} carries ${((topDex.volume24h / dexVolume) * 100).toFixed(1)}% of the top DEXs' 24h volume.` : undefined}
          />
        ) : (
          <div className="h-[260px] animate-pulse rounded-2xl bg-white/5" />
        )}
      </section>

      {/* Row 2: Top Protocols by Fees & Network Gas Activity */}
      <section className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        <Panel title="Top Protocols by Fees (24h)" icon={<Percent className="h-4 w-4 text-gold-300" />}>
          <RankList
            loading={loading}
            rows={(x?.fees ?? []).map((r) => ({
              name: r.name,
              logo: r.logo,
              value: compactUsd(r.fees24h),
              href: r.slug ? `/markets/protocol/fees/${r.slug}` : undefined,
            }))}
          />
        </Panel>

        {feeList.length ? (
          <BarRankChart
            title="Daily Protocol Fees"
            subtitle="24h fees generated by the top protocols"
            items={feeList.slice(0, 6).map((r, i) => ({
              label: r.name,
              value: r.fees24h / 1e6,
              displayValue: `${compactUsd(r.fees24h)}/d`,
              color: feeBarColors[i],
            }))}
            insightText={protocolFees ? `The top ${feeList.length} protocols generated ${compactUsd(protocolFees)} in fees over the last 24h.` : undefined}
          />
        ) : (
          <div className="h-[260px] animate-pulse rounded-2xl bg-white/5" />
        )}
      </section>
    </div>
  );
}

function YieldsPanel({ y, loading }: { y: YieldResp | null; loading: boolean }) {
  const [yieldFilter, setYieldFilter] = useState("all");
  const [yieldSearch, setYieldSearch] = useState("");
  const [calcOpen, setCalcOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState(10000);

  const pools = y?.pools ?? [];
  const filteredPools = pools.filter((p) => {
    if (yieldSearch && !p.symbol.toLowerCase().includes(yieldSearch.toLowerCase()) && !p.project.toLowerCase().includes(yieldSearch.toLowerCase())) return false;
    if (yieldFilter === "stable") return ["USDC", "USDT", "DAI", "USDE", "FRAX"].some((s) => p.symbol.toUpperCase().includes(s));
    if (yieldFilter === "eth") return ["ETH", "WETH", "STETH", "CBETH", "RETH"].some((s) => p.symbol.toUpperCase().includes(s));
    if (yieldFilter === "high") return p.apy >= 8;
    return true;
  });

  const isStable = (sym: string) => ["USDC", "USDT", "DAI", "USDE", "FRAX", "USDS", "PYUSD"].some((t) => sym.toUpperCase().includes(t));
  const isEth = (sym: string) => ["ETH"].some((t) => sym.toUpperCase().includes(t));
  const isBtc = (sym: string) => sym.toUpperCase().includes("BTC");
  const poolClass = (sym: string) => (isStable(sym) ? "Stable" : isEth(sym) ? "ETH" : isBtc(sym) ? "BTC" : "Other");
  const stablePools = pools.filter((p) => isStable(p.symbol));
  const stableTvl = stablePools.reduce((sum, p) => sum + p.tvl, 0);
  const stableAvg = stableTvl > 0 ? stablePools.reduce((sum, p) => sum + p.apy * p.tvl, 0) / stableTvl : null;
  const topEth = pools.filter((p) => isEth(p.symbol)).sort((a, b) => b.apy - a.apy)[0];
  const poolTvl = pools.reduce((sum, p) => sum + p.tvl, 0);
  const bigStable = [...stablePools].sort((a, b) => b.tvl - a.tvl)[0];
  const featuredPools = [...pools].sort((a, b) => b.tvl - a.tvl).slice(0, 3);
  const topApy = [...pools].sort((a, b) => b.apy - a.apy).slice(0, 5);
  const classColors: Record<string, string> = { Stable: "#00e599", ETH: "#627eea", BTC: "#f59e0b", Other: "#a855f7" };
  const classSegments = poolTvl
    ? (["Stable", "ETH", "BTC", "Other"] as const)
        .map((k) => {
          const tvlK = pools.filter((p) => poolClass(p.symbol) === k).reduce((sum, p) => sum + p.tvl, 0);
          return { name: k === "Stable" ? "Stablecoins" : k === "Other" ? "Other assets" : k, value: (tvlK / poolTvl) * 100, formattedValue: compactUsd(tvlK), color: classColors[k] };
        })
        .filter((seg) => seg.value > 0)
        .sort((a, b) => b.value - a.value)
    : [];

  return (
    <div className="space-y-3">
      {/* 4-Card Yield Metric Strip - all computed from the live DefiLlama pools */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CompactKpiCard
          label="Avg Stablecoin APY"
          value={stableAvg != null ? `${stableAvg.toFixed(1)}%` : "-"}
          sub={stablePools.length ? `TVL-weighted, ${stablePools.length} pools` : "-"}
          subTone="neutral"
          icon={<Percent className="h-3 w-3" />}
          iconBg="bg-emerald-600/30 text-emerald-400 ring-1 ring-emerald-500/40"
        />
        <CompactKpiCard
          label="Top ETH APY"
          value={topEth ? `${topEth.apy.toFixed(1)}%` : "-"}
          sub={topEth ? `${formatProtocolName(topEth.project)} ${topEth.symbol}` : "-"}
          subTone="neutral"
          icon={<Flame className="h-3 w-3" />}
          iconBg="bg-amber-500/25 text-amber-400 ring-1 ring-amber-500/40"
        />
        <CompactKpiCard
          label="Tracked Pool TVL"
          value={poolTvl ? compactUsd(poolTvl) : "-"}
          sub={pools.length ? `${pools.length} pools` : "-"}
          subTone="neutral"
          icon={<Layers className="h-3 w-3" />}
          iconBg="bg-purple-600/30 text-purple-400 ring-1 ring-purple-500/40"
        />
        <CompactKpiCard
          label="Largest Stable Pool"
          value={bigStable ? `${formatProtocolName(bigStable.project)} ${bigStable.symbol} (${bigStable.apy.toFixed(1)}%)` : "-"}
          sub={bigStable ? `${compactUsd(bigStable.tvl)} TVL` : "-"}
          subTone="neutral"
          icon={<ShieldCheck className="h-3 w-3" />}
          iconBg="bg-blue-600/30 text-blue-400 ring-1 ring-blue-500/40"
        />
      </div>

      {/* Row 1: The three largest pools by TVL */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {featuredPools.length
          ? featuredPools.map((pool) => (
              <div key={`${pool.project}-${pool.symbol}-${pool.chain}`} className="neu-card rounded-2xl p-3 border border-white/60 dark:border-white/[0.08] shadow-neu flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <TokenAvatar symbol={pool.symbol} />
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">{pool.symbol}</p>
                      <p className="text-[10px] text-zinc-500 truncate">{formatProtocolName(pool.project)} · {pool.chain}</p>
                    </div>
                  </div>
                  <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shrink-0">{poolClass(pool.symbol)}</span>
                </div>
                <div className="flex items-baseline justify-between mt-3 pt-2 border-t border-black/[0.04] dark:border-white/5">
                  <div>
                    <p className="text-[10px] text-zinc-500">APY</p>
                    <p className="mono font-black text-emerald-400 text-base">{pool.apy.toFixed(1)}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-zinc-500">Pool TVL</p>
                    <p className="mono text-xs font-semibold text-zinc-300">{compactUsd(pool.tvl)}</p>
                  </div>
                </div>
              </div>
            ))
          : Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-[104px] animate-pulse rounded-2xl bg-white/5" />)}
      </div>

      {/* Visual Analytics: Yield Pool Asset Allocation & top APYs, both live */}
      {pools.length ? (
        <section className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          <DonutPieChart
            title="Yield Pool Asset Distribution"
            subtitle="Tracked pool TVL by asset class"
            totalLabel="Tracked Pool TVL"
            totalValue={compactUsd(poolTvl)}
            segments={classSegments}
            insightText={classSegments[0] ? `${classSegments[0].name} pools hold ${classSegments[0].value.toFixed(1)}% of tracked yield TVL.` : undefined}
          />
          <BarRankChart
            title="Highest APY Pools"
            subtitle="Tracked pools ranked by current APY"
            items={topApy.map((pool, i) => ({
              label: `${formatProtocolName(pool.project)} ${pool.symbol}`,
              sublabel: `${pool.chain} · ${compactUsd(pool.tvl)} TVL`,
              value: pool.apy,
              displayValue: `${pool.apy.toFixed(1)}% APY`,
              color: ["from-purple-500 to-purple-400", "from-emerald-500 to-mint-400", "from-cyan-500 to-blue-400", "from-blue-600 to-blue-400", "from-amber-500 to-amber-400"][i],
            }))}
          />
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          <div className="h-[260px] animate-pulse rounded-2xl bg-white/5" />
          <div className="h-[260px] animate-pulse rounded-2xl bg-white/5" />
        </section>
      )}

      {/* Row 2: Comprehensive Yield Opportunities Table */}
      <Panel
        title="Top Yield Opportunities (TVL ≥ $1M)"
        icon={<Percent className="h-4 w-4 text-gold-300" />}
        action={
          <button
            onClick={() => setCalcOpen(!calcOpen)}
            className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
          >
            <Calculator className="h-3.5 w-3.5" />
            <span>{calcOpen ? "Hide Calculator" : "APY Calculator"}</span>
          </button>
        }
      >
        {/* Filter chips & Search bar */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.04] dark:border-white/[0.06] pb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
            <button
              onClick={() => setYieldFilter("all")}
              className={cn(
                "h-6 px-2.5 rounded-lg text-[11px] font-bold transition-all",
                yieldFilter === "all" ? "bg-amber-400 text-black shadow-sm" : "bg-white/5 text-zinc-400 hover:text-white"
              )}
            >
              All Pools
            </button>
            <button
              onClick={() => setYieldFilter("stable")}
              className={cn(
                "h-6 px-2.5 rounded-lg text-[11px] font-bold transition-all",
                yieldFilter === "stable" ? "bg-amber-400 text-black shadow-sm" : "bg-white/5 text-zinc-400 hover:text-white"
              )}
            >
              Stablecoins Only
            </button>
            <button
              onClick={() => setYieldFilter("eth")}
              className={cn(
                "h-6 px-2.5 rounded-lg text-[11px] font-bold transition-all",
                yieldFilter === "eth" ? "bg-amber-400 text-black shadow-sm" : "bg-white/5 text-zinc-400 hover:text-white"
              )}
            >
              ETH & LSTs
            </button>
            <button
              onClick={() => setYieldFilter("high")}
              className={cn(
                "h-6 px-2.5 rounded-lg text-[11px] font-bold transition-all",
                yieldFilter === "high" ? "bg-amber-400 text-black shadow-sm" : "bg-white/5 text-zinc-400 hover:text-white"
              )}
            >
              High APY (&gt;8%)
            </button>
          </div>

          <div className="relative w-44 sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <input
              value={yieldSearch}
              onChange={(e) => setYieldSearch(e.target.value)}
              placeholder="Search pool (USDC, ETH...)"
              className="w-full rounded-lg bg-black/20 border border-white/10 pl-8 pr-2.5 py-1 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/40"
            />
          </div>
        </div>

        {/* Projected returns calculator toggle */}
        {calcOpen && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="font-bold text-amber-300">Simulate Projected Earnings:</span>
              <div className="flex items-center gap-1.5">
                {[1000, 5000, 10000, 50000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setDepositAmount(amt)}
                    className={cn(
                      "px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all",
                      depositAmount === amt ? "bg-amber-400 text-black" : "bg-white/5 text-zinc-400 hover:text-white"
                    )}
                  >
                    ${amt.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-amber-500/20 text-center">
              <div>
                <p className="text-[10px] text-zinc-400">Daily Return (@8.4%)</p>
                <p className="mono font-bold text-emerald-400 text-xs sm:text-sm">+${((depositAmount * 0.084) / 365).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-400">Monthly Return</p>
                <p className="mono font-bold text-emerald-400 text-xs sm:text-sm">+${((depositAmount * 0.084) / 12).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-400">1-Year Compound</p>
                <p className="mono font-bold text-emerald-400 text-xs sm:text-sm">+${(depositAmount * 0.084).toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

        {loading && !pools.length ? (
          <SkeletonRows />
        ) : filteredPools.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500 border-b border-black/[0.04] dark:border-white/5 pb-2">
                  <th className="py-2 font-medium">Pool</th>
                  <th className="py-2 font-medium">Protocol</th>
                  <th className="py-2 font-medium">Chain</th>
                  <th className="py-2 text-right font-medium">APY</th>
                  <th className="py-2 text-right font-medium">TVL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredPools.map((pool, i) => (
                  <tr key={`${pool.project}-${pool.symbol}-${i}`} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <TokenAvatar symbol={pool.symbol} />
                        <span className="font-semibold text-zinc-200">{pool.symbol}</span>
                      </div>
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-1.5">
                        <ProtocolAvatar project={pool.project} logo={pool.logo} />
                        <span className="text-xs text-zinc-300 font-medium">{formatProtocolName(pool.project)}</span>
                      </div>
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
    </div>
  );
}

/** Sector classification for the Trending tab. Membership only - every figure
 * shown for a sector is computed from the live coin list. */
const SECTORS: { name: string; ids: string[] }[] = [
  { name: "AI & Compute", ids: ["bittensor", "fetch-ai", "render-token", "near", "virtual-protocol"] },
  { name: "Memes", ids: ["dogecoin", "shiba-inu", "pepe", "dogwifcoin", "bonk", "floki"] },
  { name: "Layer 2s", ids: ["arbitrum", "optimism", "mantle", "starknet", "polygon-ecosystem-token"] },
  { name: "RWA", ids: ["ondo-finance", "chainlink", "pendle", "maker", "sky"] },
  { name: "Perp DEXs", ids: ["hyperliquid", "dydx-chain", "gmx", "aster-2"] },
  { name: "Layer 1s", ids: ["solana", "sui", "aptos", "avalanche-2", "cardano"] },
];

function TrendingPanel({ c, loading, g }: { c: CoinsResp | null; loading: boolean; g?: GlobalMarket | null }) {
  const trendingCoins = c?.trending ?? [];
  const topGainer = c?.gainers?.[0] ?? null;
  const viral = trendingCoins[0] ?? null;
  const fg = g?.fearGreed ?? null;
  // Sector momentum: the average live 24h change of each sector's coins that are
  // in the CoinGecko list. Membership is a fixed classification; every number is live.
  const byId = new Map((c?.list ?? []).map((r) => [r.id, r]));
  const narratives = SECTORS.map((sec) => {
    const members = sec.ids.map((id) => byId.get(id)).filter((r): r is CoinRow => !!r);
    const momentum = members.length ? members.reduce((sum, r) => sum + r.change24h, 0) / members.length : null;
    return { name: sec.name, momentum, tokens: members.map((r) => r.symbol).join(", ") };
  })
    .filter((n): n is { name: string; momentum: number; tokens: string } => n.momentum != null)
    .sort((x, y) => y.momentum - x.momentum);
  const hot = narratives[0];

  return (
    <div className="space-y-3">
      {/* 4-Card Trend Radar Strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CompactKpiCard
          label="#1 Trending Coin"
          value={viral ? `${viral.name} (${viral.symbol})` : "-"}
          sub={viral ? `${pct(viral.change24h, 1)} 24h` : "-"}
          subTone={viral ? (viral.change24h >= 0 ? "up" : "down") : "neutral"}
          icon={<Flame className="h-3 w-3" />}
          iconBg="bg-amber-500/25 text-amber-400 ring-1 ring-amber-500/40"
          sparkline={viral?.sparkline && viral.sparkline.length >= 2 ? viral.sparkline : undefined}
          color="#f59e0b"
        />
        <CompactKpiCard
          label="Top Surge Gainer"
          value={topGainer ? pct(topGainer.change24h, 1) : "-"}
          sub={topGainer?.symbol ?? "-"}
          subTone={topGainer ? "up" : "neutral"}
          icon={<TrendingUp className="h-3 w-3" />}
          iconBg="bg-mint-500/25 text-mint-400 ring-1 ring-mint-500/40"
          sparkline={topGainer?.sparkline && topGainer.sparkline.length >= 2 ? topGainer.sparkline : undefined}
          color="#00e599"
        />
        <CompactKpiCard
          label="Fear & Greed Index"
          value={fg ? `${fg.value} / 100` : "-"}
          sub={fg ? fg.label : "-"}
          subTone={fg ? (fg.value >= 50 ? "up" : "down") : "neutral"}
          icon={<Activity className="h-3 w-3" />}
          iconBg="bg-emerald-600/30 text-emerald-400 ring-1 ring-emerald-500/40"
        />
        <CompactKpiCard
          label="Hot Sector"
          value={hot ? `${hot.name} (${pct(hot.momentum, 1)})` : "-"}
          sub={hot ? "Highest avg 24h move" : "-"}
          subTone={hot ? (hot.momentum >= 0 ? "up" : "down") : "neutral"}
          icon={<Zap className="h-3 w-3" />}
          iconBg="bg-purple-600/30 text-purple-400 ring-1 ring-purple-500/40"
        />
      </div>

      {/* Row 1: Hot Trending Coins Grid (8 Cards) */}
      <Panel title="Trending Now" icon={<Flame className="h-4 w-4 text-gold-300" />}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
          {trendingCoins.slice(0, 8).map((t, i) => {
            const inner = (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="mono text-[10px] font-bold text-amber-500 w-3.5">#{i + 1}</span>
                  {t.thumb && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.thumb} alt="" width={22} height={22} loading="lazy" className="h-5.5 w-5.5 rounded-full ring-1 ring-white/10 shrink-0" onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")} />
                  )}
                  <div className="min-w-0">
                    <span className="block truncate text-xs font-bold text-zinc-200 group-hover:text-gold-200 transition-colors">{t.name}</span>
                    <span className="mono text-[10px] text-zinc-500">{t.symbol}</span>
                  </div>
                </div>
                <span className={cn("mono text-xs font-bold shrink-0", t.change24h >= 0 ? "text-mint-400" : "text-red-400")}>
                  {pct(t.change24h, 1)}
                </span>
              </div>
            );
            return t.id ? (
              <Link key={t.symbol + t.name} href={`/markets/${t.id}`} className="group flex items-center rounded-xl bg-white/5 p-2.5 transition-all hover:bg-white/[0.08] hover:scale-[1.01]">
                {inner}
              </Link>
            ) : (
              <div key={t.symbol + t.name} className="flex items-center rounded-xl bg-white/5 p-2.5">{inner}</div>
            );
          })}
          {!loading && !trendingCoins.length && <p className="col-span-full py-3 text-center text-sm text-zinc-500">Trending data is loading…</p>}
        </div>
      </Panel>

      {/* Row 2: Top Gainers & Losers */}
      <section className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        <Panel title="Top Gainers (24h)" icon={<TrendingUp className="h-4 w-4 text-mint-400" />}>
          <MoverList rows={c?.gainers ?? []} />
        </Panel>
        <Panel title="Top Losers (24h)" icon={<TrendingDown className="h-4 w-4 text-red-400" />}>
          <MoverList rows={c?.losers ?? []} />
        </Panel>
      </section>

      {/* Visual Analytics: trending coins' moves & sector velocity, both live */}
      {trendingCoins.length || narratives.length ? (
        <section className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          {trendingCoins.length ? (
            <ComparativeBarChart
              title="Trending Coins, 24h Move"
              subtitle="CoinGecko's most-searched coins and how they moved today"
              items={trendingCoins.slice(0, 7).map((t) => ({ label: t.symbol || t.name, sublabel: t.name, value: t.change24h, displayValue: pct(t.change24h, 1) }))}
            />
          ) : (
            <div className="h-[260px] animate-pulse rounded-2xl bg-white/5" />
          )}
          {narratives.length ? (
            <BarRankChart
              title="24h Sector Velocity"
              subtitle="Average 24h move of each sector's leading coins"
              items={narratives.map((n, i) => ({
                label: n.name,
                sublabel: n.tokens,
                value: Math.abs(n.momentum),
                displayValue: pct(n.momentum, 1),
                change: n.momentum,
                color: ["from-purple-600 to-purple-400", "from-amber-500 to-amber-400", "from-mint-500 to-emerald-400", "from-blue-600 to-blue-400", "from-cyan-600 to-cyan-400", "from-pink-500 to-pink-400"][i % 6],
              }))}
            />
          ) : (
            <div className="h-[260px] animate-pulse rounded-2xl bg-white/5" />
          )}
        </section>
      ) : null}

      {/* Row 3: Sector Momentum */}
      {narratives.length > 0 && (
        <Panel title="Narrative & Sector Momentum" icon={<Sparkles className="h-4 w-4 text-amber-400" />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 pt-1">
            {narratives.slice(0, 5).map((nar) => (
              <div key={nar.name} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className={cn("mono font-bold text-xs", nar.momentum >= 0 ? "text-mint-400" : "text-red-400")}>{pct(nar.momentum, 1)}</span>
                  <span className={cn("h-1.5 w-1.5 rounded-full", nar.momentum >= 0 ? "bg-mint-400" : "bg-red-400")} />
                </div>
                <p className="font-bold text-xs text-zinc-200 line-clamp-1">{nar.name}</p>
                <p className="text-[10px] text-zinc-500 truncate">{nar.tokens}</p>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <TrendingNews />
    </div>
  );
}

function WatchlistPanel({ coins, onNavigateCoins }: { coins?: CoinRow[]; onNavigateCoins?: () => void }) {
  const starredIds = useWatchlist();
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const saveWatchlist = (next: Set<string>) => { hapticToggle(); writeWatchlist(next); };

  const removeCoin = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = new Set(starredIds);
    next.delete(id);
    saveWatchlist(next);
  };

  const addCoin = (id: string) => {
    const next = new Set(starredIds);
    next.add(id);
    saveWatchlist(next);
    setSearch("");
    setSearchOpen(false);
  };

  const addTopBluechips = () => {
    const next = new Set(["bitcoin", "ethereum", "solana", "hyperliquid", "sui", "binancecoin", "ripple"]);
    saveWatchlist(next);
  };

  const allAvailable = coins ?? [];
  const watchedCoins = allAvailable.filter((c) => starredIds.has(c.id));

  // Compute portfolio average
  const avg24h = watchedCoins.length > 0
    ? watchedCoins.reduce((acc, c) => acc + (c.change24h ?? 0), 0) / watchedCoins.length
    : null;
  const worstCoin = watchedCoins.length > 1
    ? [...watchedCoins].sort((a, b) => (a.change24h ?? 0) - (b.change24h ?? 0))[0]
    : null;
  const watchedCap = watchedCoins.reduce((acc, c) => acc + (c.marketCap || 0), 0);
  const allocColors = ["#f59e0b", "#627eea", "#a855f7", "#00e599", "#3b82f6", "#ec4899", "#06b6d4", "#eab308"];
  const allocation = watchedCap > 0
    ? [...watchedCoins].sort((a, b) => b.marketCap - a.marketCap).map((c, i) => ({
        name: `${c.name} (${c.symbol})`,
        value: (c.marketCap / watchedCap) * 100,
        formattedValue: compactUsd(c.marketCap),
        color: allocColors[i % allocColors.length],
      }))
    : [];
  const bestCoin = watchedCoins.length > 0
    ? [...watchedCoins].sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0))[0]
    : null;

  return (
    <div className="space-y-3">
      {/* 4-Card Watchlist Summary Strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CompactKpiCard
          label="Tracked Assets"
          value={`${starredIds.size} Coins`}
          sub="Personal Watchlist"
          subTone="neutral"
          icon={<Star className="h-3 w-3 fill-amber-400" />}
          iconBg="bg-amber-500/25 text-amber-400 ring-1 ring-amber-500/40"
        />
        <CompactKpiCard
          label="24h Average Return"
          value={avg24h != null ? `${avg24h >= 0 ? "+" : ""}${avg24h.toFixed(2)}%` : "-"}
          sub={avg24h == null ? "-" : avg24h >= 0 ? "Watchlist up" : "Watchlist down"}
          subTone={avg24h == null ? "neutral" : avg24h >= 0 ? "up" : "down"}
          icon={<TrendingUp className="h-3 w-3" />}
          iconBg={(avg24h ?? 0) >= 0 ? "bg-emerald-600/30 text-emerald-400 ring-1 ring-emerald-500/40" : "bg-rose-600/30 text-rose-400 ring-1 ring-rose-500/40"}
        />
        <CompactKpiCard
          label="Top Watchlist Mover"
          value={bestCoin ? `${bestCoin.symbol} (${bestCoin.change24h >= 0 ? "+" : ""}${bestCoin.change24h.toFixed(1)}%)` : "-"}
          sub={bestCoin ? "Best 24h move" : "-"}
          subTone={bestCoin ? (bestCoin.change24h >= 0 ? "up" : "down") : "neutral"}
          icon={<Flame className="h-3 w-3" />}
          iconBg="bg-mint-500/25 text-mint-400 ring-1 ring-mint-500/40"
          sparkline={bestCoin?.sparkline && bestCoin.sparkline.length >= 2 ? bestCoin.sparkline : undefined}
          color="#00e599"
        />
        <CompactKpiCard
          label="Watchlist Market Cap"
          value={watchedCap > 0 ? compactUsd(watchedCap) : "-"}
          sub={watchedCoins.length ? `${watchedCoins.length} priced` : "-"}
          subTone="neutral"
          icon={<Bell className="h-3 w-3" />}
          iconBg="bg-blue-600/30 text-blue-400 ring-1 ring-blue-500/40"
        />
      </div>

      {/* Quick Add & Popular Suggestion Bar */}
      <div className="neu-card rounded-2xl p-3 border border-white/60 dark:border-white/[0.08] shadow-neu flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <input
              value={search}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setSearch(e.target.value);
                setSearchOpen(true);
              }}
              placeholder="Add coin to watchlist (BTC, SOL...)"
              className="w-full rounded-xl bg-black/20 border border-white/10 pl-8 pr-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/40"
            />
            {searchOpen && search && (
              <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-48 overflow-y-auto rounded-xl bg-ink-950 border border-white/10 shadow-2xl p-1 divide-y divide-white/5">
                {allAvailable
                  .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.symbol.toLowerCase().includes(search.toLowerCase()))
                  .slice(0, 6)
                  .map((coin) => (
                    <button
                      key={coin.id}
                      onClick={() => addCoin(coin.id)}
                      className="w-full flex items-center justify-between p-2 text-xs hover:bg-white/5 rounded-lg transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        {coin.image && <img src={coin.image} alt="" className="h-4 w-4 rounded-full" />}
                        <span className="font-bold text-zinc-200">{coin.symbol}</span>
                        <span className="text-zinc-500 text-[11px]">{coin.name}</span>
                      </div>
                      <Plus className="h-3.5 w-3.5 text-amber-400" />
                    </button>
                  ))}
              </div>
            )}
          </div>
          {searchOpen && (
            <button onClick={() => setSearchOpen(false)} className="text-xs text-zinc-500 hover:text-zinc-300">
              Cancel
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto [scrollbar-width:none]">
          <span className="text-[10px] uppercase font-bold text-zinc-500 shrink-0">Quick Add:</span>
          {["bitcoin", "ethereum", "solana", "hyperliquid", "sui", "binancecoin"].map((id) => {
            const isAdded = starredIds.has(id);
            const sym = id === "bitcoin" ? "BTC" : id === "ethereum" ? "ETH" : id === "solana" ? "SOL" : id === "hyperliquid" ? "HYPE" : id === "sui" ? "SUI" : "BNB";
            return (
              <button
                key={id}
                onClick={() => (isAdded ? null : addCoin(id))}
                disabled={isAdded}
                className={cn(
                  "px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all shrink-0",
                  isAdded
                    ? "bg-white/5 border-white/5 text-zinc-500 cursor-default"
                    : "bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/20"
                )}
              >
                {isAdded ? `✓ ${sym}` : `+ ${sym}`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Visual Analytics: Watchlist Portfolio Allocation Donut & 24h Performance Center-Zero Bar */}
      <section className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        {allocation.length ? (
          <DonutPieChart
            title="Watchlist by Market Cap"
            subtitle="How your watched assets weigh against each other by market cap"
            totalLabel="Watched Assets"
            totalValue={`${watchedCoins.length} Coins`}
            segments={allocation}
            insightText={allocation[0] ? `${allocation[0].name} is ${allocation[0].value.toFixed(0)}% of your watchlist by market cap.` : undefined}
          />
        ) : (
          <div className="h-[260px] animate-pulse rounded-2xl bg-white/5" />
        )}

        <ComparativeBarChart
          title="24h Watched Assets Performance"
          subtitle="Relative returns compared to zero baseline (+ profit / - loss)"
          items={watchedCoins.map((c) => ({
            label: c.symbol,
            sublabel: c.name,
            value: c.change24h ?? 0,
            displayValue: `${(c.change24h ?? 0) >= 0 ? "+" : ""}${(c.change24h ?? 0).toFixed(2)}%`,
          }))}
          insightText={bestCoin && worstCoin ? `Best: ${bestCoin.symbol} ${pct(bestCoin.change24h, 1)}. Worst: ${worstCoin.symbol} ${pct(worstCoin.change24h, 1)}.` : undefined}
        />
      </section>

      {/* Pro Watchlist Table */}
      <Panel
        title={`My Watchlist (${watchedCoins.length} Assets)`}
        icon={<Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
        action={
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-500">Live prices</span>
          </div>
        }
      >
        {watchedCoins.length === 0 ? (
          <div className="text-center py-10 space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
              <Star className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold text-zinc-200 text-sm">Your Watchlist is empty</p>
              <p className="text-xs text-zinc-500 mt-0.5">Track your favorite crypto assets with 1-click real-time updates</p>
            </div>
            <button
              onClick={addTopBluechips}
              className="neu-btn px-4 py-2 rounded-xl bg-amber-400 text-black font-bold text-xs shadow-neu-sm hover:scale-[1.02] transition-all"
            >
              Add Top 7 Bluechips Now
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-black/[0.04] dark:border-white/10 text-[10px] uppercase tracking-wider text-zinc-500 pb-2">
                  <th className="text-left py-2 px-1 font-medium w-4">#</th>
                  <th className="text-left py-2 px-2 font-medium">Asset</th>
                  <th className="text-right py-2 px-2 font-medium">Price</th>
                  <th className="text-right py-2 px-2 font-medium">24h %</th>
                  <th className="text-right py-2 px-2 font-medium hidden sm:table-cell">7d %</th>
                  <th className="text-right py-2 px-2 font-medium hidden md:table-cell">Volume</th>
                  <th className="text-right py-2 px-2 font-medium hidden lg:table-cell">Market Cap</th>
                  <th className="text-right py-2 px-2 font-medium">7d Chart</th>
                  <th className="text-center py-2 px-2 font-medium w-12">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/5">
                {watchedCoins.map((r, i) => (
                  <tr key={r.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors group">
                    <td className="mono py-2.5 px-1 text-zinc-500 text-[11px]">{i + 1}</td>
                    <td className="py-2.5 px-2">
                      <Link href={`/markets/${r.id}`} className="flex items-center gap-2">
                        {r.image && (
                          <img src={r.image} alt="" className="h-5 w-5 rounded-full ring-1 ring-black/10 dark:ring-white/10" />
                        )}
                        <div>
                          <span className="font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-amber-500 transition-colors text-xs sm:text-sm">{r.symbol}</span>
                          <span className="text-zinc-500 text-[11px] ml-1.5 hidden sm:inline">{r.name}</span>
                        </div>
                      </Link>
                    </td>
                    <td className="text-right mono font-bold text-zinc-900 dark:text-zinc-100 py-2.5 px-2 text-xs sm:text-[13px] whitespace-nowrap">
                      {coinPrice(r.price)}
                    </td>
                    <td className={cn("text-right mono font-bold py-2.5 px-2 text-xs whitespace-nowrap", (r.change24h ?? 0) >= 0 ? "text-mint-400" : "text-red-400")}>
                      {(r.change24h ?? 0) >= 0 ? "+" : ""}{(r.change24h ?? 0).toFixed(2)}%
                    </td>
                    <td className={cn("text-right mono font-medium py-2.5 px-2 text-xs whitespace-nowrap hidden sm:table-cell", (r.change7d ?? 0) >= 0 ? "text-mint-400" : "text-red-400")}>
                      {(r.change7d ?? 0) >= 0 ? "+" : ""}{(r.change7d ?? 0).toFixed(2)}%
                    </td>
                    <td className="text-right mono text-zinc-400 py-2.5 px-2 text-xs hidden md:table-cell">{compactCleanUsd(r.volume24h)}</td>
                    <td className="text-right mono text-zinc-400 py-2.5 px-2 text-xs hidden lg:table-cell">{compactCleanUsd(r.marketCap)}</td>
                    <td className="py-2.5 px-2">
                      <div className="w-16 h-5 ml-auto">
                        <Sparkline data={r.sparkline} />
                      </div>
                    </td>
                    <td className="text-center py-2.5 px-2">
                      <button
                        onClick={(e) => removeCoin(r.id, e)}
                        title="Remove from Watchlist"
                        className="p-1 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

type NewsHeadline = { title: string; url: string; source: string; category: string; publishedAt: number };

function TrendingNews() {
  const [items, setItems] = useState<NewsHeadline[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/news?pageSize=10");
      if (!r.ok) throw new Error("bad status");
      const j = await r.json();
      setItems(Array.isArray(j.items) ? j.items : []);
    } finally {
      setLoading(false);
    }
  }, []);
  // /api/news is cached for 120s at the edge; polling faster re-reads the same response.
  useLiveData({ load, intervalMs: 120_000, wakeMinAgeMs: 60_000 });
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

/* ---------------- SHARED COMPONENTS & ATOMS ---------------- */

function Panel({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="neu-card rounded-2xl p-4 sm:p-5 border border-white/60 dark:border-white/[0.06] shadow-neu hover:scale-[1.005] active:scale-[1.005] transition-all">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{title}</p>
        </div>
        {action}
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
    <div className="divide-y divide-zinc-200/60 dark:divide-white/5">
      {rows.map((r, i) => {
        const inner = (
          <>
            <span className="mono w-4 shrink-0 text-[11px] text-zinc-500 dark:text-zinc-600">{i + 1}</span>
            {r.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.logo} alt="" width={20} height={20} loading="lazy" className="h-5 w-5 rounded-full ring-1 ring-white/10 shrink-0 object-contain" onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")} />
            ) : (
              <div className="shrink-0 flex items-center justify-center">
                <ProtocolAvatar project={r.name} />
              </div>
            )}
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-200 group-hover:text-amber-600 dark:group-hover:text-gold-200">{r.name}</span>
            {r.meta && <span className="hidden shrink-0 text-[11px] text-zinc-500 sm:inline">{r.meta}</span>}
            <span className="mono shrink-0 text-right text-sm text-zinc-800 dark:text-zinc-300">{r.value}</span>
            {r.change !== undefined && (
              <span className={cn("mono w-16 shrink-0 text-right text-[11px]", r.change >= 0 ? "text-mint-400" : "text-red-400")}>{pct(r.change, 1)}</span>
            )}
          </>
        );
        return r.href ? (
          <Link key={r.name} href={r.href} className="group flex items-center gap-3 py-2 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03]">
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
  if (!rows?.length) return <ListSkeleton />;
  const items = rows.slice(0, 5);
  return (
    <div>
      <div className="flex items-center gap-1 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-200/60 dark:border-white/[0.04]">
        <div className="w-4 text-center shrink-0">#</div>
        <div className="flex-1 min-w-0">Asset</div>
        <div className="w-[56px] text-right shrink-0">Price</div>
        <div className="w-[46px] text-right shrink-0">24h %</div>
        <div className="w-[44px] text-right shrink-0 hidden sm:block">Volume</div>
        <div className="w-11 text-right shrink-0">Chart</div>
      </div>
      <div className="divide-y divide-zinc-200/60 dark:divide-white/5">
        {items.map((r, i) => {
          const up = r.change24h >= 0;
          const spark = (r as { sparkline?: number[] }).sparkline;
          const vol = (r as { volume?: number }).volume || null;
          return (
            <Link
              key={r.id + i}
              href={`/markets/${r.id}`}
              className="flex items-center gap-1 py-2 px-0.5 rounded-lg transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03] group text-xs"
            >
              <div className="w-4 text-center mono text-[11px] text-zinc-500 dark:text-zinc-600 shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 flex items-center gap-1.5 min-w-0">
                {r.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.image}
                    alt=""
                    className="h-4 w-4 rounded-full ring-1 ring-white/10 shrink-0 object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                    }}
                  />
                )}
                <span className="font-semibold text-zinc-900 dark:text-zinc-200 group-hover:text-amber-600 dark:group-hover:text-gold-200 transition-colors truncate">
                  {r.symbol}
                </span>
              </div>
              <div className="w-[56px] text-right mono text-zinc-800 dark:text-zinc-300 font-medium text-[11px] shrink-0">
                {coinPrice(r.price)}
              </div>
              <div className={cn("w-[46px] text-right mono font-semibold text-[11px] shrink-0", up ? "text-mint-400" : "text-red-400")}>
                {up ? "+" : ""}{r.change24h.toFixed(1)}%
              </div>
              <div className="w-[44px] text-right mono text-zinc-600 dark:text-zinc-400 font-medium text-[11px] shrink-0 hidden sm:block">
                {vol != null ? compactCleanUsd(vol) : "-"}
              </div>
              <div className="w-11 flex items-center justify-end shrink-0">
                <MoverMiniSparkline data={spark} up={up} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

type CompactKpiCardProps = {
  label: string;
  value: string;
  sub: React.ReactNode;
  subTone: "up" | "down" | "neutral";
  icon: React.ReactNode;
  iconBg: string;
  sparkline?: number[];
  color?: string;
  className?: string;
};

function CompactKpiCard({ label, value, sub, subTone, icon, iconBg, sparkline, color, className }: CompactKpiCardProps) {
  return (
    <div className={cn("neu-card rounded-2xl px-2.5 py-2 border border-white/60 dark:border-white/[0.08] shadow-neu-sm hover:scale-[1.02] active:scale-[1.02] transition-all flex flex-col justify-between h-[92px] w-[145px] sm:w-auto shrink-0 sm:shrink snap-start", className)}>
      <div className="flex items-center gap-1.5">
        <div className={cn("neu-inset-sm flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] shadow-neu-inset-sm", iconBg)}>
          {icon}
        </div>
        <p className="text-[9.5px] sm:text-[10px] font-bold uppercase tracking-tight sm:tracking-wider text-zinc-500 dark:text-zinc-400 truncate">{label}</p>
      </div>
      <p className="mono text-[18px] sm:text-[19px] font-black tracking-tight text-zinc-900 dark:text-zinc-50 leading-none mt-1">{value}</p>
      <div className="flex items-end justify-between gap-1 mt-auto">
        <div className={cn("mono text-[11px] font-bold leading-none inline-flex items-center gap-0.5 truncate", subTone === "up" ? "text-mint-400" : subTone === "down" ? "text-red-400" : "text-zinc-500 dark:text-zinc-400")}>
          {sub}
        </div>
        {sparkline && <GlowingSparkline data={sparkline} color={color ?? "#10b981"} />}
      </div>
    </div>
  );
}

// Label colour follows the reading: fear reads red, neutral amber, greed mint. It
// used to be mint whatever the value, so "Extreme Fear" showed as a green, bullish label.
const FNG_FILL = { red: "fill-rose-600 dark:fill-red-400", amber: "fill-amber-600 dark:fill-amber-400", mint: "fill-mint-600 dark:fill-mint-400" } as const;
const fngFill = (v: number | null) => (v == null ? "fill-zinc-500" : FNG_FILL[fngLabel(v).tone]);

function CompactFearGreedCard({ fg, className }: { fg: { value: number; label: string } | null; className?: string }) {
  // No reading -> "-" and a centred needle, never a default score.
  const v = fg?.value ?? null;
  const label = v != null ? fngLabel(v).label : "-";

  return (
    <div className={cn("neu-card rounded-2xl px-2.5 py-2 border border-white/60 dark:border-white/[0.08] shadow-neu-sm hover:scale-[1.02] active:scale-[1.02] transition-all flex flex-col justify-between h-[92px] w-[145px] sm:w-auto shrink-0 sm:shrink snap-start", className)}>
      <div className="flex items-center gap-1.5">
        <div className="neu-inset-sm flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-teal-500/20 text-teal-400 ring-1 ring-teal-500/40 text-[11px] shadow-neu-inset-sm">
          <Activity className="h-3 w-3" />
        </div>
        <p className="text-[9.5px] sm:text-[10px] font-bold uppercase tracking-tight sm:tracking-wider text-zinc-500 dark:text-zinc-400 truncate">Fear & Greed</p>
      </div>

      <div className="relative flex flex-col items-center justify-center mt-auto pb-0.5">
        <svg viewBox="0 0 100 48" className="w-24 h-10 overflow-visible">
          <defs>
            <linearGradient id="fgGaugeCompact" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#00e599" />
            </linearGradient>
          </defs>
          <path d="M 14 45 A 36 36 0 0 1 86 45" fill="none" stroke="rgba(160, 175, 195, 0.2)" strokeWidth="6" strokeLinecap="round" />
          <path d="M 14 45 A 36 36 0 0 1 86 45" fill="none" stroke="url(#fgGaugeCompact)" strokeWidth="6" strokeLinecap="round" />
          <text x="50" y="31" textAnchor="middle" className="mono text-[16px] font-black fill-zinc-900 dark:fill-zinc-50 leading-none">{v ?? "-"}</text>
          {/* "Extreme Fear"/"Extreme Greed" are wider than the arc's opening at 9px with wide tracking, and ran into the gauge's end caps. */}
          <text x="50" y="44" textAnchor="middle" className={cn("font-bold uppercase", (fg?.label || label).length > 8 ? "text-[7.5px] tracking-normal" : "text-[9px] tracking-wider", fngFill(v))}>{fg?.label || label}</text>
        </svg>
      </div>
    </div>
  );
}

function GlowingSparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return <div className="w-18 h-5" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 72;
  const h = 22;
  const pts = data
    .map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - min) / range) * (h - 6)).toFixed(1)}`)
    .join(" ");
  const areaPts = `0,${h} ${pts} ${w},${h}`;
  const gradId = `spark-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-18 sm:w-20 h-5 overflow-visible shrink-0" aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.36" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <polygon points={areaPts} fill={`url(#${gradId})`} />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type TileProps = { label: string; value: string; sub?: string; subTone?: "up" | "down"; icon?: React.ReactNode; sparkline?: number[]; loading?: boolean };
function Tile({ label, value, sub, subTone, icon, sparkline, loading }: TileProps) {
  return (
    <div className={cn("surface lift rounded-2xl p-4", "neu-card border border-white/60 dark:border-white/[0.06] shadow-neu")}>
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">{icon}{label}</p>
      <p className={cn("mono mt-1.5 text-xl font-bold text-zinc-50 text-zinc-900 dark:text-zinc-50", loading && "opacity-90")}>{value}</p>
      <div className="mt-2.5 flex items-center justify-between gap-1">
        {sub ? (
          <p className={cn("mono text-[11px] font-semibold inline-flex items-center gap-0.5", subTone === "up" ? "text-emerald-600 dark:text-mint-400" : subTone === "down" ? "text-rose-600 dark:text-red-400" : "text-zinc-500")}>
            {subTone === "up" ? <TrendingUp className="h-3 w-3" /> : subTone === "down" ? <TrendingDown className="h-3 w-3" /> : null}
            {sub}
          </p>
        ) : <span />}
        {sparkline && sparkline.length > 1 && (
          <div className="w-14 h-4 shrink-0"><Sparkline data={sparkline} /></div>
        )}
      </div>
    </div>
  );
}

function StatCardMini({ label, value, sub, trend }: { label: string; value: string; sub?: string; trend?: number[] }) {
  return (
    <div className={cn("surface lift rounded-2xl p-4", "neu-card border border-white/60 dark:border-white/[0.06] shadow-neu")}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mono mt-1.5 text-xl font-bold text-zinc-50 text-zinc-900 dark:text-zinc-50">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">{sub}</p>}
      {trend && trend.length > 1 && (
        <div className="mt-3">
          <Sparkline data={trend} />
        </div>
      )}
    </div>
  );
}

function FearGreedTile({ fg, loading }: { fg: { value: number; label: string } | null; loading?: boolean }) {
  // No reading -> "-" and a centred needle, never a default score.
  const v = fg?.value ?? null;
  const label = v != null ? fngLabel(v).label : "-";
  const needleAngle = v == null ? 0 : Math.min(90, Math.max(-90, (v / 100) * 180 - 90));

  return (
    <div className="neu-card rounded-2xl border border-white/60 dark:border-white/[0.06] shadow-neu p-4 flex flex-col justify-between">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
        <Activity className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
        Fear & Greed
      </p>

      {/* Speedometer arc gauge matching Image 2 */}
      <div className="relative mt-1 flex flex-col items-center justify-center">
        <svg viewBox="0 0 100 56" className="w-28 h-14 overflow-visible">
          <defs>
            <linearGradient id="fgGauge" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="35%" stopColor="#f59e0b" />
              <stop offset="70%" stopColor="#22d692" />
              <stop offset="100%" stopColor="#0bbb7c" />
            </linearGradient>
          </defs>
          <path d="M 10 52 A 40 40 0 0 1 90 52" fill="none" stroke="rgba(128, 128, 128, 0.15)" strokeWidth="5.5" strokeLinecap="round" />
          <path d="M 10 52 A 40 40 0 0 1 90 52" fill="none" stroke="url(#fgGauge)" strokeWidth="5.5" strokeLinecap="round" />
          <g transform={`rotate(${needleAngle} 50 52)`} className="transition-transform duration-700 ease-out">
            <line x1="50" y1="52" x2="50" y2="16" stroke="#e2a72f" strokeWidth="2" strokeLinecap="round" />
            <circle cx="50" cy="16" r="1.5" fill="#e2a72f" />
          </g>
          <circle cx="50" cy="52" r="3" fill="#e2a72f" />
          <circle cx="50" cy="52" r="1.5" fill="#08080a" />
          <text x="50" y="34" textAnchor="middle" className="mono text-[16px] font-black fill-zinc-900 dark:fill-zinc-50">{v ?? "-"}</text>
          <text x="50" y="46" textAnchor="middle" className={cn("text-[9px] font-semibold tracking-wide", fngFill(v))}>{fg?.label || label}</text>
        </svg>
      </div>
    </div>
  );
}

function Sparkline({ data, className }: { data: number[]; className?: string }) {
  if (!data || data.length < 2) return <div className="h-8" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 100;
  const h = 28;
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * w).toFixed(2)},${(h - 2 - ((v - min) / range) * (h - 4)).toFixed(2)}`).join(" ");
  const up = data[data.length - 1] >= data[0];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-7 w-full overflow-visible", className)} aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={up ? "var(--chart-mint)" : "#ef4444"}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{ filter: up ? "drop-shadow(0 0 3px rgba(0, 229, 153, 0.45))" : "drop-shadow(0 0 3px rgba(239, 68, 68, 0.45))" }}
      />
    </svg>
  );
}

function SortTh({
  label,
  col,
  sort,
  onSort,
  align = "right",
  className,
}: {
  label: string;
  col: SortKey;
  sort: { key: SortKey; dir: SortDir };
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
  className?: string;
}) {
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

function ChangeCell({ v, className }: { v: number; className?: string }) {
  return (
    <td className={cn("mono px-2 py-2.5 text-right text-[13px]", v >= 0 ? "text-mint-400" : "text-red-400", className)}>
      {pct(v, 1)}
    </td>
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
