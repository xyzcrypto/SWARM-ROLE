"use client";

import { useTickerPoll } from "@/lib/useTickerPoll";

type Coin = { symbol: string; name: string; price: number; change: number; image: string };

// Seed list so the card is populated on first paint (SSR) before /api/ticker
// resolves. Mirrors the ticker's fallback set.
const seed: Coin[] = [
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

function fmt(p: number) {
  if (p >= 1000) return p.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (p >= 1) return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return p.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function Row({ c }: { c: Coin }) {
  const up = c.change >= 0;
  return (
    <div className="flex h-[22px] items-center gap-2 border-b border-white/[0.04] text-[10.5px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={c.image}
        alt=""
        width={14}
        height={14}
        loading="lazy"
        decoding="async"
        className="h-[14px] w-[14px] shrink-0 rounded-full ring-1 ring-white/10"
        onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")}
      />
      <span className="mono w-9 shrink-0 font-semibold text-zinc-200">{c.symbol}</span>
      <span className="mono flex-1 text-right tabular-nums text-zinc-400">${fmt(c.price)}</span>
      <span className={`mono w-11 shrink-0 text-right tabular-nums ${up ? "text-mint-400" : "text-rose-400"}`}>
        {up ? "+" : ""}
        {c.change.toFixed(1)}%
      </span>
    </div>
  );
}

/**
 * Live, auto-scrolling market feed for the "Web3 Market" product card. Pulls
 * real prices from the shared /api/ticker poll (see useTickerPoll - deduped
 * against MarketTicker's identical fetch, refreshes every 60s while the tab
 * is visible, matching the route's revalidate window) and rises the list
 * slowly upward. Reduced-motion pauses the scroll (globals `.vscroll` kill),
 * so the coins simply sit still.
 */
export function LiveMarketVisual() {
  const { coins: polled, live } = useTickerPoll();
  const coins = polled ?? seed;

  const list = [...coins, ...coins]; // duplicate → seamless vertical loop
  const dur = Math.max(20, coins.length * 2.6);

  return (
    <div className="relative mt-5 h-24 overflow-hidden rounded-2xl border border-line bg-ink-950/60">
      {/* header (solid bg - no backdrop-filter, cheaper on mobile scroll) */}
      <div className="absolute inset-x-0 top-0 z-10 flex h-[22px] items-center justify-between border-b border-white/[0.06] bg-ink-950 px-3 mono text-[9px] text-zinc-500">
        <span>{live ? "LIVE MARKET" : "MARKET"}</span>
        <span className="inline-flex items-center gap-1 text-mint-300">
          <span className="relative flex h-1.5 w-1.5">
            {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-400 opacity-70" />}
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint-400" />
          </span>
          REALTIME
        </span>
      </div>
      {/* scrolling track (starts below the header, softly masked top/bottom) */}
      <div className="vscroll-mask absolute inset-x-0 bottom-0 top-[22px] overflow-hidden px-3">
        <div className="vscroll" style={{ animationDuration: `${dur}s` }}>
          {list.map((c, i) => (
            <Row key={`${c.symbol}-${i}`} c={c} />
          ))}
        </div>
      </div>
    </div>
  );
}
