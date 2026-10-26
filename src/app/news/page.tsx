import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { NewsClient } from "@/components/NewsClient";
import { PageHeader } from "@/components/PageHeader";
import { PageBackground } from "@/components/PageBackground";
import { getNewsPage } from "@/lib/news-fetch";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { pageSeo } from "@/lib/seo";

export const metadata: Metadata = pageSeo({
  title: "Live Web3 News",
  description:
    "Real-time Web3 news & intelligence - breaking news, market updates and everything across crypto, filterable by category, from reputable sources, with AI context.",
  path: "/news",
});

// Revalidate the server-rendered first batch so first paint is fresh + fast.
//
// ⚠️ 90s -> 300s. This window only governs the FIRST PAINT: `NewsClient` polls
// `/api/news` every 90s and refreshes in place, so a reader is on live data
// within 90 seconds of landing regardless of what this number is. At 90s it was
// rebuilding the whole page - Navbar, header, JSON-LD, the lot - as often as the
// client refreshed just the feed, which is a large part of why `/news` showed
// **560 ISR Writes against 166 Reads**, the worst ratio on the site.
//
// ⚠️ This 300 is a CEILING, not the effective window. `getNewsPage` below uses
// the shared feed cache (`NEWS_REVALIDATE`, 120s) for both its fetch hint and
// its `unstable_cache`, and Next takes the MINIMUM across a route segment - so
// the build output reports this page at **2m**, not 5m. Verified in the route
// table: it read `≈2m` before this change (90s) and `2m` after (120s). The real
// gain for `/news` is therefore 90s -> 120s here, plus `/api/news` no longer
// expiring exactly on the poll boundary.
//
// Raising this number alone will not move the page; `NEWS_REVALIDATE` is the
// lever. Decoupling the two would mean giving the page its own longer-lived
// copy of the feed, which costs a second cache entry and extra upstream fetches
// - the opposite trade. See docs/changelog.md for the structural alternative
// (dropping the server-rendered first batch entirely, which would make this
// page fully static like /markets, at the cost of first paint and of the feed
// being in the initial HTML).
export const revalidate = 300;

export default async function NewsPage() {
  // Server-render the first batch so the feed paints instantly (no blank fetch).
  const initial = await getNewsPage({ page: 1 }).catch(() => null);
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "News", path: "/news" }])} />
      <Navbar />
      <main className="relative min-h-screen pt-24 sm:pt-28 bg-[#e9edf4] dark:bg-[#0c0e14] text-zinc-900 dark:text-zinc-100 selection:bg-amber-500/25 overflow-x-clip">
        <PageBackground />
        {/* Soft Neumorphic Studio Lighting: Directional Top-Left Soft Ambience */}
        <div aria-hidden className="pointer-events-none absolute -left-40 top-0 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-amber-400/[0.07] via-gold-500/[0.03] to-transparent blur-[140px]" />
        <div aria-hidden className="pointer-events-none absolute right-0 top-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-bl from-indigo-500/[0.05] via-purple-500/[0.02] to-transparent blur-[140px]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <PageHeader
            eyebrow="Live Intelligence"
            title={<>Web3 <span className="text-shine">News</span></>}
            subtitle="Everything happening across crypto, in real time, filtered by what matters to you, from reputable sources, with AI context."
          />

          <div className="mt-8 sm:mt-10">
            <NewsClient initial={initial} />
          </div>
        </div>
      </main>
    </>
  );
}
