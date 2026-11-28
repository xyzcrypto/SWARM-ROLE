"use client";

import { useCallback, useState } from "react";
import { Activity, TrendingUp, TrendingDown, Trophy, Users, Flag, Target } from "lucide-react";
import { userChannel } from "@/lib/realtime-channels";
import { useRealtime } from "@/lib/useRealtime";
import { cn } from "@/lib/utils";

export type JournalActivityItem = { id: string; type: string; title: string; win: boolean | null; createdAt: string };

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const TYPE_ICON: Record<string, typeof Activity> = {
  trade_opened: Target,
  trade_closed: Activity,
  challenge_created: Flag,
  challenge_joined: Users,
  challenge_milestone: Trophy,
  challenge_completed: Trophy,
};

// Public "Journal Activity" section on a profile - a live, aggregate-only feed
// of what a member does in their trading Journal (only ever what they've
// already opted into showing - private trades/challenges never appear here).
// Live updates mirror ProfileFollow.tsx's exact realtime pattern.
export function JournalActivityFeed({ userId, initialItems }: { userId: string; initialItems: JournalActivityItem[] }) {
  const [items, setItems] = useState(initialItems);

  const refetch = useCallback(async () => {
    try {
      const r = await fetch(`/api/journal/share/activity/${userId}`, { cache: "no-store" });
      const j = r.ok ? await r.json() : null;
      if (j?.items) setItems(j.items);
    } catch {
      // keep current state
    }
  }, [userId]);

  useRealtime({
    channel: userChannel(userId),
    event: "journal_activity",
    onMessage: () => void refetch(),
    pollMs: 60000,
  });

  if (items.length === 0) return null;

  return (
    <div className="surface rounded-3xl p-6 sm:p-7">
      <h2 className="mb-4 flex items-center gap-1.5 font-display text-base font-semibold text-zinc-200">
        <Activity className="h-4 w-4 text-gold-300" /> Journal Activity
      </h2>
      <div className="space-y-2">
        {items.map((item) => {
          const Icon = TYPE_ICON[item.type] ?? Activity;
          const winTone = item.win == null ? "" : item.win ? "text-mint-300" : "text-rose-300";
          return (
            <div key={item.id} className="flex items-start gap-2.5 rounded-xl bg-white/[0.02] px-3.5 py-2.5 text-sm">
              <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/5", winTone)}>
                {item.win == null ? <Icon className="h-3.5 w-3.5 text-zinc-400" /> : item.win ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-zinc-300">{item.title}</p>
                <p className="mono mt-0.5 text-[0.6875rem] text-zinc-600">{timeAgo(item.createdAt)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
