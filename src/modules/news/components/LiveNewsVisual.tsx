"use client";

import { useEffect, useState } from "react";

type Item = { title: string; source: string };

// Seed headlines so the card reads well on first paint / when offline.
const seed: Item[] = [
  { title: "Bitcoin ETF inflows hit a record high", source: "Coindesk" },
  { title: "Ethereum L2 TVL crosses a new peak", source: "The Block" },
  { title: "Major DeFi protocol ships its v3 upgrade", source: "Decrypt" },
  { title: "Solana network activity climbs sharply", source: "Cointelegraph" },
  { title: "Stablecoin supply expands across chains", source: "DL News" },
];

function Line({ it }: { it: Item }) {
  return (
    <div className="flex h-[1.3125rem] items-center gap-2 text-[0.625rem] text-zinc-400">
      <span className="h-1 w-1 shrink-0 rounded-full bg-gold-400" />
      <span className="mono shrink-0 text-[0.53125rem] uppercase text-zinc-600">{it.source}</span>
      <span className="truncate">{it.title}</span>
    </div>
  );
}

/**
 * Live, auto-scrolling headline feed for the "Web3 News" product card. Pulls
 * real stories from /api/news (refreshes every 150s while visible); headlines
 * rise slowly upward and the newest story is pinned as a "Breaking" showcase
 * along the bottom. Reduced-motion pauses the scroll (globals `.vscroll` kill).
 */
export function LiveNewsVisual() {
  const [items, setItems] = useState<Item[]>(seed);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/news?pageSize=8", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!active || !Array.isArray(data.items) || !data.items.length) return;
        const mapped: Item[] = data.items
          .map((i: { title?: string; source?: string }) => ({ title: i.title ?? "", source: i.source ?? "News" }))
          .filter((i: Item) => i.title);
        if (mapped.length) setItems(mapped);
      } catch {
        /* keep seed */
      }
    }
    load();
    const t = setInterval(() => !document.hidden && load(), 150_000);
    const onVis = () => !document.hidden && load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      active = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const breaking = items[0];
  const list = [...items, ...items]; // duplicate → seamless vertical loop
  const dur = Math.max(18, items.length * 2.8);

  return (
    <div className="relative mt-5 h-24 overflow-hidden rounded-2xl border border-line bg-ink-950/60">
      {/* headlines rain down from the top, softly masked top/bottom */}
      <div className="vscroll-mask absolute inset-x-0 top-0 bottom-[1.5rem] overflow-hidden px-3 pt-1">
        <div className="vscroll-down" style={{ animationDuration: `${dur}s` }}>
          {list.map((it, i) => (
            <Line key={i} it={it} />
          ))}
        </div>
      </div>
      {/* breaking showcase, pinned bottom (solid bg - no backdrop-filter) */}
      <div className="absolute inset-x-0 bottom-0 flex h-[1.5rem] items-center gap-1.5 border-t border-rose-500/20 bg-ink-950 px-3">
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-400" />
        </span>
        <span className="mono shrink-0 text-[0.5625rem] font-semibold uppercase tracking-wide text-rose-300">Breaking</span>
        <span className="truncate text-[0.625rem] text-zinc-300">{breaking?.title}</span>
      </div>
    </div>
  );
}
