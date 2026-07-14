"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Gift, Check } from "lucide-react";

function useDailyCheckIn() {
  const { data: session } = useSession();
  const [claimed, setClaimed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) return;
    let stop = false;
    fetch("/api/xp")
      .then((r) => r.json())
      .then((d) => {
        if (!stop) setClaimed(Array.isArray(d.todayActions) && d.todayActions.includes("checkin"));
      })
      .catch(() => {});
    return () => {
      stop = true;
    };
  }, [session]);

  async function claim() {
    if (claimed || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/xp/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkin" }),
      });
      if (res.ok) setClaimed(true);
    } catch {
      /* best-effort */
    } finally {
      setBusy(false);
    }
  }

  return { claimed, busy, claim, loggedIn: Boolean(session) };
}

// Daily check-in action button - the first, always-visible way to earn the
// basic engagement XP. Lives in the navbar account menu (desktop dropdown +
// mobile panel), not `MenuItem` since it's an action, not a navigation link.
export function DailyCheckIn({ variant = "menu", onClaimed }: { variant?: "menu" | "mobile"; onClaimed?: () => void }) {
  const { claimed, busy, claim, loggedIn } = useDailyCheckIn();
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
    </button>
  );
}
