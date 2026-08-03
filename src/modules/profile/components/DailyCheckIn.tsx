"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Gift, Check, Flame } from "lucide-react";
import { useRealtime } from "@/lib/useRealtime";
import { cn } from "@/lib/utils";

/** Read the XP snapshot. No state, so callers decide whether it still matters. */
async function fetchXp(): Promise<Record<string, unknown> | null> {
  const r = await fetch("/api/xp", { cache: "no-store" });
  return r.ok ? ((await r.json()) as Record<string, unknown>) : null;
}

function useDailyCheckIn() {
  const { data: session } = useSession();
  const meId = (session?.user as { id?: string } | undefined)?.id;
  const [claimed, setClaimed] = useState(false);
  const [busy, setBusy] = useState(false);
  // The run, in days. `null` until the first load answers, so the UI stays
  // quiet rather than flashing a confident "Day 0" at someone on a 40-day run.
  const [streak, setStreak] = useState<number | null>(null);
  const [atRisk, setAtRisk] = useState(false);

  // Fetching and applying are separate so the effect below can drop a response
  // that arrives after unmount, and so its body holds no synchronous setState.
  const apply = useCallback((d: { todayActions?: unknown; streak?: unknown; streakAtRisk?: unknown }) => {
    setClaimed(Array.isArray(d.todayActions) && d.todayActions.includes("checkin"));
    if (typeof d.streak === "number") setStreak(d.streak);
    setAtRisk(Boolean(d.streakAtRisk));
  }, []);

  useEffect(() => {
    if (!session) return;
    let stop = false;
    fetchXp()
      .then((d) => {
        if (!stop && d) apply(d);
      })
      .catch(() => {
        /* the button still works; it just starts without a number */
      });
    return () => {
      stop = true;
    };
  }, [session, apply]);

  // Checking in on a phone should not leave a laptop showing yesterday's
  // number. The award endpoint broadcasts on this member's own channel. No
  // poll: a streak changes at most once a day, and only by their own hand.
  useRealtime({
    channel: meId ? `user:${meId}` : "",
    event: "xp_checkin",
    enabled: Boolean(meId),
    onMessage: (payload) => {
      const p = payload as { streak?: number | null } | null;
      if (typeof p?.streak === "number") setStreak(p.streak);
      setClaimed(true);
      setAtRisk(false);
    },
    pollMs: 0,
  });

  async function claim() {
    if (claimed || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/xp/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkin" }),
      });
      if (res.ok) {
        setClaimed(true);
        setAtRisk(false);
        // The response carries the new streak, so the number moves on the same
        // click rather than after a round trip nobody asked for.
        const d = await res.json().catch(() => null);
        if (typeof d?.streak === "number") setStreak(d.streak);
        else {
          const fresh = await fetchXp().catch(() => null);
          if (fresh) apply(fresh);
        }
      }
    } catch {
      /* best-effort */
    } finally {
      setBusy(false);
    }
  }

  return { claimed, busy, claim, streak, atRisk, loggedIn: Boolean(session) };
}

/**
 * The streak badge. Deliberately absent at zero: a member with no run does not
 * need to be told they have none, and "Day 0" beside a check-in button reads
 * like a bug rather than a fact.
 */
function StreakBadge({ days, atRisk }: { days: number | null; atRisk: boolean }) {
  if (!days || days < 1) return null;
  return (
    <span
      title={atRisk ? `${days}-day streak - check in today to keep it` : `${days}-day check-in streak`}
      className={cn(
        "mono ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
        // Amber only while today is unclaimed - the one moment the number is
        // actionable. Once claimed it returns to a calm gold, because a streak
        // you have kept is not a warning.
        atRisk
          ? "bg-amber-500/12 text-amber-300 ring-amber-500/30"
          : "bg-gold-500/12 text-gold-200 ring-gold-500/30"
      )}
    >
      <Flame className="h-3 w-3" aria-hidden />
      Day {days}
    </span>
  );
}

// Daily check-in action button - the first, always-visible way to earn the
// basic engagement XP. Lives in the navbar account menu (desktop dropdown +
// mobile panel), not `MenuItem` since it's an action, not a navigation link.
export function DailyCheckIn({ variant = "menu", onClaimed }: { variant?: "menu" | "mobile"; onClaimed?: () => void }) {
  const { claimed, busy, claim, streak, atRisk, loggedIn } = useDailyCheckIn();
  if (!loggedIn) return null;

  const label = claimed ? "Checked in today" : "Daily check-in";

  async function handleClick() {
    await claim();
    onClaimed?.();
  }

  if (variant === "mobile") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={claimed || busy}
        className="btn-ghost flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {claimed ? <Check className="h-4 w-4 text-mint-300" /> : <Gift className="h-4 w-4" />}
        {label}
        <StreakBadge days={streak} atRisk={atRisk} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={claimed || busy}
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-gold-100 disabled:opacity-60"
    >
      {claimed ? <Check className="h-4 w-4 text-mint-300" /> : <Gift className="h-4 w-4" />}
      {label}
      <StreakBadge days={streak} atRisk={atRisk} />
    </button>
  );
}
