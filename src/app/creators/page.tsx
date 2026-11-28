import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { PageBackground } from "@/components/PageBackground";
import { CreatorsClient } from "@modules/creators/components/CreatorsClient";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { pageSeo } from "@/lib/seo";

export const metadata: Metadata = pageSeo({
  title: "Creator Leaderboard: Proof of Variational on X and Top Perp DEX YouTube",
  description:
    "Scan any X handle for its Proof of Variational: points, levels, XYZ Score and badges from real views and engagement. Plus the top YouTube creators on Variational, Hyperliquid, Lighter, Aster, edgeX and Paradex, all time.",
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
        <div className="relative mx-auto max-w-[75rem] px-5 pb-24 sm:px-6 lg:px-8 xl:max-w-[82.5rem]">
          <div className="pt-2 sm:pt-4">
            <CreatorsClient />
          </div>
        </div>
      </main>
    </>
  );
}
