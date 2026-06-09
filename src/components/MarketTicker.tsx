"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Container } from "./ui/primitives";

type Coin = { symbol: string; price: number; change: number };

const fallback: Coin[] = [
  { symbol: "BTC", price: 68420, change: 1.8 },
  { symbol: "ETH", price: 3540, change: 1.2 },
  { symbol: "SOL", price: 168.4, change: -0.9 },
  { symbol: "SUI", price: 2.14, change: 3.1 },
  { symbol: "HYPE", price: 27.8, change: 2.4 },
];

function fmt(price: number) {
  if (price >= 1000) return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (price >= 1) return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return price.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function MarketTicker() {
  const [coins, setCoins] = useState<Coin[]>(fallback);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        // Our own cached proxy — avoids client-side CoinGecko 429/529 & CORS.
        const res = await fetch("/api/ticker", { cache: "no-store" });
        if (!res.ok) throw new Error("bad status");
        const data = await res.json();
        if (!active || !Array.isArray(data.coins)) return;
        setCoins(data.coins);
        setLive(Boolean(data.live));
      } catch {
        if (active) setLive(false);
      }
    }
    load();
    const t = setInterval(load, 60_000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="relative border-y border-line bg-ink-950/60">
      <Container className="flex items-center gap-4 py-3">
        <div className="flex shrink-0 items-center gap-2 pr-3 sm:pr-4">
          <span className="relative flex h-2 w-2">
            {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-400 opacity-70" />}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${live ? "bg-mint-400" : "bg-zinc-500"}`} />
          </span>
          <span className="mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            {live ? "Live Market" : "Market"}
          </span>
        </div>
        <div className="flex flex-1 items-center gap-6 overflow-x-auto sm:gap-8 [&::-webkit-scrollbar]:hidden">
          {coins.map((c) => {
            const up = c.change >= 0;
            return (
              <div key={c.symbol} className="flex shrink-0 items-center gap-2.5">
                <span className="mono text-xs font-semibold text-zinc-200">{c.symbol}</span>
                <span className="mono text-xs text-zinc-400">${fmt(c.price)}</span>
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
