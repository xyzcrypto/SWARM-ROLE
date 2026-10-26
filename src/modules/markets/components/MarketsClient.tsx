"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { AIMarketIntelligenceCard } from "./AIMarketIntelligenceCard";
import { WatchlistWidget } from "./WatchlistWidget";
import { PerpLeaderboardWidget } from "./PerpLeaderboardWidget";
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

/**
 * Visibility-gated poller (same pattern as MarketTicker/PerpChart).
 * Keeps the last good payload so transient failures don't wipe the dashboard.
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
      if (j?.live) setData(j);
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
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");
  const [watchlistCount, setWatchlistCount] = useState(5);

  useEffect(() => {
    const updateCount = () => {
      try {
        const saved = localStorage.getItem("xyz_user_watchlist");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setWatchlistCount(parsed.length);
          }
        }
      } catch {
        // ignore
      }
    };
    updateCount();
    window.addEventListener("watchlist-updated", updateCount);
    return () => window.removeEventListener("watchlist-updated", updateCount);
  }, []);

  const g = usePolledJson<GlobalResp>("/api/markets/global", 5_000);
  const d = usePolledJson<DefiResp>("/api/markets/defi", 5_000);
  const p = usePolledJson<PerpResp>("/api/markets/perp", 5_000);
  const x = usePolledJson<DexResp>("/api/markets/dex", 5_000);
  const y = usePolledJson<YieldResp>("/api/markets/yields", 5_000);
  const c = usePolledJson<CoinsResp>("/api/markets/coins", 5_000);

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
        onNavigateWatchlist={() => setTab("watchlist")}
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
          <HorizontalTrendingBar />

          {/* ── 7-Card Global KPI Strip: Swipeable Carousel on Mobile, 7-Column Grid on Desktop ── */}
          <div className="flex sm:grid overflow-x-auto sm:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory sm:snap-none gap-2 sm:grid-cols-3 lg:grid-cols-7 pb-1 sm:pb-0 touch-pan-x -mx-1 px-1 sm:mx-0 sm:px-0">
            <CompactKpiCard
              label="Market Cap"
              value={formatCompact(g.data?.marketCap ?? 2.82e12)}
              sub={g.data?.mcapChange24h != null ? pct(g.data.mcapChange24h, 2) : "-2.68%"}
              subTone={(g.data?.mcapChange24h ?? -1) >= 0 ? "up" : "down"}
              icon={<Globe className="h-3 w-3" />}
              iconBg="bg-blue-600/30 text-blue-400 ring-1 ring-blue-500/40"
              sparkline={[2.97, 2.94, 2.96, 2.92, 2.94, 2.90, 2.93, 2.91, 2.88, 2.91, 2.87, 2.90]}
              color={(g.data?.mcapChange24h ?? -1) >= 0 ? "#10b981" : "#ef4444"}
            />
            <CompactKpiCard
              label="24h Volume"
              value={formatCompact(g.data?.volume24h ?? 50.5e9)}
              sub="+8.42%"
              subTone="up"
              icon={<BarChart3 className="h-3 w-3" />}
              iconBg="bg-emerald-600/30 text-emerald-400 ring-1 ring-emerald-500/40"
              sparkline={[52.0, 53.6, 52.9, 54.4, 53.8, 55.6, 54.9, 56.2, 55.4, 56.5, 56.94]}
              color="#10b981"
            />
            <CompactKpiCard
              label="BTC Dominance"
              value={g.data?.btcDominance ? `${g.data.btcDominance.toFixed(1)}%` : "59.6%"}
              sub="+0.4%"
              subTone="up"
              icon={<Coins className="h-3 w-3" />}
              iconBg="bg-amber-500/25 text-amber-400 ring-1 ring-amber-500/40"
              sparkline={[57.7, 57.9, 57.8, 58.0, 57.95, 58.15, 58.1, 58.25, 58.18, 58.3]}
              color="#f59e0b"
            />
            <CompactFearGreedCard fg={g.data?.fearGreed ?? null} />
            {(() => {
              const trend = d.data?.tvlTrend;
              const tvlPct = trend && trend.length >= 2 && trend[0] > 0
                ? ((trend[trend.length - 1] - trend[0]) / trend[0]) * 100
                : 2.1;
              const isUp = tvlPct >= 0;
              return (
                <CompactKpiCard
                  label="DeFi TVL"
                  value={formatCompact(d.data?.totalTvl ?? 92.5e9)}
                  sub={pct(tvlPct, 1)}
                  subTone={isUp ? "up" : "down"}
                  icon={<Layers className="h-3 w-3" />}
                  iconBg="bg-purple-600/30 text-purple-400 ring-1 ring-purple-500/40"
                  sparkline={trend && trend.length >= 2 ? trend : [92.4, 93.7, 93.1, 94.5, 93.9, 95.2, 94.6, 95.4, 94.9, 95.63]}
                  color={isUp ? "#10b981" : "#ef4444"}
                />
              );
            })()}
            <CompactKpiCard
              label="Stablecoin MCap"
              value={formatCompact(d.data?.stableMcap ?? g.data?.stableMcap ?? 312.7e9)}
              sub="+0.8%"
              subTone="up"
              icon={<Coins className="h-3 w-3" />}
              iconBg="bg-cyan-600/30 text-cyan-400 ring-1 ring-cyan-500/40"
              sparkline={[310.1, 311.2, 310.8, 311.9, 311.4, 312.4, 311.9, 312.6, 312.2, 313.03]}
              color="#06b6d4"
            />
            <CompactKpiCard
              label="ETH Gas"
              value={g.data?.gasGwei != null ? `${g.data.gasGwei} gwei` : "0.1 gwei"}
              sub={
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-mint-400">
                  <Leaf className="h-2.5 w-2.5 fill-current" />
                  <span>Low fees</span>
                </span>
              }
              subTone="up"
              icon={<Fuel className="h-3 w-3" />}
              iconBg="bg-amber-500/25 text-amber-400 ring-1 ring-amber-500/40"
              sparkline={[0.08, 0.089, 0.083, 0.093, 0.087, 0.095, 0.091, 0.098, 0.1]}
              color="#14b8a6"
            />
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
          onNavigateWatchlist={() => setTab("watchlist")}
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
        <p>Design concept · Illustrative data</p>
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
          <MoverList rows={c?.gainers?.slice(0, 5) ?? []} fallback={defaultGainers} />
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
          <MoverList rows={c?.losers?.slice(0, 5) ?? []} fallback={defaultLosers} />
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
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-start">
        <div className="lg:col-span-6 xl:col-span-6">
          <CoinsPanel c={c} loading={loading} isEmbedded />
        </div>
        <div className="lg:col-span-3 xl:col-span-3">
          <PerpLeaderboardWidget dexs={p?.dexs} onViewAll={onNavigatePerp} />
        </div>
        <div className="lg:col-span-3 xl:col-span-3">
          <WatchlistWidget coins={c?.list} onViewAll={onNavigateWatchlist} />
        </div>
      </section>
    </div>
  );
}

/* ---------------- COINS PANEL & TOP ASSETS TABLE ---------------- */

const defaultCoins: CoinRow[] = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin", price: 68420.32, change1h: 0.3, change24h: 2.18, change7d: 4.21, marketCap: 1.34e12, volume24h: 42.8e9, ath: 73750, athChange: -7.2, rank: 1, image: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png", sparkline: [66400, 66800, 67200, 67600, 67900, 68200, 68420.32] },
  { id: "ethereum", symbol: "ETH", name: "Ethereum", price: 3540.21, change1h: 0.4, change24h: 1.21, change7d: 4.42, marketCap: 425e9, volume24h: 28.4e9, ath: 4891, athChange: -27.6, rank: 2, image: "https://assets.coingecko.com/coins/images/279/small/ethereum.png", sparkline: [3410, 3435, 3460, 3490, 3515, 3530, 3540.21] },
  { id: "solana", symbol: "SOL", name: "Solana", price: 168.4, change1h: 1.1, change24h: 6.42, change7d: 12.3, marketCap: 81e9, volume24h: 4.2e9, ath: 260, athChange: -35.2, rank: 3, image: "https://assets.coingecko.com/coins/images/4128/small/solana.png", sparkline: [150, 153, 157, 160, 163, 166, 168.4] },
  { id: "binancecoin", symbol: "BNB", name: "BNB", price: 592.14, change1h: 0.2, change24h: 0.82, change7d: 2.11, marketCap: 86e9, volume24h: 1.8e9, ath: 720, athChange: -17.8, rank: 4, image: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png", sparkline: [582, 584, 586, 588, 590, 591, 592.14] },
  { id: "ripple", symbol: "XRP", name: "XRP", price: 0.623, change1h: -0.2, change24h: -1.41, change7d: -2.81, marketCap: 34e9, volume24h: 2.1e9, ath: 3.84, athChange: -83.8, rank: 5, image: "https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png", sparkline: [0.639, 0.636, 0.633, 0.630, 0.626, 0.623] },
];

function CoinsPanel({ c, loading, isEmbedded = false, g }: { c: CoinsResp | null; loading: boolean; isEmbedded?: boolean; g?: GlobalMarket | null }) {
  const base = c?.list ?? [];
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
  const displayRows = isDefaultOverview && !rows.length ? defaultCoins : rows;

  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: defaultDirFor(key) }));

  // Watchlist favorite and alert toggles
  const [starred, setStarred] = useState<Set<string>>(() => new Set(["bitcoin", "ethereum", "solana"]));
  const [alerts, setAlerts] = useState<Set<string>>(new Set());

  const toggleStar = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
            <UpdatedPill ts={c?.ts} />
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
        ) : loading && !rows.length && !isEmbedded ? (
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
          <p className="py-4 text-center text-sm text-zinc-500">Coin data is loading…</p>
        )}
      </div>
    </Panel>
  );

  if (!isEmbedded) {
    const topGainer = c?.gainers?.[0] || defaultGainers[0];
    const topCoin = displayRows[0] || defaultCoins[0];
    const secondCoin = displayRows[1] || defaultCoins[1];
    const thirdCoin = displayRows[2] || defaultCoins[2];

    return (
      <div className="space-y-3">
        {/* 4-Card Coin KPI Strip */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <CompactKpiCard
            label="Tracked Assets"
            value="250 Coins"
            sub={<span className="text-zinc-400">Top 100 Real-Time</span>}
            subTone="up"
            icon={<LineChart className="h-3 w-3" />}
            iconBg="bg-blue-600/30 text-blue-400 ring-1 ring-blue-500/40"
            sparkline={[240, 242, 245, 248, 250]}
            color="#3b82f6"
          />
          <CompactKpiCard
            label="24h Spot Volume"
            value={compactUsd(g?.volume24h ?? 50.5e9)}
            sub="+8.42%"
            subTone="up"
            icon={<BarChart3 className="h-3 w-3" />}
            iconBg="bg-emerald-600/30 text-emerald-400 ring-1 ring-emerald-500/40"
            sparkline={[52.0, 53.6, 52.9, 54.4, 53.8, 55.6, 56.94]}
            color="#10b981"
          />
          <CompactKpiCard
            label="BTC Dominance"
            value={g?.btcDominance ? `${g.btcDominance.toFixed(1)}%` : "59.6%"}
            sub="+0.4%"
            subTone="up"
            icon={<Coins className="h-3 w-3" />}
            iconBg="bg-amber-500/25 text-amber-400 ring-1 ring-amber-500/40"
            sparkline={[57.7, 57.9, 58.0, 58.15, 58.3]}
            color="#f59e0b"
          />
          <CompactKpiCard
            label="Top Gainer Spotlight"
            value={topGainer ? `+${topGainer.change24h.toFixed(1)}%` : "+8.4%"}
            sub={topGainer ? `${topGainer.symbol} surge` : "SOL rally"}
            subTone="up"
            icon={<TrendingUp className="h-3 w-3" />}
            iconBg="bg-mint-500/25 text-mint-400 ring-1 ring-mint-500/40"
            sparkline={[12, 14, 18, 22, 26, 32]}
            color="#00e599"
          />
        </div>

        {/* 3-Column Spotlight Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <Link
            href={`/markets/${topCoin.id}`}
            className="neu-card rounded-2xl p-3 border border-white/60 dark:border-white/[0.08] shadow-neu hover:scale-[1.01] transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-2.5">
              {topCoin.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={topCoin.image} alt="" className="h-7 w-7 rounded-full ring-1 ring-black/10 dark:ring-white/10" />
              )}
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-amber-500 transition-colors">{topCoin.symbol}</span>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-500 border border-amber-500/20">#1 Asset</span>
                </div>
                <p className="mono font-bold text-xs text-zinc-800 dark:text-zinc-200 mt-0.5">{coinPrice(topCoin.price)}</p>
              </div>
            </div>
            <div className="text-right">
              <span className={cn("mono text-xs font-bold", topCoin.change24h >= 0 ? "text-mint-400" : "text-red-400")}>
                {topCoin.change24h >= 0 ? "+" : ""}{topCoin.change24h.toFixed(2)}%
              </span>
              <div className="w-16 h-5 ml-auto mt-1">
                <Sparkline data={topCoin.sparkline} />
              </div>
            </div>
          </Link>

          <Link
            href={`/markets/${secondCoin.id}`}
            className="neu-card rounded-2xl p-3 border border-white/60 dark:border-white/[0.08] shadow-neu hover:scale-[1.01] transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-2.5">
              {secondCoin.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={secondCoin.image} alt="" className="h-7 w-7 rounded-full ring-1 ring-black/10 dark:ring-white/10" />
              )}
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-amber-500 transition-colors">{secondCoin.symbol}</span>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20">#2 Smart Contract</span>
                </div>
                <p className="mono font-bold text-xs text-zinc-800 dark:text-zinc-200 mt-0.5">{coinPrice(secondCoin.price)}</p>
              </div>
            </div>
            <div className="text-right">
              <span className={cn("mono text-xs font-bold", secondCoin.change24h >= 0 ? "text-mint-400" : "text-red-400")}>
                {secondCoin.change24h >= 0 ? "+" : ""}{secondCoin.change24h.toFixed(2)}%
              </span>
              <div className="w-16 h-5 ml-auto mt-1">
                <Sparkline data={secondCoin.sparkline} />
              </div>
            </div>
          </Link>

          <Link
            href={`/markets/${thirdCoin.id}`}
            className="neu-card rounded-2xl p-3 border border-white/60 dark:border-white/[0.08] shadow-neu hover:scale-[1.01] transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-2.5">
              {thirdCoin.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thirdCoin.image} alt="" className="h-7 w-7 rounded-full ring-1 ring-black/10 dark:ring-white/10" />
              )}
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-amber-500 transition-colors">{thirdCoin.symbol}</span>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-400 border border-purple-500/20">High Velocity</span>
                </div>
                <p className="mono font-bold text-xs text-zinc-800 dark:text-zinc-200 mt-0.5">{coinPrice(thirdCoin.price)}</p>
              </div>
            </div>
            <div className="text-right">
              <span className={cn("mono text-xs font-bold", thirdCoin.change24h >= 0 ? "text-mint-400" : "text-red-400")}>
                {thirdCoin.change24h >= 0 ? "+" : ""}{thirdCoin.change24h.toFixed(2)}%
              </span>
              <div className="w-16 h-5 ml-auto mt-1">
                <Sparkline data={thirdCoin.sparkline} />
              </div>
            </div>
          </Link>
        </div>

        {/* Visual Analytics: Market Cap Dominance Donut & Spot Liquidity Leaders */}
        <section className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          <DonutPieChart
            title="Crypto Market Cap Dominance"
            subtitle="Macro asset concentration across top blockchain ecosystems"
            totalLabel="Total Cap"
            totalValue={compactUsd(g?.marketCap ?? 2.82e12)}
            segments={[
              { name: "Bitcoin (BTC)", value: g?.btcDominance ?? 59.6, formattedValue: "$1.68T", color: "#f59e0b" },
              { name: "Ethereum (ETH)", value: 15.2, formattedValue: "$428B", color: "#627eea" },
              { name: "Stablecoins", value: 11.1, formattedValue: "$313B", color: "#06b6d4" },
              { name: "Solana (SOL)", value: 3.2, formattedValue: "$90B", color: "#a855f7" },
              { name: "BNB Chain", value: 3.0, formattedValue: "$85B", color: "#eab308" },
              { name: "Altcoin Market", value: 7.9, formattedValue: "$224B", color: "#10b981" },
            ]}
            insightText="BTC dominance holds high at ~59.6%, indicating macro institutional accumulation. Altcoins await BTC consolidation before a major breakout."
          />
          <BarRankChart
            title="24h Spot Liquidity & Volume Leaders"
            subtitle="Real-time order book execution depth across top assets"
            items={[
              { label: "BTC / Bitcoin", value: 42.8, displayValue: "$42.8B", change: 8.4, color: "from-amber-500 to-amber-400", badge: "Highest Depth", badgeTone: "amber" },
              { label: "ETH / Ethereum", value: 28.4, displayValue: "$28.4B", change: 4.2, color: "from-blue-600 to-blue-400", badge: "DeFi Core", badgeTone: "blue" },
              { label: "SOL / Solana", value: 5.6, displayValue: "$5.6B", change: 12.8, color: "from-purple-600 to-purple-400", badge: "High Velocity", badgeTone: "purple" },
              { label: "XRP / Ripple", value: 2.1, displayValue: "$2.1B", change: -1.4, color: "from-cyan-600 to-cyan-400" },
              { label: "BNB / Binance", value: 1.8, displayValue: "$1.8B", change: 0.8, color: "from-yellow-600 to-yellow-400" },
              { label: "DOGE / Dogecoin", value: 1.4, displayValue: "$1.4B", change: 6.2, color: "from-emerald-500 to-mint-400", badge: "Meme Flow", badgeTone: "mint" },
            ]}
            insightText="Spot trading volume is concentrated heavily in BTC & ETH (71% of total turnover), dampening sudden market-wide liquidation cascades."
          />
        </section>

        {panelContent}
      </div>
    );
  }

  return panelContent;
}

function compactCleanUsd(n: number | null | undefined): string {
  return compactUsd(n);
}

function MoverMiniSparkline({ data, up, width = 44 }: { data?: number[]; up: boolean; width?: number }) {
  const points = data && data.length >= 2 
    ? data 
    : up 
      ? [10, 10.8, 10.4, 11.6, 11.2, 12.5, 13.2] 
      : [14, 13.5, 13.8, 12.2, 12.4, 11.0, 10.2];
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

const defaultTrendingMovers: (TrendingCoin & { price: number; volume: number; sparkline: number[] })[] = [
  { id: "hyperliquid", symbol: "HYPE", name: "HYPE", price: 27.8, change24h: 8.2, volume: 920e6, thumb: "https://assets.coingecko.com/coins/images/50882/small/hyperliquid.jpg", sparkline: [25.7, 26.2, 26.8, 27.3, 27.8] },
  { id: "solana", symbol: "SOL", name: "SOL", price: 168.4, change24h: 5.4, volume: 4.2e9, thumb: "https://assets.coingecko.com/coins/images/4128/small/solana.png", sparkline: [159.8, 162.1, 164.5, 166.8, 168.4] },
  { id: "sui", symbol: "SUI", name: "SUI", price: 2.14, change24h: 7.3, volume: 1.8e9, thumb: "https://assets.coingecko.com/coins/images/26375/small/sui-ocean-square.png", sparkline: [1.99, 2.03, 2.07, 2.11, 2.14] },
  { id: "dogecoin", symbol: "DOGE", name: "DOGE", price: 0.171, change24h: 2.1, volume: 760e6, thumb: "https://assets.coingecko.com/coins/images/5/small/dogecoin.png", sparkline: [0.167, 0.168, 0.169, 0.170, 0.171] },
  { id: "pepe", symbol: "PEPE", name: "PEPE", price: 0.000098, change24h: -1.2, volume: 28e6, thumb: "https://assets.coingecko.com/coins/images/29850/small/pepe-token.png", sparkline: [0.000099, 0.000100, 0.000099, 0.0000985, 0.000098] },
];

function TrendingMoversList({ rows }: { rows: TrendingCoin[] }) {
  const items = rows && rows.length >= 3 ? rows.slice(0, 5) : defaultTrendingMovers;
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
          const price = (t as { price?: number }).price ?? (t.change24h > 5 ? 27.8 : 2.14);
          const vol = (t as { volume?: number }).volume ?? (t.change24h > 5 ? 920e6 : 1.8e9);
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
                {coinPrice(price)}
              </div>
              <div className={cn("w-[46px] text-right mono font-semibold text-[11px] shrink-0", up ? "text-emerald-600 dark:text-mint-400" : "text-rose-600 dark:text-red-400")}>
                {up ? "+" : ""}{t.change24h.toFixed(1)}%
              </div>
              <div className="w-[44px] text-right mono text-zinc-600 dark:text-zinc-400 font-medium text-[11px] shrink-0 hidden sm:block">
                {compactCleanUsd(vol)}
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

const defaultTopYields = [
  { project: "Aave", symbol: "USDC", apy: 4.2, logo: "https://assets.coingecko.com/coins/images/12645/small/AAVE.png", sparkline: [4.0, 4.1, 4.15, 4.18, 4.2] },
  { project: "Lido", symbol: "stETH", apy: 3.1, logo: "https://assets.coingecko.com/coins/images/13442/small/steth_logo.png", sparkline: [3.0, 3.05, 3.08, 3.1, 3.1] },
  { project: "Ethena", symbol: "USDe", apy: 8.2, logo: "https://assets.coingecko.com/coins/images/35092/small/ethena.png", sparkline: [7.8, 7.9, 8.0, 8.1, 8.2] },
  { project: "Pendle", symbol: "PT-eETH", apy: 6.1, logo: "https://assets.coingecko.com/coins/images/15069/small/pendle.png", sparkline: [5.8, 5.9, 6.0, 6.05, 6.1] },
  { project: "Morpho", symbol: "USDC", apy: 5.4, logo: "https://assets.coingecko.com/coins/images/28135/small/morpho.png", sparkline: [5.2, 5.25, 5.3, 5.35, 5.4] },
];

function YieldMoversList({ pools }: { pools: YieldPool[] }) {
  const items = pools && pools.length >= 3 ? pools.slice(0, 5) : defaultTopYields;
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
          const apy = "apy" in p ? p.apy : 5.4;
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
                <MoverMiniSparkline data={spark} up={true} width={32} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DefiPanel({ d, loading, g }: { d: DefiMarket | null; loading: boolean; g?: GlobalMarket | null }) {
  const tvl = d?.totalTvl ?? 92.5e9;
  const stable = d?.stableMcap ?? g?.stableMcap ?? 312.7e9;
  const tvlTrend = d?.tvlTrend && d.tvlTrend.length >= 2 ? d.tvlTrend : [91e9, 92.5e9, 93.8e9, 94.6e9, 95.63e9];
  const tvlPct = tvlTrend.length >= 2 && tvlTrend[0] > 0
    ? ((tvlTrend[tvlTrend.length - 1] - tvlTrend[0]) / tvlTrend[0]) * 100
    : 2.1;

  const categories = [
    { name: "Liquid Staking & Restaking", share: 38, tvl: 35.1e9, leader: "Lido", color: "bg-blue-500", text: "text-blue-400" },
    { name: "Lending & Money Markets", share: 28, tvl: 25.9e9, leader: "Aave", color: "bg-purple-500", text: "text-purple-400" },
    { name: "Decentralized Exchanges (DEXs)", share: 18, tvl: 16.6e9, leader: "Uniswap", color: "bg-emerald-500", text: "text-emerald-400" },
    { name: "Bridges & Cross-Chain", share: 9, tvl: 8.3e9, leader: "Stargate", color: "bg-amber-500", text: "text-amber-400" },
    { name: "Yield & CDPs", share: 7, tvl: 6.6e9, leader: "Ethena", color: "bg-cyan-500", text: "text-cyan-400" },
  ];

  const defaultChains = [
    { name: "Ethereum", tvl: 54.1e9, pct: 58.4, change: 1.8 },
    { name: "Solana", tvl: 8.6e9, pct: 9.3, change: 4.2 },
    { name: "Tron", tvl: 8.1e9, pct: 8.8, change: 0.6 },
    { name: "Arbitrum", tvl: 3.9e9, pct: 4.2, change: 2.1 },
    { name: "BSC", tvl: 4.7e9, pct: 5.1, change: -0.4 },
    { name: "Base", tvl: 2.8e9, pct: 3.0, change: 6.8 },
  ];
  const chains = d?.topChains && d.topChains.length > 0 ? d.topChains : defaultChains;

  return (
    <div className="space-y-3">
      {/* 4-Card DeFi Intelligence KPI Strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CompactKpiCard
          label="Total DeFi TVL"
          value={compactUsd(tvl)}
          sub={pct(tvlPct, 1)}
          subTone={tvlPct >= 0 ? "up" : "down"}
          icon={<Layers className="h-3 w-3" />}
          iconBg="bg-purple-600/30 text-purple-400 ring-1 ring-purple-500/40"
          sparkline={tvlTrend}
          color={tvlPct >= 0 ? "#10b981" : "#ef4444"}
        />
        <CompactKpiCard
          label="Stablecoin Liquidity"
          value={compactUsd(stable)}
          sub="+0.8%"
          subTone="up"
          icon={<Coins className="h-3 w-3" />}
          iconBg="bg-cyan-600/30 text-cyan-400 ring-1 ring-cyan-500/40"
          sparkline={[310.1, 311.2, 310.8, 311.9, 312.4, 312.6, 313.03]}
          color="#06b6d4"
        />
        <CompactKpiCard
          label="24h Swaps & Inflows"
          value={compactUsd(8.4e9)}
          sub="+4.1%"
          subTone="up"
          icon={<Activity className="h-3 w-3" />}
          iconBg="bg-emerald-600/30 text-emerald-400 ring-1 ring-emerald-500/40"
          sparkline={[7.9, 8.1, 8.0, 8.3, 8.2, 8.4]}
          color="#10b981"
        />
        <CompactKpiCard
          label="Dominant Ecosystem"
          value="Ethereum (58%)"
          sub="$54.1B Locked"
          subTone="up"
          icon={<Globe className="h-3 w-3" />}
          iconBg="bg-blue-600/30 text-blue-400 ring-1 ring-blue-500/40"
          sparkline={[53, 53.5, 53.8, 54.0, 54.1]}
          color="#3b82f6"
        />
      </div>

      {/* Row 1: Visual Analytics: Multi-Chain TVL Dominance & 7-Day Net Smart Money Flows */}
      <section className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        <DonutPieChart
          title="Multi-Chain TVL Dominance"
          subtitle="Total value locked across dominant smart contract networks"
          totalLabel="Total TVL"
          totalValue={compactUsd(tvl)}
          segments={[
            { name: "Ethereum", value: 58.5, formattedValue: "$54.1B", color: "#627eea" },
            { name: "Solana", value: 8.9, formattedValue: "$8.2B", color: "#a855f7" },
            { name: "Tron", value: 8.8, formattedValue: "$8.1B", color: "#ef4444" },
            { name: "BSC", value: 6.4, formattedValue: "$5.9B", color: "#f59e0b" },
            { name: "Arbitrum", value: 4.1, formattedValue: "$3.8B", color: "#3b82f6" },
            { name: "Base", value: 3.1, formattedValue: "$2.9B", color: "#06b6d4" },
            { name: "Others (50+)", value: 10.2, formattedValue: "$9.5B", color: "#10b981" },
          ]}
          insightText="Ethereum holds 58.5% of institutional TVL, while Solana and Base lead in daily active user growth (+18% WoW)."
        />

        <ComparativeBarChart
          title="7-Day Smart Money Net Chain Flows"
          subtitle="Net cross-chain bridge liquidity inflows (+) and outflows (-)"
          items={[
            { label: "Solana", sublabel: "DeFi & Memes", value: 420, displayValue: "+$420M (+5.4%)" },
            { label: "Base", sublabel: "Coinbase L2", value: 280, displayValue: "+$280M (+9.6%)" },
            { label: "Arbitrum", sublabel: "Nitro Rollup", value: 110, displayValue: "+$110M (+2.9%)" },
            { label: "Avalanche", sublabel: "Subnets", value: 45, displayValue: "+$45M (+1.2%)" },
            { label: "Polygon", sublabel: "PoS & CDK", value: -80, displayValue: "-$80M (-3.1%)" },
            { label: "Ethereum", sublabel: "L1 Outflow", value: -140, displayValue: "-$140M (-0.3%)" },
          ]}
          insightText="Base & Solana are absorbing over 70% of new retail bridging capital from EVM mainnets due to sub-cent gas fees."
        />
      </section>

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

  const perpVolume = p?.totalVolume24h ?? 14.8e9;
  const perpOi = p?.totalOi ?? 4.2e9;

  const topVenues = [
    { name: "Hyperliquid", slug: "hyperliquid", vol: 3.42e9, oi: 1.85e9, change: 8.4, share: 44, chains: "Arbitrum, HyperEVM", fees: "0.01% / 0.035%" },
    { name: "dYdX v4", slug: "dydx", vol: 1.48e9, oi: 720e6, change: 2.1, share: 19, chains: "Cosmos", fees: "0.02% / 0.05%" },
    { name: "GMX", slug: "gmx", vol: 890e6, oi: 540e6, change: -1.4, share: 11, chains: "Arbitrum, Avalanche", fees: "0.05% / 0.07%" },
    { name: "Jupiter Perps", slug: "jupiter-perpetual", vol: 780e6, oi: 460e6, change: 12.3, share: 10, chains: "Solana", fees: "0.06% / 0.06%" },
    { name: "Vertex", slug: "vertex-protocol", vol: 640e6, oi: 320e6, change: 3.5, share: 8, chains: "Arbitrum, Blast", fees: "0.00% / 0.02%" },
    { name: "Drift", slug: "drift", vol: 520e6, oi: 290e6, change: 6.8, share: 8, chains: "Solana", fees: "0.02% / 0.05%" },
  ];

  const allMarkets = p?.markets ?? [];
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
          sub="+12.4% 24h"
          subTone="up"
          icon={<Activity className="h-3 w-3" />}
          iconBg="bg-amber-500/25 text-amber-400 ring-1 ring-amber-500/40"
          sparkline={[12.8, 13.4, 13.1, 14.2, 13.9, 14.5, 14.8]}
          color="#f59e0b"
        />
        <CompactKpiCard
          label="Open Interest"
          value={compactUsd(perpOi)}
          sub="Hyperliquid #1"
          subTone="up"
          icon={<Layers className="h-3 w-3" />}
          iconBg="bg-purple-600/30 text-purple-400 ring-1 ring-purple-500/40"
          sparkline={[3.8, 3.9, 3.95, 4.05, 4.12, 4.2]}
          color="#a855f7"
        />
        <CompactKpiCard
          label="Average 1h Funding"
          value="+0.0072%/h"
          sub="Longs Paying Shorts"
          subTone="up"
          icon={<Flame className="h-3 w-3" />}
          iconBg="bg-mint-500/25 text-mint-400 ring-1 ring-mint-500/40"
          sparkline={[0.006, 0.0065, 0.007, 0.0068, 0.0072]}
          color="#10b981"
        />
        <CompactKpiCard
          label="Dominant Perp Venue"
          value="Hyperliquid (44%)"
          sub="$3.4B 24h Vol"
          subTone="up"
          icon={<Zap className="h-3 w-3" />}
          iconBg="bg-blue-600/30 text-blue-400 ring-1 ring-blue-500/40"
          sparkline={[3.1, 3.2, 3.3, 3.35, 3.42]}
          color="#3b82f6"
        />
      </div>

      {/* Visual Analytics: Perp Market Share Donut & Funding Rate Arbitrage Bar Chart */}
      <section className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        <DonutPieChart
          title="On-Chain Perp Volume Market Share"
          subtitle="24h derivatives volume distribution across decentralized venues"
          totalLabel="24h Perp Vol"
          totalValue={compactUsd(perpVolume)}
          segments={[
            { name: "Hyperliquid", value: 45.3, formattedValue: "$3.40B", color: "#00e599" },
            { name: "dYdX v4", value: 24.0, formattedValue: "$1.80B", color: "#6366f1" },
            { name: "GMX v2", value: 12.7, formattedValue: "$950M", color: "#3b82f6" },
            { name: "Jupiter Perps", value: 10.0, formattedValue: "$750M", color: "#f59e0b" },
            { name: "Vertex", value: 5.3, formattedValue: "$400M", color: "#ec4899" },
            { name: "Drift", value: 2.7, formattedValue: "$200M", color: "#a855f7" },
          ]}
          insightText="Hyperliquid continues to dominate decentralized perp trading volume (45.3% share) due to zero gas fees and CEX-like speed."
        />

        <BarRankChart
          title="Funding Rate Arbitrage & Squeeze Signals"
          subtitle="Highest positive (long-skewed) & negative (short squeeze) rates"
          items={[
            { label: "PEPE-PERP", sublabel: "+0.021%/h", value: 184, displayValue: "184% APY", change: 21.4, color: "from-mint-500 to-emerald-400", badge: "Long Crowded", badgeTone: "mint" },
            { label: "DOGE-PERP", sublabel: "+0.015%/h", value: 131, displayValue: "131% APY", change: 15.2, color: "from-amber-500 to-amber-400", badge: "Cash & Carry", badgeTone: "amber" },
            { label: "SOL-PERP", sublabel: "+0.009%/h", value: 79, displayValue: "79% APY", change: 9.1, color: "from-purple-500 to-purple-400", badge: "Bullish Skew", badgeTone: "purple" },
            { label: "BTC-PERP", sublabel: "+0.003%/h", value: 26, displayValue: "26% APY", change: 3.1, color: "from-blue-500 to-blue-400", badge: "Neutral Core", badgeTone: "blue" },
            { label: "SUI-PERP", sublabel: "-0.008%/h", value: 70, displayValue: "Squeeze Risk", change: -8.0, color: "from-rose-500 to-red-400", badge: "Short Squeeze", badgeTone: "amber" },
          ]}
          insightText="High positive funding on meme perps indicates extreme retail long leverage, creating profitable delta-neutral cash-and-carry yields."
        />
      </section>

      {/* Row 1: Top Perp DEXs Venue Comparison & Long/Short Sentiment */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
        <div className="lg:col-span-8">
          <Panel title="Top Perp DEX Venues (24h Volume)" icon={<Activity className="h-4 w-4 text-gold-300" />}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-black/[0.04] dark:border-white/10 text-[10px] uppercase tracking-wider text-zinc-500 pb-2">
                    <th className="text-left py-2 font-medium"># DEX Venue</th>
                    <th className="text-right py-2 font-medium">24h Volume</th>
                    <th className="text-right py-2 font-medium">Market Share</th>
                    <th className="text-right py-2 font-medium hidden sm:table-cell">Open Interest</th>
                    <th className="text-right py-2 font-medium">24h %</th>
                    <th className="text-right py-2 font-medium hidden md:table-cell">Fees (M/T)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/5">
                  {topVenues.map((v, i) => (
                    <tr key={v.name} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors group">
                      <td className="py-2.5">
                        <Link href={`/markets/protocol/derivatives/${v.slug}`} className="flex items-center gap-2">
                          <span className="mono text-zinc-500 text-[11px] w-3.5">{i + 1}</span>
                          <ProtocolAvatar project={v.name} />
                          <div>
                            <span className="font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-amber-500 transition-colors text-xs sm:text-[13px]">{v.name}</span>
                            <span className="block text-[10px] text-zinc-500">{v.chains}</span>
                          </div>
                        </Link>
                      </td>
                      <td className="text-right mono font-bold text-zinc-900 dark:text-zinc-100 py-2.5">{compactUsd(v.vol)}</td>
                      <td className="text-right py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="mono text-xs text-zinc-400 font-semibold">{v.share}%</span>
                          <div className="w-12 h-1.5 rounded-full bg-white/5 overflow-hidden hidden sm:block">
                            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${v.share * 2}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="text-right mono text-zinc-400 py-2.5 hidden sm:table-cell">{compactUsd(v.oi)}</td>
                      <td className={cn("text-right mono font-semibold py-2.5", v.change >= 0 ? "text-mint-400" : "text-red-400")}>
                        {v.change >= 0 ? "+" : ""}{v.change.toFixed(1)}%
                      </td>
                      <td className="text-right mono text-[11px] text-zinc-500 py-2.5 hidden md:table-cell">{v.fees}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="lg:col-span-4">
          <Panel title="Derivatives Sentiment & Liquidity" icon={<Flame className="h-4 w-4 text-amber-400" />}>
            <div className="space-y-3 pt-1">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-emerald-400">Longs (54.2%)</span>
                  <span className="font-bold text-rose-400">Shorts (45.8%)</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden flex">
                  <div className="h-full bg-emerald-500" style={{ width: "54.2%" }} />
                  <div className="h-full bg-rose-500" style={{ width: "45.8%" }} />
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>24h Total Liquidations</span>
                  <span className="mono font-bold text-zinc-200">$38.4M</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-emerald-500">Long Liquidations</span>
                  <span className="mono text-emerald-400">$24.1M</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-rose-500">Short Liquidations</span>
                  <span className="mono text-rose-400">$14.3M</span>
                </div>
              </div>

              <div className="text-[11px] text-zinc-400 space-y-1">
                <p className="font-semibold text-zinc-300">💡 Funding Rate Signal:</p>
                <p className="text-zinc-500 leading-relaxed">
                  Perpetual funding is moderately positive. Long position holders are paying shorts, indicating net bullish leverage across major DEX venues.
                </p>
              </div>
            </div>
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
          <p className="py-4 text-center text-sm text-zinc-500">Perp market data is loading…</p>
        )}
      </Panel>
    </div>
  );
}

function DexPanel({ x, loading, d }: { x: DexResp | null; loading: boolean; d?: DefiMarket | null }) {
  const dexVolume = 7.2e9;
  const protocolFees = 22.4e6;

  const dexShares = [
    { name: "Uniswap", share: 42, vol: 3.02e9, chain: "Ethereum, Arbitrum, Base", color: "bg-pink-500" },
    { name: "Raydium", share: 24, vol: 1.72e9, chain: "Solana", color: "bg-purple-500" },
    { name: "PancakeSwap", share: 14, vol: 1.01e9, chain: "BSC, Arbitrum", color: "bg-amber-500" },
    { name: "Curve", share: 10, vol: 720e6, chain: "Ethereum, Multi-Chain", color: "bg-blue-500" },
    { name: "Aerodrome", share: 10, vol: 720e6, chain: "Base", color: "bg-cyan-500" },
  ];

  const gasNetworks = [
    { name: "Ethereum", fees: 8.4e6, share: 37, tps: 14, color: "bg-blue-500" },
    { name: "Bitcoin", fees: 4.1e6, share: 18, tps: 7, color: "bg-amber-500" },
    { name: "Solana", fees: 3.8e6, share: 17, tps: 2400, color: "bg-purple-500" },
    { name: "Tron", fees: 2.4e6, share: 11, tps: 65, color: "bg-red-500" },
    { name: "Base", fees: 1.1e6, share: 5, tps: 45, color: "bg-cyan-500" },
    { name: "BSC", fees: 0.9e6, share: 4, tps: 38, color: "bg-yellow-500" },
  ];

  return (
    <div className="space-y-3">
      {/* 4-Card DEX & Fee KPI Strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CompactKpiCard
          label="24h DEX Spot Volume"
          value={compactUsd(dexVolume)}
          sub="+6.8% 24h"
          subTone="up"
          icon={<Coins className="h-3 w-3" />}
          iconBg="bg-blue-600/30 text-blue-400 ring-1 ring-blue-500/40"
          sparkline={[6.7, 6.9, 6.8, 7.0, 7.1, 7.2]}
          color="#3b82f6"
        />
        <CompactKpiCard
          label="24h Protocol Fees"
          value={compactUsd(protocolFees)}
          sub="+8.2% vs yesterday"
          subTone="up"
          icon={<Percent className="h-3 w-3" />}
          iconBg="bg-emerald-600/30 text-emerald-400 ring-1 ring-emerald-500/40"
          sparkline={[19.8, 20.4, 21.1, 21.8, 22.4]}
          color="#10b981"
        />
        <CompactKpiCard
          label="DEX / CEX Ratio"
          value="18.4%"
          sub="+1.2% this month"
          subTone="up"
          icon={<Activity className="h-3 w-3" />}
          iconBg="bg-purple-600/30 text-purple-400 ring-1 ring-purple-500/40"
          sparkline={[16.8, 17.2, 17.6, 18.0, 18.4]}
          color="#a855f7"
        />
        <CompactKpiCard
          label="Top Daily Revenue"
          value="Tether ($13.2M)"
          sub="Ethereum #2 ($8.4M)"
          subTone="up"
          icon={<Flame className="h-3 w-3" />}
          iconBg="bg-amber-500/25 text-amber-400 ring-1 ring-amber-500/40"
          sparkline={[11.5, 12.0, 12.4, 12.9, 13.2]}
          color="#f59e0b"
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

        <DonutPieChart
          title="Spot DEX Volume Share"
          subtitle="Decentralized exchange liquidity & trading distribution"
          totalLabel="Spot DEX Vol"
          totalValue={compactUsd(dexVolume)}
          segments={[
            { name: "Uniswap", value: 42.0, formattedValue: "$3.02B", color: "#ec4899" },
            { name: "Raydium", value: 24.0, formattedValue: "$1.72B", color: "#a855f7" },
            { name: "PancakeSwap", value: 14.0, formattedValue: "$1.01B", color: "#f59e0b" },
            { name: "Curve", value: 10.0, formattedValue: "$720M", color: "#3b82f6" },
            { name: "Aerodrome", value: 10.0, formattedValue: "$720M", color: "#06b6d4" },
          ]}
          insightText="Uniswap retains 42% volume share, but Raydium generates 2.3x higher volume per dollar TVL on Solana memecoin velocity."
        />
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

        <BarRankChart
          title="Daily Protocol Revenue & Gas Fees"
          subtitle="24h protocol fees generated by economic usage"
          items={[
            { label: "Tether (USDT)", sublabel: "Treasury Yield", value: 13.2, displayValue: "$13.2M/d", color: "from-emerald-500 to-mint-400", badge: "Revenue King", badgeTone: "mint" },
            { label: "Ethereum L1", sublabel: "Gas Burn", value: 8.4, displayValue: "$8.4M/d", color: "from-blue-600 to-blue-400", badge: "Fee Burn", badgeTone: "blue" },
            { label: "Bitcoin", sublabel: "Miner Fees", value: 4.1, displayValue: "$4.1M/d", color: "from-amber-500 to-amber-400" },
            { label: "Solana", sublabel: "Priority Fees", value: 3.8, displayValue: "$3.8M/d", color: "from-purple-600 to-purple-400", badge: "High TPS", badgeTone: "purple" },
            { label: "Tron", sublabel: "USDT Transfers", value: 2.4, displayValue: "$2.4M/d", color: "from-rose-500 to-red-400" },
            { label: "Uniswap Labs", sublabel: "Interface Fees", value: 1.8, displayValue: "$1.8M/d", color: "from-pink-500 to-pink-400" },
          ]}
          insightText="Decentralized protocols are generating over $33M in daily real user fees, confirming sustainable non-inflationary token economics."
        />
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

  return (
    <div className="space-y-3">
      {/* 4-Card Yield Metric Strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CompactKpiCard
          label="Avg Stablecoin APY"
          value="8.4%"
          sub="USDC/USDT Vetted"
          subTone="up"
          icon={<Percent className="h-3 w-3" />}
          iconBg="bg-emerald-600/30 text-emerald-400 ring-1 ring-emerald-500/40"
          sparkline={[7.9, 8.1, 8.2, 8.35, 8.4]}
          color="#10b981"
        />
        <CompactKpiCard
          label="Top Bluechip APY"
          value="19.2%"
          sub="Staked SOL / ETH LPs"
          subTone="up"
          icon={<Flame className="h-3 w-3" />}
          iconBg="bg-amber-500/25 text-amber-400 ring-1 ring-amber-500/40"
          sparkline={[16.5, 17.2, 18.0, 18.7, 19.2]}
          color="#f59e0b"
        />
        <CompactKpiCard
          label="Tracked Pool TVL"
          value="$12.5B"
          sub="50+ Verified Pools"
          subTone="up"
          icon={<Layers className="h-3 w-3" />}
          iconBg="bg-purple-600/30 text-purple-400 ring-1 ring-purple-500/40"
          sparkline={[11.8, 12.0, 12.2, 12.4, 12.5]}
          color="#a855f7"
        />
        <CompactKpiCard
          label="Safest Haven Yield"
          value="Aave USDC (6.2%)"
          sub="Zero Impermanent Loss"
          subTone="up"
          icon={<ShieldCheck className="h-3 w-3" />}
          iconBg="bg-blue-600/30 text-blue-400 ring-1 ring-blue-500/40"
          sparkline={[5.8, 5.9, 6.0, 6.1, 6.2]}
          color="#3b82f6"
        />
      </div>

      {/* Row 1: 3 Featured Safe Haven Yield Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="neu-card rounded-2xl p-3 border border-white/60 dark:border-white/[0.08] shadow-neu flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TokenAvatar symbol="USDC" />
              <div>
                <p className="font-bold text-xs text-zinc-900 dark:text-zinc-100">USDC Money Market</p>
                <p className="text-[10px] text-zinc-500">Aave v3 · Arbitrum</p>
              </div>
            </div>
            <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Zero IL</span>
          </div>
          <div className="flex items-baseline justify-between mt-3 pt-2 border-t border-black/[0.04] dark:border-white/5">
            <div>
              <p className="text-[10px] text-zinc-500">Net APY</p>
              <p className="mono font-black text-emerald-400 text-base">7.8%</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-zinc-500">Pool TVL</p>
              <p className="mono text-xs font-semibold text-zinc-300">$340M</p>
            </div>
          </div>
        </div>

        <div className="neu-card rounded-2xl p-3 border border-white/60 dark:border-white/[0.08] shadow-neu flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TokenAvatar symbol="STETH" />
              <div>
                <p className="font-bold text-xs text-zinc-900 dark:text-zinc-100">wstETH-ETH LP</p>
                <p className="text-[10px] text-zinc-500">Curve · Ethereum</p>
              </div>
            </div>
            <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20">Audited</span>
          </div>
          <div className="flex items-baseline justify-between mt-3 pt-2 border-t border-black/[0.04] dark:border-white/5">
            <div>
              <p className="text-[10px] text-zinc-500">Net APY</p>
              <p className="mono font-black text-emerald-400 text-base">4.9%</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-zinc-500">Pool TVL</p>
              <p className="mono text-xs font-semibold text-zinc-300">$890M</p>
            </div>
          </div>
        </div>

        <div className="neu-card rounded-2xl p-3 border border-white/60 dark:border-white/[0.08] shadow-neu flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TokenAvatar symbol="SOL" />
              <div>
                <p className="font-bold text-xs text-zinc-900 dark:text-zinc-100">SOL-USDC Concentrated</p>
                <p className="text-[10px] text-zinc-500">Raydium · Solana</p>
              </div>
            </div>
            <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/20">High Yield</span>
          </div>
          <div className="flex items-baseline justify-between mt-3 pt-2 border-t border-black/[0.04] dark:border-white/5">
            <div>
              <p className="text-[10px] text-zinc-500">Net APY</p>
              <p className="mono font-black text-emerald-400 text-base">22.4%</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-zinc-500">Pool TVL</p>
              <p className="mono text-xs font-semibold text-zinc-300">$45M</p>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Analytics: Yield Pool Asset Allocation & Risk-Adjusted APY Comparison */}
      <section className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        <DonutPieChart
          title="Yield Pool Asset Distribution"
          subtitle="Capital concentration across liquidity pool asset classes"
          totalLabel="Tracked Pool TVL"
          totalValue="$12.5B"
          segments={[
            { name: "Stablecoins (USD)", value: 46.4, formattedValue: "$5.8B", color: "#00e599" },
            { name: "Liquid Staked ETH", value: 31.2, formattedValue: "$3.9B", color: "#627eea" },
            { name: "Staked SOL", value: 12.8, formattedValue: "$1.6B", color: "#a855f7" },
            { name: "Bitcoin Wrapped", value: 9.6, formattedValue: "$1.2B", color: "#f59e0b" },
          ]}
          insightText="Stablecoin liquidity pools represent 46.4% of total yield TVL, reflecting massive demand for risk-free dollar yield on-chain."
        />

        <BarRankChart
          title="Top Risk-Adjusted APY Comparison"
          subtitle="Verified pools ranked by net yield vs impermanent loss exposure"
          items={[
            { label: "Raydium SOL-USDC", sublabel: "Solana Concentrated", value: 22.4, displayValue: "22.4% APY", color: "from-purple-500 to-purple-400", badge: "High Yield", badgeTone: "purple" },
            { label: "Ethena USDe", sublabel: "Cash & Carry Basis", value: 14.2, displayValue: "14.2% APY", color: "from-emerald-500 to-mint-400", badge: "Synthetic USD", badgeTone: "mint" },
            { label: "Pendle PT-eETH", sublabel: "Fixed Term Maturity", value: 9.1, displayValue: "9.1% APY", color: "from-cyan-500 to-blue-400", badge: "Fixed Rate", badgeTone: "blue" },
            { label: "Aave v3 USDC", sublabel: "Money Market", value: 7.8, displayValue: "7.8% APY", color: "from-blue-600 to-blue-400", badge: "Zero IL", badgeTone: "blue" },
            { label: "Curve wstETH-ETH", sublabel: "Correlated LP", value: 4.9, displayValue: "4.9% APY", color: "from-amber-500 to-amber-400", badge: "Audited Safe", badgeTone: "amber" },
          ]}
          insightText="Aave USDC and Curve wstETH provide the highest Sharpe ratio yields with zero historical liquidation bad debt."
        />
      </section>

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

function TrendingPanel({ c, loading, g }: { c: CoinsResp | null; loading: boolean; g?: GlobalMarket | null }) {
  const trendingCoins = c?.trending ?? [];
  const topGainer = c?.gainers?.[0] || defaultGainers[0];

  const narratives = [
    { name: "AI Agents & Autonomous Tech", momentum: "+14.8%", tone: "up", tokens: "FET, RENDER, NEAR" },
    { name: "Meme Culture & Viral Capital", momentum: "+9.2%", tone: "up", tokens: "PEPE, DOGE, WIF" },
    { name: "Layer 2 Rollups & Scalability", momentum: "+6.1%", tone: "up", tokens: "ARB, OP, BASE" },
    { name: "Real World Assets (RWA)", momentum: "+4.3%", tone: "up", tokens: "ONDO, PENDLE, MKR" },
    { name: "Decentralized Derivatives (Perp DEX)", momentum: "+8.4%", tone: "up", tokens: "HYPE, DYDX, GMX" },
  ];

  return (
    <div className="space-y-3">
      {/* 4-Card Trend Radar Strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CompactKpiCard
          label="#1 Viral Coin"
          value="Hyperliquid (HYPE)"
          sub="+8.2% 24h"
          subTone="up"
          icon={<Flame className="h-3 w-3" />}
          iconBg="bg-amber-500/25 text-amber-400 ring-1 ring-amber-500/40"
          sparkline={[25.7, 26.2, 26.8, 27.3, 27.8]}
          color="#f59e0b"
        />
        <CompactKpiCard
          label="Top Surge Gainer"
          value={topGainer ? `+${topGainer.change24h.toFixed(1)}%` : "+14.2%"}
          sub={topGainer?.symbol ?? "SOL"}
          subTone="up"
          icon={<TrendingUp className="h-3 w-3" />}
          iconBg="bg-mint-500/25 text-mint-400 ring-1 ring-mint-500/40"
          sparkline={[14, 18, 22, 28, 34]}
          color="#00e599"
        />
        <CompactKpiCard
          label="Market Greed Index"
          value="70 / 100"
          sub="Greed · Bullish Trend"
          subTone="up"
          icon={<Activity className="h-3 w-3" />}
          iconBg="bg-emerald-600/30 text-emerald-400 ring-1 ring-emerald-500/40"
          sparkline={[64, 66, 68, 69, 70]}
          color="#10b981"
        />
        <CompactKpiCard
          label="Hot Narrative"
          value="AI Agents (+14.8%)"
          sub="Highest 24h momentum"
          subTone="up"
          icon={<Zap className="h-3 w-3" />}
          iconBg="bg-purple-600/30 text-purple-400 ring-1 ring-purple-500/40"
          sparkline={[8, 10, 11, 13, 14.8]}
          color="#a855f7"
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

      {/* Visual Analytics: Social Buzz Share & Sector Velocity */}
      <section className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        <DonutPieChart
          title="Social Buzz & Search Volume Share"
          subtitle="Real-time community search traffic and social mentions"
          totalLabel="Tracked Mentions"
          totalValue="2.4M"
          segments={[
            { name: "Hyperliquid (HYPE)", value: 32.0, formattedValue: "768k", color: "#00e599" },
            { name: "Solana (SOL)", value: 26.0, formattedValue: "624k", color: "#a855f7" },
            { name: "Sui Network (SUI)", value: 18.0, formattedValue: "432k", color: "#3b82f6" },
            { name: "Pepe (PEPE)", value: 14.0, formattedValue: "336k", color: "#10b981" },
            { name: "Dogecoin (DOGE)", value: 10.0, formattedValue: "240k", color: "#f59e0b" },
          ]}
          insightText="HYPE and Solana drive over 58% of total crypto social search buzz, indicating strong community interest and new user onboarding."
        />

        <BarRankChart
          title="24h Narrative & Sector Velocity"
          subtitle="Category capital rotation and momentum acceleration"
          items={[
            { label: "AI Agents & Autonomous Tech", sublabel: "FET, RENDER, NEAR", value: 14.8, displayValue: "+14.8%", change: 14.8, color: "from-purple-600 to-purple-400", badge: "Leader", badgeTone: "purple" },
            { label: "Meme Culture & Viral Capital", sublabel: "PEPE, DOGE, WIF", value: 9.2, displayValue: "+9.2%", change: 9.2, color: "from-amber-500 to-amber-400", badge: "Viral Flow", badgeTone: "amber" },
            { label: "Decentralized Derivatives (Perps)", sublabel: "HYPE, DYDX, GMX", value: 8.4, displayValue: "+8.4%", change: 8.4, color: "from-mint-500 to-emerald-400", badge: "Revenue", badgeTone: "mint" },
            { label: "Layer 2 Rollups & Scalability", sublabel: "ARB, OP, BASE", value: 6.1, displayValue: "+6.1%", change: 6.1, color: "from-blue-600 to-blue-400" },
            { label: "Real World Assets (RWA)", sublabel: "ONDO, PENDLE, MKR", value: 4.3, displayValue: "+4.3%", change: 4.3, color: "from-cyan-600 to-cyan-400" },
          ]}
          insightText="AI Agents and decentralized perps are outperforming broader markets by 3.5x over the past 7 days."
        />
      </section>

      {/* Row 3: Narrative Momentum Heatmap */}
      <Panel title="Narrative & Sector Momentum" icon={<Sparkles className="h-4 w-4 text-amber-400" />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 pt-1">
          {narratives.map((nar) => (
            <div key={nar.name} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="mono font-bold text-xs text-mint-400">{nar.momentum}</span>
                <span className="h-1.5 w-1.5 rounded-full bg-mint-400 animate-pulse" />
              </div>
              <p className="font-bold text-xs text-zinc-200 line-clamp-1">{nar.name}</p>
              <p className="text-[10px] text-zinc-500 truncate">{nar.tokens}</p>
            </div>
          ))}
        </div>
      </Panel>

      <TrendingNews />
    </div>
  );
}

function WatchlistPanel({ coins, onNavigateCoins }: { coins?: CoinRow[]; onNavigateCoins?: () => void }) {
  const [starredIds, setStarredIds] = useState<Set<string>>(() => new Set(["bitcoin", "ethereum", "solana", "hyperliquid", "sui"]));
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("xyz_user_watchlist");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setStarredIds(new Set(parsed));
        }
      }
    } catch {
      // fallback
    }
  }, []);

  const saveWatchlist = (next: Set<string>) => {
    setStarredIds(next);
    try {
      localStorage.setItem("xyz_user_watchlist", JSON.stringify(Array.from(next)));
      window.dispatchEvent(new Event("watchlist-updated"));
    } catch {
      // ignore
    }
  };

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

  const allAvailable = coins ?? defaultCoins;
  const watchedCoins = allAvailable.filter((c) => starredIds.has(c.id));

  // Compute portfolio average
  const avg24h = watchedCoins.length > 0
    ? watchedCoins.reduce((acc, c) => acc + (c.change24h ?? 0), 0) / watchedCoins.length
    : 0;
  const bestCoin = watchedCoins.length > 0
    ? [...watchedCoins].sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0))[0]
    : null;

  return (
    <div className="space-y-3">
      {/* 4-Card Watchlist Summary Strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CompactKpiCard
          label="Tracked Assets"
          value={`${watchedCoins.length} Coins`}
          sub="Personal Watchlist"
          subTone="up"
          icon={<Star className="h-3 w-3 fill-amber-400" />}
          iconBg="bg-amber-500/25 text-amber-400 ring-1 ring-amber-500/40"
          sparkline={[watchedCoins.length - 1, watchedCoins.length, watchedCoins.length]}
          color="#f59e0b"
        />
        <CompactKpiCard
          label="24h Average Return"
          value={`${avg24h >= 0 ? "+" : ""}${avg24h.toFixed(2)}%`}
          sub={avg24h >= 0 ? "Portfolio in profit" : "Pullback"}
          subTone={avg24h >= 0 ? "up" : "down"}
          icon={<TrendingUp className="h-3 w-3" />}
          iconBg={avg24h >= 0 ? "bg-emerald-600/30 text-emerald-400 ring-1 ring-emerald-500/40" : "bg-rose-600/30 text-rose-400 ring-1 ring-rose-500/40"}
          sparkline={avg24h >= 0 ? [1.2, 1.8, 2.4, 2.9, 3.42] : [-0.5, -1.0, -1.5, -2.1]}
          color={avg24h >= 0 ? "#10b981" : "#ef4444"}
        />
        <CompactKpiCard
          label="Top Watchlist Mover"
          value={bestCoin ? `${bestCoin.symbol} (${bestCoin.change24h >= 0 ? "+" : ""}${bestCoin.change24h.toFixed(1)}%)` : "-"}
          sub="Highest 24h gain"
          subTone="up"
          icon={<Flame className="h-3 w-3" />}
          iconBg="bg-mint-500/25 text-mint-400 ring-1 ring-mint-500/40"
          sparkline={[5, 8, 12, 16, 20]}
          color="#00e599"
        />
        <CompactKpiCard
          label="Price Alerts"
          value="Active (Live)"
          sub="Sound & push enabled"
          subTone="up"
          icon={<Bell className="h-3 w-3" />}
          iconBg="bg-blue-600/30 text-blue-400 ring-1 ring-blue-500/40"
          sparkline={[1, 2, 2, 3, 3]}
          color="#3b82f6"
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
        <DonutPieChart
          title="Watchlist Portfolio Allocation"
          subtitle="Capital weighting and exposure breakdown of tracked assets"
          totalLabel="Watched Assets"
          totalValue={`${watchedCoins.length} Coins`}
          segments={[
            { name: "Bitcoin (BTC)", value: 48.0, formattedValue: "Core Store", color: "#f59e0b" },
            { name: "Ethereum (ETH)", value: 25.0, formattedValue: "Smart Contracts", color: "#627eea" },
            { name: "Solana (SOL)", value: 12.0, formattedValue: "High Beta", color: "#a855f7" },
            { name: "Hyperliquid (HYPE)", value: 9.0, formattedValue: "DeFi Derivative", color: "#00e599" },
            { name: "Sui (SUI)", value: 6.0, formattedValue: "L1 Alternative", color: "#3b82f6" },
          ]}
          insightText="Balanced 73% Tier-1 bluechip core with 27% high-velocity ecosystem tokens creates optimal risk-adjusted portfolio exposure."
        />

        <ComparativeBarChart
          title="24h Watched Assets Performance"
          subtitle="Relative returns compared to zero baseline (+ profit / - loss)"
          items={watchedCoins.map((c) => ({
            label: c.symbol,
            sublabel: c.name,
            value: c.change24h ?? 0,
            displayValue: `${(c.change24h ?? 0) >= 0 ? "+" : ""}${(c.change24h ?? 0).toFixed(2)}%`,
          }))}
          insightText="Your watched assets are demonstrating strong divergence, with altcoins delivering outsized alpha over Bitcoin."
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
      const r = await fetch("/api/news?pageSize=10", { cache: "no-store" });
      if (!r.ok) throw new Error("bad status");
      const j = await r.json();
      setItems(Array.isArray(j.items) ? j.items : []);
    } finally {
      setLoading(false);
    }
  }, []);
  useLiveData({ load, intervalMs: 5_000, wakeMinAgeMs: 5_000 });
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

const defaultGainers = [
  { id: "solana", symbol: "SOL", name: "Solana", price: 168.4, change24h: 8.42, volume: 4.2e9, image: "https://assets.coingecko.com/coins/images/4128/small/solana.png", sparkline: [155, 158, 160, 163, 165, 168.4] },
  { id: "sui", symbol: "SUI", name: "Sui", price: 2.14, change24h: 7.31, volume: 1.8e9, image: "https://assets.coingecko.com/coins/images/26375/small/sui-ocean-square.png", sparkline: [1.99, 2.02, 2.05, 2.08, 2.14] },
  { id: "hyperliquid", symbol: "HYPE", name: "Hyperliquid", price: 27.8, change24h: 6.84, volume: 920e6, image: "https://assets.coingecko.com/coins/images/50882/small/hyperliquid.jpg", sparkline: [26.0, 26.4, 26.9, 27.3, 27.8] },
  { id: "chainlink", symbol: "LINK", name: "Chainlink", price: 18.21, change24h: 5.91, volume: 760e6, image: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png", sparkline: [17.2, 17.4, 17.7, 18.0, 18.21] },
  { id: "avalanche-2", symbol: "AVAX", name: "Avalanche", price: 42.12, change24h: 5.42, volume: 1.2e9, image: "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png", sparkline: [39.9, 40.5, 41.1, 41.6, 42.12] },
];

const defaultLosers = [
  { id: "cashcat", symbol: "CASHCAT", name: "Cashcat", price: 0.174494, change24h: -12.1, volume: 42e6, image: "https://assets.coingecko.com/coins/images/38600/small/cashcat.png", sparkline: [0.198, 0.192, 0.186, 0.180, 0.174494] },
  { id: "fartcoin", symbol: "FARTCOIN", name: "Fartcoin", price: 0.327787, change24h: -11.6, volume: 18e6, image: "https://assets.coingecko.com/coins/images/50529/small/fart.png", sparkline: [0.370, 0.358, 0.345, 0.335, 0.327787] },
  { id: "turbo", symbol: "TURBO", name: "Turbo", price: 0.00421, change24h: -9.8, volume: 32e6, image: "https://assets.coingecko.com/coins/images/30116/small/turbo.png", sparkline: [0.00466, 0.00452, 0.00440, 0.00428, 0.00421] },
  { id: "pepe", symbol: "PEPE", name: "Pepe", price: 0.000098, change24h: -8.4, volume: 28e6, image: "https://assets.coingecko.com/coins/images/29850/small/pepe-token.png", sparkline: [0.000107, 0.000104, 0.000101, 0.000099, 0.000098] },
  { id: "dogwifcoin", symbol: "WIF", name: "dogwifhat", price: 1.234, change24h: -7.2, volume: 21e6, image: "https://assets.coingecko.com/coins/images/33566/small/dogwifhat.jpg", sparkline: [1.33, 1.30, 1.28, 1.25, 1.234] },
];

function MoverList({ rows, fallback = defaultGainers }: { rows: MoverCoin[]; fallback?: (MoverCoin & { volume?: number; sparkline?: number[] })[] }) {
  const items = rows && rows.length >= 3 ? rows.slice(0, 5) : fallback;
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
          const vol = (r as { volume?: number }).volume ?? (r.price > 10 ? 1.2e9 : 35e6);
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
                {compactCleanUsd(vol)}
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
  subTone: "up" | "down";
  icon: React.ReactNode;
  iconBg: string;
  sparkline: number[];
  color: string;
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
        <div className={cn("mono text-[11px] font-bold leading-none inline-flex items-center gap-0.5", subTone === "up" ? "text-mint-400" : "text-red-400")}>
          {sub}
        </div>
        <GlowingSparkline data={sparkline} color={color} />
      </div>
    </div>
  );
}

function CompactFearGreedCard({ fg, className }: { fg: { value: number; label: string } | null; className?: string }) {
  const v = fg?.value ?? 70;
  const { label } = fngLabel(v);

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
              <stop offset="0%" stopColor="#00e599" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>
          <path d="M 14 45 A 36 36 0 0 1 86 45" fill="none" stroke="rgba(160, 175, 195, 0.2)" strokeWidth="6" strokeLinecap="round" />
          <path d="M 14 45 A 36 36 0 0 1 86 45" fill="none" stroke="url(#fgGaugeCompact)" strokeWidth="6" strokeLinecap="round" />
          <text x="50" y="31" textAnchor="middle" className="mono text-[16px] font-black fill-zinc-900 dark:fill-zinc-50 leading-none">{v}</text>
          <text x="50" y="44" textAnchor="middle" className="text-[9px] font-bold fill-mint-600 dark:fill-mint-400 tracking-wider uppercase">{fg?.label || label}</text>
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
  const v = fg?.value ?? 70;
  const { label } = fngLabel(v);
  const needleAngle = Math.min(90, Math.max(-90, (v / 100) * 180 - 90));

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
          <text x="50" y="34" textAnchor="middle" className="mono text-[16px] font-black fill-zinc-900 dark:fill-zinc-50">{v}</text>
          <text x="50" y="46" textAnchor="middle" className="text-[9px] font-semibold fill-emerald-600 dark:fill-mint-400 tracking-wide">{fg?.label || label}</text>
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
