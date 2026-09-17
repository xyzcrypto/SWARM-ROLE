import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { PageHeader } from "@/components/PageHeader";
import { PageBackground } from "@/components/PageBackground";
import { AssumptionBanner } from "@modules/tools/components/CalcField";
import { PointsClient } from "@modules/points/components/PointsClient";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { pageSeo } from "@/lib/seo";

export const metadata: Metadata = pageSeo({
  title: "Points & Airdrop Intelligence",
  description:
    "Value your perp DEX points with live comparables: derive an unlisted venue's FDV from peers that already have a token, then model your share, your true cost basis and your break-even.",
  path: "/points",
});

// A static shell. The comparables come from /api/points/comps on the client, so
// nothing here is per-request and there is no `export const revalidate` -
// exactly the reasoning that removed the window from /markets and /tools, where
// an ISR window only bought hourly rebuilds of byte-identical HTML (measured at
// 88 ISR writes against 95 reads). Add one back only if this page gains server
// data of its own.

export default function PointsPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Points", path: "/points" }])} />
      <Navbar />
      <main className="relative min-h-screen pt-28">
        <PageBackground />
        {/* The system container, not a narrower one-off. This page was `max-w-5xl`
            (1024px) while every other page runs 1200 -> 1320 -> 1480, so its cards
            sat visibly narrower than the site around them and its data tables had
            to scroll sideways at widths where they did not need to. */}
        <div className="relative mx-auto max-w-[1200px] px-5 pb-24 sm:px-6 lg:px-8 xl:max-w-[1320px]">
          <PageHeader
            eyebrow="Airdrop Farming"
            title={
              <>
                Points <span className="text-shine">Intelligence</span>
              </>
            }
            subtitle="Most points calculators ask you to guess an FDV and then do arithmetic on your guess. This one derives it from venues that already have a token, shows the range rather than a number, and prices what the farm has cost you."
          />

          <div className="mt-10 sm:mt-12">
            <AssumptionBanner>
              No perp DEX publishes a points-to-token rate before TGE, so nothing here is a forecast. Volumes and
              peer valuations are live; the conversion from points to tokens is your assumption, and every input
              is editable.
            </AssumptionBanner>
          </div>

          <div className="mt-6 sm:mt-8">
            <PointsClient />
          </div>

          <div className="surface surface-hover lift mt-8 flex flex-col items-center gap-3 rounded-3xl p-7 text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <h3 className="font-display text-lg font-semibold text-content">Trading, not farming?</h3>
              <p className="mt-1 text-sm text-content-muted">
                Funding fees, liquidation price, position sizing and PnL live in Trading Tools.
              </p>
            </div>
            <Link href="/tools" className="btn-secondary shrink-0">
              Open Trading Tools
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
