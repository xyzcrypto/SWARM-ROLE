"use client";

import { useLivePresence } from "@/lib/useLivePresence";

/**
 * Live "online now" pill (Supabase presence, real-time). The visits-today /
 * total-visits / members counters were removed at the owner's request, so only
 * the genuinely-live presence signal remains - and it's hidden entirely when
 * realtime isn't configured (or nobody is online).
 */
export function LiveStats({ className = "" }: { className?: string }) {
  const online = useLivePresence();
  if (online <= 0) return null;

  return (
    <div className={`flex flex-wrap items-center justify-center gap-x-6 gap-y-2 ${className}`}>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 animate-pulse-dot rounded-full bg-mint-400" />
        <span className="mono text-sm font-semibold text-mint-300">{online.toLocaleString("en-US")}</span>
        <span className="text-[11px] uppercase tracking-wide text-zinc-500">online now</span>
      </span>
    </div>
  );
}
