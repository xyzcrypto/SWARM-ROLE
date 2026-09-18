import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { DEX_REGISTRY } from "@modules/markets/lib/dex-registry";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { SITE_URL } from "@/lib/seo";
import { PointsShareActions } from "@/components/tools/PointsShareActions";

/**
 * Where "try the calculator" should actually go.
 *
 * ⚠️ This pointed at `/tools`, which has not held the points calculator since it
 * moved to `/points`. A reader who followed a Sodex card landed on a page of
 * trading tools with no mention of Sodex and no calculator in sight - the single
 * worst link on a page whose whole job is bringing someone in from a share.
 *
 * Resolved against the registry by NAME rather than by a lookup table, so a
 * programme added tomorrow deep-links correctly with no second edit. An unknown
 * name degrades to the page itself, never to a broken anchor.
 */
function calculatorHref(platform: string): string {
  const key = platform.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!key) return "/points";
  const hit = DEX_REGISTRY.find((p) => p.name.toLowerCase().replace(/[^a-z0-9]/g, "") === key);
  // ⚠️ The SHORT address, not the anchor. `/points/Variational` is what a person
  // can read aloud, paste into a chat and recognise; `/points#programme-variational`
  // is what a developer writes. The short one redirects to the anchor, so both
  // land in the same place and only one of them has to be shareable.
  return hit ? `/points/${hit.name}` : "/points";
}

type CardData = { platform?: string; domain?: string; sharePct?: number; tokens?: number; usd?: number; fdv?: number };

// `cache()` is doing real work here, not decoration. Next calls
// generateMetadata() and the page component separately, and BOTH need the card
// - so this ran the identical query twice per request, on a page whose entire
// job is to show one row. React's per-request cache collapses them into one.
//
// This comment used to justify it with "~250ms of pure round trip paid twice"
// from a US Vercel region. **That is no longer true** - #210 moved functions to
// `bom1`, co-located with Supabase (see `vercel.json`), so a round trip is now
// cheap. Keep the `cache()` anyway: halving the query count is right on its own
// merits, and it is the difference between one DB read and two regardless of
// how far away the database is. Deleting work beats making work cheaper.
const getCard = cache(async (id: string) => {
  const row = await prisma.sharedCard
    .findUnique({ where: { id }, select: { kind: true, data: true } })
    .catch(() => null);
  if (!row || row.kind !== "points-value") return null;
  return row.data as CardData;
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
                <Link href={calculatorHref(platform)} className="text-gold-300 hover:underline">
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
