"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowLeft, ExternalLink, Loader2, Newspaper } from "lucide-react";
import { RobotIcon } from "./RobotIcon";
import { compactUsd, coinPrice, pct } from "@/lib/markets";
import { cn } from "@/lib/utils";

type Coin = {
  id: string;
  name: string;
  symbol: string;
  image: string | null;
  rank: number | null;
  price: number;
  change1h: number;
  change24h: number;
  change7d: number;
  change30d: number;
  marketCap: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  ath: number;
  athChange: number;
  circulatingSupply: number;
  totalSupply: number;
  maxSupply: number;
  homepage: string | null;
  description: string;
  chart: number[];
  live: boolean;
  ts?: number;
};

type NewsItem = { title: string; url: string; source: string; publishedAt: number };

export function CoinDetailClient({ id }: { id: string }) {
  const { data: session } = useSession();
  const [coin, setCoin] = useState<Coin | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Live snapshot (cached proxy) - refreshed while the tab is visible.
  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/markets/coin/${encodeURIComponent(id)}`, { cache: "no-store" });
        const j = (await r.json()) as Coin;
        if (stop) return;
        if (j && j.live) {
          setCoin(j);
          setFailed(false);
        } else if (!coin) {
          setFailed(true);
        }
      } catch {
        if (!stop && !coin) setFailed(true);
      } finally {
        if (!stop) setLoading(false);
      }
    };
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 30_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading && !coin) return <CoinSkeleton />;
  if (failed && !coin)
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-amber-300">Couldn&apos;t load this coin.</p>
        <Link href="/markets" className="mt-3 inline-block text-sm text-gold-200 hover:underline">← Back to Markets</Link>
      </div>
    );
  if (!coin) return <CoinSkeleton />;

  const up24 = coin.change24h >= 0;

  return (
    <div className="space-y-6">
      <Link href="/markets" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-100">
        <ArrowLeft className="h-4 w-4" /> Markets
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          {coin.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coin.image} alt="" width={44} height={44} className="h-11 w-11 rounded-full ring-1 ring-white/10" />
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-zinc-50 sm:text-3xl">{coin.name}</h1>
              <span className="mono text-sm text-zinc-500">{coin.symbol}</span>
              {coin.rank ? <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-zinc-400">Rank #{coin.rank}</span> : null}
            </div>
            <FreshnessPill ts={coin.ts} />
          </div>
        </div>
        <div className="text-left sm:text-right">
          <div className="mono text-3xl font-bold text-zinc-50 sm:text-4xl">{coinPrice(coin.price)}</div>
          <div className={cn("mono text-sm font-semibold", up24 ? "text-mint-400" : "text-red-400")}>{pct(coin.change24h)} (24h)</div>
        </div>
      </div>

      {/* 7d chart */}
      <div className="surface rounded-2xl p-4 sm:p-5">
        <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wide text-zinc-500">
          <span>Last 7 days</span>
          <span className="mono">{pct(coin.change7d)}</span>
        </div>
        <PriceChart data={coin.chart} up={coin.change7d >= 0} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Market Cap" value={compactUsd(coin.marketCap)} />
        <Stat label="24h Volume" value={compactUsd(coin.volume24h)} />
        <Stat label="24h High" value={coinPrice(coin.high24h)} />
        <Stat label="24h Low" value={coinPrice(coin.low24h)} />
        <Stat label="All-Time High" value={coinPrice(coin.ath)} sub={coin.athChange ? `${pct(coin.athChange)} from ATH` : undefined} />
        <Stat label="Circulating" value={coin.circulatingSupply ? `${compactUsd(coin.circulatingSupply).replace("$", "")} ${coin.symbol}` : "-"} />
        <Stat label="Max Supply" value={coin.maxSupply ? `${compactUsd(coin.maxSupply).replace("$", "")} ${coin.symbol}` : "∞"} />
        <Stat label="1h / 30d" value={`${pct(coin.change1h)} / ${pct(coin.change30d)}`} />
      </div>

      {/* 24h range */}
      {coin.high24h > coin.low24h && (
        <div className="surface rounded-2xl p-4 sm:p-5">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">24h Range</p>
          <RangeBar low={coin.low24h} high={coin.high24h} price={coin.price} />
        </div>
      )}

      {/* AI take */}
      <AiTake coin={coin} loggedIn={Boolean(session?.user)} />

      {/* Related news */}
      <RelatedNews symbol={coin.symbol} name={coin.name} />

      {/* About */}
      {coin.description && (
        <div className="surface rounded-2xl p-4 sm:p-5">
          <p className="mb-2 text-sm font-semibold text-zinc-100">About {coin.name}</p>
          <p className="text-[13px] leading-relaxed text-zinc-400">{coin.description}</p>
          {coin.homepage && (
            <a href={coin.homepage} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-[12px] text-gold-200 hover:underline">
              Official site <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      <p className="text-center text-[11px] text-zinc-600">Data from CoinGecko. Not financial advice.</p>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="surface rounded-xl p-3">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className="mono mt-1 text-sm font-semibold text-zinc-100">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-zinc-500">{sub}</p>}
    </div>
  );
}

function RangeBar({ low, high, price }: { low: number; high: number; price: number }) {
  const pctPos = Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100));
  return (
    <div>
      <div className="relative h-1.5 rounded-full bg-gradient-to-r from-red-500/40 via-zinc-600/40 to-mint-500/40">
        <span className="absolute -top-1 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-zinc-100 ring-2 ring-ink-950" style={{ left: `${pctPos}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-zinc-500">
        <span className="mono">{coinPrice(low)}</span>
        <span className="mono">{coinPrice(high)}</span>
      </div>
    </div>
  );
}

function PriceChart({ data, up }: { data: number[]; up: boolean }) {
  const path = useMemo(() => {
    if (!data || data.length < 2) return null;
    const W = 600;
    const H = 140;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    const step = W / (data.length - 1);
    const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(H - ((v - min) / span) * H).toFixed(1)}`);
    return { d: `M ${pts.join(" L ")}`, W, H, area: `M 0,${H} L ${pts.join(" L ")} L ${W},${H} Z` };
  }, [data]);

  if (!path) return <div className="flex h-[140px] items-center justify-center text-xs text-zinc-600">Chart unavailable</div>;
  const color = up ? "var(--chart-mint)" : "#ef4444";
  return (
    <svg viewBox={`0 0 ${path.W} ${path.H}`} preserveAspectRatio="none" className="h-32 w-full sm:h-40" role="img" aria-label="7-day price chart">
      <defs>
        <linearGradient id="coinArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path.area} fill="url(#coinArea)" />
      <path d={path.d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

function FreshnessPill({ ts }: { ts?: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => document.visibilityState === "visible" && setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!ts) return null;
  const s = Math.max(0, Math.round((now - ts) / 1000));
  const label = s < 3 ? "just now" : s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`;
  return (
    <span className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
      <span className={cn("h-1.5 w-1.5 rounded-full", s < 90 ? "bg-mint-400" : "bg-amber-400")} />
      Updated {label} · USD
    </span>
  );
}

function AiTake({ coin, loggedIn }: { coin: Coin; loggedIn: boolean }) {
  const [state, setState] = useState<{ loading: boolean; text: string | null; err: string | null }>({ loading: false, text: null, err: null });

  const run = useCallback(async () => {
    if (!loggedIn) {
      setState({ loading: false, text: null, err: "Log in to use XYZ AI." });
      return;
    }
    if (state.text || state.loading) return;
    setState({ loading: true, text: null, err: null });
    try {
      const res = await fetch("/api/ai/coin-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: coin.name, symbol: coin.symbol, price: coin.price, change24h: coin.change24h, change7d: coin.change7d, rank: coin.rank, marketCap: coin.marketCap }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({ loading: false, text: null, err: j.error || "Couldn't generate." });
        return;
      }
      setState({ loading: false, text: j.text, err: null });
    } catch {
      setState({ loading: false, text: null, err: "Network error." });
    }
  }, [coin, loggedIn, state.text, state.loading]);

  return (
    <div className="rounded-2xl border border-gold-500/20 bg-gold-500/[0.05] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-200">
          <RobotIcon className="h-4 w-4" /> XYZ AI take
        </p>
        {!state.text && (
          <button onClick={run} disabled={state.loading} className="inline-flex items-center gap-1.5 rounded-lg border border-gold-500/40 bg-gold-500/10 px-3 py-1.5 text-xs font-semibold text-gold-200 transition-colors hover:bg-gold-500/20 disabled:opacity-50">
            {state.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RobotIcon className="h-3.5 w-3.5" />} Generate
          </button>
        )}
      </div>
      {state.text && <p className="mt-2 text-[13px] leading-relaxed text-zinc-200">{state.text}</p>}
      {state.err && <p className="mt-2 text-[11px] text-amber-300">{state.err}</p>}
      {!state.text && !state.err && <p className="mt-1 text-[11px] text-zinc-500">A neutral, education-only read on {coin.symbol} from the live numbers. Not financial advice.</p>}
    </div>
  );
}

function RelatedNews({ symbol, name }: { symbol: string; name: string }) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let stop = false;
    fetch(`/api/news?q=${encodeURIComponent(name)}&pageSize=6`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!stop) setItems(Array.isArray(j.items) ? j.items : []);
      })
      .catch(() => {})
      .finally(() => !stop && setLoading(false));
    return () => {
      stop = true;
    };
  }, [name]);

  if (!loading && !items.length) return null;
  return (
    <div className="surface rounded-2xl p-4 sm:p-5">
      <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
        <Newspaper className="h-4 w-4 text-gold-300" /> {symbol} in the news
      </p>
      {loading ? (
        <p className="py-3 text-center text-xs text-zinc-500">Loading…</p>
      ) : (
        <ul className="divide-y divide-white/5">
          {items.map((n) => (
            <li key={n.url}>
              <a href={n.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 py-2.5 transition-colors hover:bg-white/[0.03]">
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[13px] text-zinc-200">{n.title}</span>
                  <span className="mt-0.5 block text-[11px] text-zinc-500">{n.source}</span>
                </span>
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CoinSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-4 w-24 animate-pulse rounded bg-white/[0.06]" />
      <div className="h-12 w-64 animate-pulse rounded bg-white/[0.06]" />
      <div className="h-40 w-full animate-pulse rounded-2xl bg-white/[0.06]" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.06]" />
        ))}
      </div>
    </div>
  );
}
