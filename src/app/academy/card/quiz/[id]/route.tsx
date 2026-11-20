import { quizShare } from "@modules/academy/lib/share";
import { shareCard } from "@modules/academy/lib/share-card";

export const runtime = "nodejs";

// PNG share card for a finished quiz. A finished attempt never changes, so the
// card is immutable; a missing one gets a short-cached generic card.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = await quizShare(id);
  if (!q) {
    return shareCard({ eyebrow: "QUIZ CHALLENGE", title: "Can you beat this score?", name: "XYZ Crypto Academy", stats: [{ label: "Questions", value: "10" }, { label: "Scored on", value: "the server" }, { label: "Price", value: "Free" }] }, "public, s-maxage=60, stale-while-revalidate=60");
  }
  return shareCard(
    {
      eyebrow: q.modeLabel.toUpperCase(),
      title: `${q.score.toLocaleString("en-US")} points`,
      name: `${q.name} scored`,
      subtitle: "Same questions, same clock. Can you beat it?",
      badge: `${q.correct}/${q.total}`,
      stats: [
        { label: "Correct", value: `${q.correct} of ${q.total}` },
        { label: "Accuracy", value: `${q.accuracy}%` },
        { label: "Difficulty", value: q.difficulty ? q.difficulty[0].toUpperCase() + q.difficulty.slice(1) : "Mixed" },
      ],
      footer: "xyzcrypto.io/academy",
    },
    "public, max-age=31536000, s-maxage=31536000, immutable"
  );
}
