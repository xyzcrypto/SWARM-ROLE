"use client";

import { useEffect, useRef, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Container } from "./ui/primitives";

type Coin = { symbol: string; name: string; price: number; change: number; image: string };

const fallback: Coin[] = [
  { symbol: "BTC", name: "Bitcoin", price: 68420, change: 1.8, image: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png" },
  { symbol: "ETH", name: "Ethereum", price: 3540, change: 1.2, image: "https://assets.coingecko.com/coins/images/279/small/ethereum.png" },
  { symbol: "SOL", name: "Solana", price: 168.4, change: -0.9, image: "https://assets.coingecko.com/coins/images/4128/small/solana.png" },
  { symbol: "SUI", name: "Sui", price: 2.14, change: 3.1, image: "https://assets.coingecko.com/coins/images/26375/small/sui-ocean-square.png" },
  { symbol: "HYPE", name: "Hyperliquid", price: 27.8, change: 2.4, image: "https://assets.coingecko.com/coins/images/50882/small/hyperliquid.jpg" },
];

function fmt(price: number) {
  if (price >= 1000) return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (price >= 1) return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return price.toLocaleString(undefined, { maximumFractionDigits: 4 });
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
        if (!active || !Array.isArray(data.coins)) return;

        // detect per-coin price movement → flash highlight
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
          setTimeout(() => active && setFlash({}), 900);
        }
      } catch {
        if (active) setLive(false);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    const t = setInterval(load, 15_000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  const statusLabel = loading ? "Loading" : live ? "Live Market" : "Market";

  return (
    <div className="relative border-y border-line bg-ink-950/60">
      <Container className="flex items-center gap-4 py-3">
        <div className="flex shrink-0 items-center gap-2 pr-3 sm:pr-4">
          <span className="relative flex h-2 w-2">
            {live && !loading && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-400 opacity-70" />}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${loading ? "animate-pulse bg-zinc-500" : live ? "bg-mint-400" : "bg-amber-400"}`} />
          </span>
          <span className="mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">{statusLabel}</span>
        </div>

        <div className="flex flex-1 items-center gap-5 overflow-x-auto sm:gap-7 [&::-webkit-scrollbar]:hidden">
          {loading
            ? [0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex shrink-0 items-center gap-2">
                  <span className="h-5 w-5 animate-pulse rounded-full bg-white/10" />
                  <span className="h-3 w-10 animate-pulse rounded bg-white/10" />
                  <span className="h-3 w-12 animate-pulse rounded bg-white/5" />
                </div>
              ))
            : coins.map((c) => {
                const up = c.change >= 0;
                const fl = flash[c.symbol];
                return (
                  <div key={c.symbol} className="flex shrink-0 items-center gap-2">
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
                    <span className="hidden text-[11px] text-zinc-500 md:inline">{c.name}</span>
                    <span
                      className={`mono rounded px-1 text-xs transition-colors duration-500 ${
                        fl === "up" ? "bg-mint-500/20 text-mint-200" : fl === "down" ? "bg-red-500/20 text-red-200" : "text-zinc-400"
                      }`}
                    >
                      ${fmt(c.price)}
                    </span>
                    <span className={`mono inline-flex items-center gap-0.5 text-[11px] ${up ? "text-mint-400" : "text-red-400"}`}>
                      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {up ? "+" : ""}{c.change.toFixed(2)}%
                    </span>
                  </div>
                );
              })}
        </div>
      </Container>
    </div>
  );
}
