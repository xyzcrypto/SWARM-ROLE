import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SITE_URL } from "@/lib/seo";
import { PointsShareActions } from "@/components/tools/PointsShareActions";

type Params = {
  platform?: string;
  domain?: string;
  sharePct?: string;
  tokens?: string;
  usd?: string;
  fdv?: string;
};

function cardUrl(sp: Params) {
  const qs = new URLSearchParams();
  if (sp.platform) qs.set("platform", sp.platform);
  if (sp.domain) qs.set("domain", sp.domain);
  if (sp.sharePct) qs.set("sharePct", sp.sharePct);
  if (sp.tokens) qs.set("tokens", sp.tokens);
  if (sp.usd) qs.set("usd", sp.usd);
  if (sp.fdv) qs.set("fdv", sp.fdv);
  return `/api/tools/share/points-value?${qs.toString()}`;
}

// Rich-preview landing page for a shared Points Value result - the link that
// actually gets posted/copied/shared, since raw image URLs don't carry Open
// Graph metadata. Same pattern as src/app/news/read/page.tsx's generateMetadata.
export async function generateMetadata({ searchParams }: { searchParams: Params }): Promise<Metadata> {
  const platform = searchParams.platform || "Perp DEX";
  const usd = Number(searchParams.usd) || 0;
  const title = `$${usd.toLocaleString(undefined, { maximumFractionDigits: 0 })} estimated points value - ${platform}`;
  const description = "Estimate what your points could be worth - try the free calculator on XYZ Crypto.";
  const image = `${SITE_URL}${cardUrl(searchParams)}`;
  return {
    title,
    description,
    openGraph: { title, description, images: [image], type: "website" },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function PointsValueSharePage({ searchParams }: { searchParams: Params }) {
  const usd = Number(searchParams.usd) || 0;
  const sharePct = Number(searchParams.sharePct) || 0;
  const tokens = Number(searchParams.tokens) || 0;
  const platform = searchParams.platform || "Perp DEX";
  const image = cardUrl(searchParams);

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
