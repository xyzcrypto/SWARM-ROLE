import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Swords } from "lucide-react";
import { quizShare } from "@modules/academy/lib/share";
import { SITE_URL } from "@/lib/seo";
import { ShareSheet } from "@modules/academy/components/ShareSheet";

// The link people share after a quiz. Its preview (X, WhatsApp, Telegram) is
// the score card; the page offers the same questions as a challenge.
type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const q = await quizShare(id);
  if (!q) return { title: "Quiz challenge | XYZ Crypto Academy", robots: { index: false } };
  const title = `${q.name} scored ${q.score.toLocaleString("en-US")} (${q.correct}/${q.total}) | XYZ Crypto Academy`;
  const description = "Same questions, same clock. Can you beat this score?";
  const image = `${SITE_URL}/academy/card/quiz/${id}`;
  return { title, description, robots: { index: false }, openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] }, twitter: { card: "summary_large_image", title, description, images: [image] } };
}

export default async function QuizSharePage({ params }: Props) {
  const { id } = await params;
  const q = await quizShare(id);
  if (!q) notFound();
  const url = `${SITE_URL}/academy/s/quiz/${id}`;
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-300">Quiz challenge</p>
      <h1 className="mt-2 text-center font-display text-3xl font-semibold text-content sm:text-4xl">Can you beat {q.name}?</h1>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/academy/card/quiz/${id}`} alt={`${q.name} scored ${q.score} on XYZ Crypto Academy`} width={1200} height={630} className="mt-6 w-full rounded-2xl border border-hairline shadow-elevate" />
      <div className="mt-6 flex flex-col items-center gap-4">
        <Link href={`/academy/quiz?challenge=${id}`} className="btn-gold h-12 px-6 text-sm">
          <Swords className="h-4 w-4" /> Take the same quiz
        </Link>
        <ShareSheet url={url} image={`/academy/card/quiz/${id}`} text={`I scored ${q.score.toLocaleString("en-US")} (${q.correct}/${q.total}) on XYZ Crypto Academy. Can you beat me?`} className="justify-center" />
      </div>
    </div>
  );
}
