import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { MarketTicker } from "@/components/MarketTicker";
import { OrbitalSection } from "@/components/OrbitalSection";
import { ProofStrip } from "@/components/ProofStrip";
import { About } from "@/components/About";
import { Products } from "@/components/Products";
import { ResearchPreview } from "@/components/ResearchPreview";
import { MembersShowcase } from "@/components/MembersShowcase";
import { Ecosystem } from "@/components/Ecosystem";
import { Social } from "@/components/Social";
import { CtaBand } from "@/components/CtaBand";
import { Footer } from "@/components/Footer";
import { StickyCta } from "@/components/StickyCta";
import { GuestOnly } from "@/components/GuestOnly";
import { prisma } from "@/lib/prisma";

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
        <About />
        <Products />
        <ResearchPreview />
        <MembersShowcase memberCount={memberCount} />
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
