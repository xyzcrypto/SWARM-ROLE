"use client";

import { useSearchParams } from "next/navigation";
import { LeaderboardView, type Period } from "./Leaderboard";
import { Panel, SectionTitle } from "./ui";

export function LeaderboardPage() {
  const p = useSearchParams().get("period");
  const period: Period = p === "daily" || p === "monthly" || p === "alltime" ? p : "weekly";
  return (
    <div>
      <SectionTitle
        eyebrow="Global rankings"
        title={<span className="text-gold-gradient">The leaderboard</span>}
        sub="Ranked by XP earned in the period, from real quiz results. Periods reset at 00:00 UTC (5:30 AM IST); weeks start Monday. Top finishers of each day, week and month earn an official certificate."
      />
      <Panel>
        <LeaderboardView initialPeriod={period} />
      </Panel>
    </div>
  );
}
