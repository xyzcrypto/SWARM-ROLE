"use client";

import { useEffect, useState } from "react";
import { useLivePresence } from "@/lib/useLivePresence";

type Stats = { visitsToday: number; totalVisits: number; members: number };

function Stat({
  value,
  label,
  tone = "gold",
  dot = false,
}: {
  value: number;
  label: string;
  tone?: "gold" | "mint";
  dot?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {dot && <span className="h-2 w-2 animate-pulse-dot rounded-full bg-mint-400" />}
      <span className={`mono text-sm font-semibold ${tone === "mint" ? "text-mint-300" : "text-gold-200"}`}>
        {value.toLocaleString()}
      </span>
      <span className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</span>
    </span>
  );
}

/**
 * Live site stats strip: "online now" (Supabase presence, real-time) plus
 * visits today / total / members (polled ~30s). The online figure is hidden
 * when realtime isn't configured; the rest are DB-backed and always shown.
 */
export function LiveStats({ className = "" }: { className?: string }) {
  const online = useLivePresence();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch("/api/live/stats", { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as Stats;
        if (!stop) setStats(d);
      } catch {
        /* transient - keep last value */
      }
    };
    load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 30_000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className={`flex flex-wrap items-center justify-center gap-x-6 gap-y-2 ${className}`}>
      {online > 0 && <Stat value={online} label="online now" tone="mint" dot />}
      {stats && (
        <>
          <Stat value={stats.visitsToday} label="visits today" />
          <Stat value={stats.totalVisits} label="total visits" />
          <Stat value={stats.members} label="members" tone="mint" />
        </>
      )}
    </div>
  );
}
