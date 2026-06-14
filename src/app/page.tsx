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
import { CtaBand } from "@/components/CtaBand";
import { Footer } from "@/components/Footer";
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

// Incrementally cached: the page is served instantly from cache and
// regenerated in the background every 5 minutes (member count / research
// preview). Publishing content revalidates it on demand (see research routes).
export const revalidate = 300;

export default async function HomePage() {
  const memberCount = await prisma.user.count().catch(() => 0);

  return (
    <>
      <Navbar />
      <main>
        <Hero memberCount={memberCount} />
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
