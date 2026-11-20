import type { Metadata } from "next";
import { Suspense } from "react";
import { LeaderboardPage } from "@modules/academy/components/LeaderboardPage";
import { pageSeo } from "@/lib/seo";

export const metadata: Metadata = pageSeo({
  title: "Academy Leaderboard: Daily, Weekly, Monthly and All-Time | XYZ Crypto",
  description: "The top Web3 learners on XYZ Crypto Academy, ranked by XP from real quiz results. Daily, weekly and monthly winners earn official certificates.",
  path: "/academy/leaderboard",
});

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-[50vh]" />}>
      <LeaderboardPage />
    </Suspense>
  );
}
