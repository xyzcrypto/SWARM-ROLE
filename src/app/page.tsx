import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { MarketTicker } from "@/components/MarketTicker";
import { OrbitalSection } from "@/components/OrbitalSection";
import { ProofStrip } from "@/components/ProofStrip";
import { About } from "@/components/About";
import { Products } from "@/components/Products";
import { ResearchPreview } from "@/components/ResearchPreview";
import { WhatsNew } from "@/components/WhatsNew";
import { LiveStats } from "@/components/LiveStats";
import { Ecosystem } from "@/components/Ecosystem";
import { Social } from "@/components/Social";
import { Faq } from "@/components/Faq";
import { CtaBand } from "@/components/CtaBand";
import { Footer } from "@/components/Footer";
import { JsonLd, faqJsonLd } from "@/lib/jsonld";
import { FAQ } from "@/lib/faq";
import { StickyCta } from "@/components/StickyCta";
import { GuestOnly } from "@/components/GuestOnly";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

// Brand-tuned homepage metadata (absolute title so it isn't suffixed by the
// layout template) + self-canonical for clean indexing of "XYZ Crypto" searches.
export const metadata: Metadata = {
  title: { absolute: "XYZ Crypto - Web3 Research, Trading Tools, Perp DEX & Academy" },
  description:
    "XYZ Crypto is a next-generation Web3 ecosystem: on-chain research, pro trading tools, an upcoming perpetual DEX, airdrop intelligence, premium intel and a free academy - all in one trusted brand.",
  alternates: { canonical: "/" },
};

// Incrementally cached: served instantly from cache, regenerated in the
// background, and revalidated ON DEMAND the moment content changes.
//
// ⚠️ 300s -> 900s, and the on-demand path is why that is safe rather than
// merely cheaper. Every write route that can change what this page shows
// already calls `revalidatePath("/")` - both research routes and all three
// whatsnew routes - so a publish appears here immediately, not up to a window
// later. The timer is therefore only refreshing a member count and the "Xh ago"
// label, and at 300s it was rebuilding the page 288 times a day to do it:
// **385 ISR Writes against 185 Reads**.
//
// Not pushed further than 900s because `agoLabel` below is rendered on the
// server, so the window is also the worst-case error on that label. 15 minutes
// keeps it honest; an hour would not. Moving that label to the client
// `useHydrated()` pattern (as chat timestamps already do) would lift this
// ceiling, but that is a UI change, not a caching one.
export const revalidate = 900;

// "2h ago" / "3d ago" for the newest research post, computed on the SERVER and
// passed down as a finished string. Deliberately not calculated in the client
// component: a relative time derived at render time differs between the server
// and the browser's first render, which is exactly the class of mismatch that
// threw React #418 across this site before (see CLAUDE.md). One string,
// rendered once, cannot disagree with itself.
//
// The clock is read inside the helper rather than in the component body: this
// only runs on the server, but `Date.now()` in a render body trips the purity
// lint rule, and that rule is right about client components.
function agoLabel(then: Date): string {
  const mins = Math.max(0, Math.round((Date.now() - then.getTime()) / 60000));
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default async function HomePage() {
  // Everything the hero card claims, all of it real rows.
  //
  // Server-rendered rather than polled, and that is the stronger option here,
  // not the cheaper compromise: both research write routes already call
  // revalidatePath("/"), so publishing a post regenerates this page at once.
  // A poller would show the same post up to one interval LATER, and would add
  // a route, a request per visitor and a timer. This adds none of those.
  //
  // Only the newest row is read. The card used to scroll a band of titles and
  // fetched twelve for it; with the band gone, a `take: 12` that returns
  // eleven unused rows is just payload nobody renders.
  const [memberCount, newestResearch, researchCount] = await Promise.all([
    prisma.user.count().catch(() => 0),
    prisma.post
      .findFirst({
        where: { published: true, category: "Research" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      })
      .catch(() => null),
    prisma.post.count({ where: { published: true, category: "Research" } }).catch(() => 0),
  ]);

  const research = {
    count: researchCount,
    newest: newestResearch ? agoLabel(newestResearch.createdAt) : null,
  };

  return (
    <>
      <Navbar />
      <main>
        <Hero memberCount={memberCount} research={research} />
        <MarketTicker />
        {/* Orbital ecosystem - the signature centerpiece showcase. */}
        <OrbitalSection />
        <ProofStrip />
        {/* Real-time pulse: online now + visits today/total + members. */}
        <LiveStats className="mx-auto max-w-5xl px-4 py-6" />
        <About />
        <Products />
        <ResearchPreview />
        {/* "What's New" - dynamic feature feed (src/lib/whatsnew.ts). */}
        <WhatsNew />
        <Ecosystem />
        <Social />
        <Faq />
        <JsonLd data={faqJsonLd(FAQ)} />
        {/* Sign-up CTA - shown to guests only (members already have an account). */}
        <GuestOnly>
          <CtaBand memberCount={memberCount} />
        </GuestOnly>
      </main>
      <Footer />
      <StickyCta />
    </>
  );
}
