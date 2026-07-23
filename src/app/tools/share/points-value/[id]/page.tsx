import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SITE_URL } from "@/lib/seo";
import { PointsShareActions } from "@/components/tools/PointsShareActions";

type CardData = { platform?: string; domain?: string; sharePct?: number; tokens?: number; usd?: number; fdv?: number };

async function getCard(id: string) {
  const row = await prisma.sharedCard
    .findUnique({ where: { id }, select: { kind: true, data: true } })
    .catch(() => null);
  if (!row || row.kind !== "points-value") return null;
  return row.data as CardData;
}

// Rich-preview landing page for a shared Points Value result - a short link
// (/tools/share/points-value/<id>) backed by a SharedCard row instead of a
// long query string. This is the URL that gets posted/copied/shared; the raw
// PNG route alone can't carry Open Graph metadata. Same pattern as
// src/app/news/read/page.tsx's generateMetadata.
export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const params = await props.params;
  const card = await getCard(params.id);
  if (!card) return { title: "Points Value - XYZ Crypto" };
  const platform = card.platform || "Perp DEX";
  const usd = card.usd ?? 0;
  const title = `$${usd.toLocaleString(undefined, { maximumFractionDigits: 0 })} estimated points value - ${platform}`;
  const description = "Estimate what your points could be worth - try the free calculator on XYZ Crypto.";
  const image = `${SITE_URL}/api/tools/share/points-value/${params.id}`;
  return {
    title,
    description,
    openGraph: { title, description, images: [image], type: "website" },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function PointsValueSharePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const card = await getCard(params.id);
  if (!card) notFound();

  const usd = card.usd ?? 0;
  const sharePct = card.sharePct ?? 0;
  const tokens = card.tokens ?? 0;
  const platform = card.platform || "Perp DEX";
  const image = `/api/tools/share/points-value/${params.id}`;

  return (
    <>
      <Navbar />
      <main className="relative min-h-screen pt-28">
        <div className="mesh" />
        <div className="relative mx-auto max-w-2xl px-4 pb-24 sm:px-6">
          <div className="surface overflow-hidden rounded-4xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" className="w-full" />
            <div className="space-y-4 p-6 sm:p-8">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">{platform} points, estimated at</p>
                <p className="mono mt-1 text-4xl font-bold text-gold-gradient">
                  ${usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  {sharePct.toFixed(4)}% share · {tokens.toLocaleString(undefined, { maximumFractionDigits: 0 })} tokens (est.)
                </p>
              </div>
              <PointsShareActions imageUrl={image} platform={platform} usd={usd} />
              <p className="text-xs text-zinc-600">
                Assumption-based estimate, not official data.{" "}
                <Link href="/tools" className="text-gold-300 hover:underline">
                  Try the calculator yourself
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
