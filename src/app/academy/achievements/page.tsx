import type { Metadata } from "next";
import { AchievementsPage } from "@modules/academy/components/Achievements";
import { pageSeo } from "@/lib/seo";

export const metadata: Metadata = pageSeo({
  title: "Badges | XYZ Crypto Academy",
  description: "Collect XYZ Crypto Academy badges for quizzes, streaks, finished tracks, live wins and certificates. Rarer badges pay more XP.",
  path: "/academy/achievements",
});

export default function AcademyAchievementsPage() {
  return <AchievementsPage />;
}
