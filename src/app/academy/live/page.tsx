import type { Metadata } from "next";
import { LiveList } from "@modules/academy/components/LiveList";
import { pageSeo } from "@/lib/seo";

export const metadata: Metadata = pageSeo({
  title: "Live Web3 Quiz Arena | XYZ Crypto Academy",
  description: "Live multiplayer Web3 quizzes: same question, same clock, real-time leaderboard. Winners earn XP and official certificates.",
  path: "/academy/live",
});

export default function LivePage() {
  return <LiveList />;
}
