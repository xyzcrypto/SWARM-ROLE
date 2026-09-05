import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { SITE_URL } from "@/lib/seo";
import { PointsShareActions } from "@/components/tools/PointsShareActions";

import { getSharedPointsCard, type CardData } from "@/lib/shared-card";

// React per-request cache + in-memory snapshot cache in getSharedPointsCard.
const getCard = cache(async (id: string) => {
  return getSharedPointsCard(id);
});

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
  // ⚠️ NOT under `/api/`, and that is the whole point.
  //
  // This card used to be served from `/api/tools/share/points-value/<id>` —
  // and `robots.ts` disallows `/api/`. **X's card crawler obeys robots.txt for
  // the image as well as the page**, so it fetched the page, found a perfectly
  // correct `twitter:image` pointing into a disallowed path, and rendered the
  // post with no banner at all. Every points share on X went out bare, for
  // every listed perp DEX, while the research and homepage cards (whose images
  // live outside `/api/`) worked fine — which is exactly why it looked like a
  // tools-only problem.
  //
  // Moving the route rather than punching a hole in robots.txt is deliberate:
  // an `Allow:` more specific than a `Disallow:` relies on each crawler's
  // precedence rules, and this has to work on every one of them.
  const image = `${SITE_URL}/tools/share/points-value/${params.id}/card`;
  // Explicit dimensions, matching the route's own SIZE. `summary_large_image`
  // is a request, not a guarantee: without width/height a crawler has to fetch
  // and measure the PNG before it will commit to the large layout, and any
  // hiccup there drops the post to the small card - or to none. Stating them
  // costs nothing and removes that step.
  const img = { url: image, width: 1200, height: 630, alt: title };
  return {
    title,
    description,
    openGraph: { title, description, images: [img], type: "website" },
    twitter: { card: "summary_large_image", title, description, images: [img] },
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
  const image = `/tools/share/points-value/${params.id}/card`;

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
    </>
  );
}
