import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { PageBackground } from "@/components/PageBackground";
import { CreatorsClient } from "@modules/creators/components/CreatorsClient";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { pageSeo } from "@/lib/seo";

export const metadata: Metadata = pageSeo({
  title: "Creator Leaderboard: Top Perp DEX YouTube Videos and Variational Posts",
  description:
    "Search and rank the best YouTube videos on Variational, Hyperliquid, Lighter, Aster, edgeX and Paradex, plus a community leaderboard of the top Variational creators on X. Real public views, likes and comments.",
  path: "/creators",
});

// A static shell, like /points: both boards load on the client from their own
// cached API routes, so there is nothing per-request here and no revalidate.

export default function CreatorsPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Creators", path: "/creators" }])} />
      <Navbar />
      <main className="relative min-h-screen pt-28">
        <PageBackground />
        <div className="relative mx-auto max-w-[1200px] px-5 pb-24 sm:px-6 lg:px-8 xl:max-w-[1320px]">
          <div className="pt-2 sm:pt-4">
            <CreatorsClient />
          </div>
        </div>
      </main>
    </>
  );
}
