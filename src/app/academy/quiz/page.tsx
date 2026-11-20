import type { Metadata } from "next";
import { Suspense } from "react";
import { QuizClient } from "@modules/academy/components/QuizClient";
import { pageSeo } from "@/lib/seo";

export const metadata: Metadata = pageSeo({
  title: "Web3 Quiz: Quick, Topic, Daily and Weekly Challenges | XYZ Crypto Academy",
  description: "Timed Web3 quizzes scored on correctness, difficulty, speed and streaks. Earn XP, level up and climb the global leaderboard.",
  path: "/academy/quiz",
});

export default function QuizPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh]" />}>
      <QuizClient />
    </Suspense>
  );
}
