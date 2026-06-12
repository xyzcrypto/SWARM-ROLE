"use client";

import { useEffect, useRef, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

type Coin = { symbol: string; name: string; price: number; change: number; image: string };

const fallback: Coin[] = [
  { symbol: "BTC", name: "Bitcoin", price: 68420, change: 1.8, image: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png" },
  { symbol: "ETH", name: "Ethereum", price: 3540, change: 1.2, image: "https://assets.coingecko.com/coins/images/279/small/ethereum.png" },
  { symbol: "SOL", name: "Solana", price: 168.4, change: -0.9, image: "https://assets.coingecko.com/coins/images/4128/small/solana.png" },
  { symbol: "SUI", name: "Sui", price: 2.14, change: 3.1, image: "https://assets.coingecko.com/coins/images/26375/small/sui-ocean-square.png" },
  { symbol: "HYPE", name: "Hyperliquid", price: 27.8, change: 2.4, image: "https://assets.coingecko.com/coins/images/50882/small/hyperliquid.jpg" },
  { symbol: "BNB", name: "BNB", price: 605, change: 0.6, image: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png" },
  { symbol: "XRP", name: "XRP", price: 0.62, change: -1.4, image: "https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png" },
  { symbol: "DOGE", name: "Dogecoin", price: 0.16, change: 2.0, image: "https://assets.coingecko.com/coins/images/5/small/dogecoin.png" },
  { symbol: "AVAX", name: "Avalanche", price: 38.2, change: -0.5, image: "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png" },
  { symbol: "LINK", name: "Chainlink", price: 18.6, change: 1.1, image: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png" },
];

function fmt(price: number) {
  if (price >= 1000) return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (price >= 1) return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return price.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function Cell({ c, fl }: { c: Coin; fl?: "up" | "down" }) {
  const up = c.change >= 0;
  return (
    <div className="flex shrink-0 items-center gap-2.5 border-r border-line/60 px-3.5 sm:px-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={c.image}
        alt={c.name}
        width={18}
        height={18}
        loading="lazy"
        className="h-[18px] w-[18px] rounded-full ring-1 ring-white/10"
        onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")}
      />
      <span className="mono text-xs font-semibold text-zinc-200">{c.symbol}</span>
      <span
        className={`mono rounded px-1 text-xs transition-colors duration-700 ${
          fl === "up" ? "bg-mint-500/25 text-mint-200" : fl === "down" ? "bg-red-500/25 text-red-200" : "text-zinc-400"
        }`}
      >
        ${fmt(c.price)}
      </span>
      <span className={`mono inline-flex items-center gap-0.5 text-[11px] ${up ? "text-mint-400" : "text-red-400"}`}>
        {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {up ? "+" : ""}
        {c.change.toFixed(2)}%
      </span>
    </div>
  );
}

export function MarketTicker() {
  const [coins, setCoins] = useState<Coin[]>(fallback);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<Record<string, "up" | "down">>({});
  const prev = useRef<Record<string, number>>({});

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/ticker", { cache: "no-store" });
        if (!res.ok) throw new Error("bad status");
        const data = await res.json();
        if (!active || !Array.isArray(data.coins) || !data.coins.length) return;

        const f: Record<string, "up" | "down"> = {};
        for (const c of data.coins as Coin[]) {
          const p = prev.current[c.symbol];
          if (p !== undefined && c.price !== p) f[c.symbol] = c.price > p ? "up" : "down";
          prev.current[c.symbol] = c.price;
        }
        setCoins(data.coins);
        setLive(Boolean(data.live));
        if (Object.keys(f).length) {
          setFlash(f);
          setTimeout(() => active && setFlash({}), 1000);
        }
      } catch {
        if (active) setLive(false);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    // Auto-refresh every 10s, but never while the tab is hidden (saves data +
    // battery, esp. on mobile); catch up immediately when it's visible again.
    const t = setInterval(() => {
      if (!document.hidden) load();
    }, 10_000);
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const statusLabel = loading ? "Loading" : live ? "Live Market" : "Market";
  const row = [...coins, ...coins]; // duplicate for seamless infinite scroll

  return (
    <div className="relative flex items-stretch border-y border-line bg-ink-950/70">
      {/* status (fixed, left) */}
      <div className="z-10 flex shrink-0 items-center gap-2 border-r border-line bg-ink-950/90 px-3 py-3 sm:px-4">
        <span className="relative flex h-2 w-2">
          {live && !loading && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-400 opacity-70" />}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${loading ? "animate-pulse bg-zinc-500" : live ? "bg-mint-400" : "bg-amber-400"}`} />
        </span>
        <span className="mono hidden text-[10px] uppercase tracking-[0.18em] text-zinc-500 sm:inline">{statusLabel}</span>
      </div>

      {/* scrolling track */}
      <div className="marquee-mask relative flex-1 overflow-hidden py-3">
        <div
          className="marquee items-center hover:[animation-play-state:paused]"
          style={{ animationDuration: "48s" }}
        >
          {row.map((c, i) => (
            <Cell key={`${c.symbol}-${i}`} c={c} fl={flash[c.symbol]} />
          ))}
        </div>
      </div>
    </div>
  );
}
