import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { PageHeader } from "@/components/PageHeader";
import { PageBackground } from "@/components/PageBackground";
import { ChevronDown } from "lucide-react";
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

          {/* ⚠️ A one-line disclosure, not a four-line block.
              Measured on a 393px phone, the full banner occupied roughly a
              quarter of the first screen - above the nav, above every panel -
              to say something a reader needs ONCE. It was the largest element
              between the headline and the actual product.

              `<details>` rather than a React toggle on purpose: it is native, it
              needs no JavaScript, it is keyboard and screen-reader correct for
              free, and it cannot produce the hydration mismatch a client-only
              open/closed flag would. The claim is still one tap away and still
              the first thing under the headline, so nothing was hidden - it was
              folded. */}
          <details className="group mt-8 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] text-amber-200">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-xs font-medium [&::-webkit-details-marker]:hidden">
              <span aria-hidden>⚠</span>
              <span>Nothing here is a forecast. Volumes are live; the conversion is your assumption.</span>
              <ChevronDown
                className="ml-auto h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
                strokeWidth={1.7}
              />
            </summary>
            <p className="px-4 pb-3.5 pl-10 text-xs leading-relaxed text-amber-200">
              No perp DEX publishes a points-to-token rate before TGE. Volumes and peer valuations on this page are
              live market data; the conversion from points to tokens is an assumption you control, and every input
              is editable.
            </p>
          </details>

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
