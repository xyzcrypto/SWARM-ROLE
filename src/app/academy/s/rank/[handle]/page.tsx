import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Trophy } from "lucide-react";
import { parsePeriod, PERIOD_LABEL, rankShare } from "@modules/academy/lib/share";
import { SITE_URL } from "@/lib/seo";
import { ShareSheet } from "@modules/academy/components/ShareSheet";

// A shareable leaderboard standing. Its preview is the rank card.
type Props = { params: Promise<{ handle: string }>; searchParams: Promise<{ p?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { handle } = await params;
  const period = parsePeriod((await searchParams).p);
  const r = await rankShare(handle, period).catch(() => null);
  if (!r) return { title: "Leaderboard | XYZ Crypto Academy", robots: { index: false } };
  const title = r.rank ? `${r.name} is #${r.rank} ${PERIOD_LABEL[period].toLowerCase()} | XYZ Crypto Academy` : `${r.name} on XYZ Crypto Academy`;
  const description = `Level ${r.level.level} ${r.level.name}, ${r.totalXp.toLocaleString("en-US")} XP. Learn Web3 and climb the board.`;
  const image = `${SITE_URL}/academy/card/rank/${r.username}?p=${period}`;
  return { title, description, robots: { index: false }, openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] }, twitter: { card: "summary_large_image", title, description, images: [image] } };
}

export default async function RankSharePage({ params, searchParams }: Props) {
  const { handle } = await params;
  const period = parsePeriod((await searchParams).p);
  const r = await rankShare(handle, period).catch(() => null);
  if (!r) notFound();
  const img = `/academy/card/rank/${r.username}?p=${period}`;
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-center text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-gold-300">Leaderboard · {PERIOD_LABEL[period]}</p>
      <h1 className="mt-2 text-center font-display text-3xl font-semibold text-content sm:text-4xl">{r.rank ? `${r.name} is #${r.rank}` : r.name}</h1>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img} alt={`${r.name} leaderboard card`} width={1200} height={630} className="mt-6 w-full rounded-2xl border border-hairline shadow-elevate" />
      <div className="mt-6 flex flex-col items-center gap-4">
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/academy/leaderboard" className="btn-gold h-12 px-6 text-sm">
            <Trophy className="h-4 w-4" /> See the leaderboard
          </Link>
          <Link href={`/u/${r.username}`} className="btn-secondary h-12 px-6 text-sm">
            View profile
          </Link>
        </div>
        <ShareSheet url={`${SITE_URL}/academy/s/rank/${r.username}?p=${period}`} image={img} text={r.rank ? `I'm #${r.rank} on the XYZ Crypto Academy leaderboard ${PERIOD_LABEL[period].toLowerCase()}. Come beat me.` : "I'm learning Web3 on XYZ Crypto Academy."} className="justify-center" />
      </div>
    </div>
  );
}
