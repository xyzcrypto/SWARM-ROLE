import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { MarketTicker } from "@/components/MarketTicker";
import { ProofStrip } from "@/components/ProofStrip";
import { About } from "@/components/About";
import { Products } from "@/components/Products";
import { ResearchPreview } from "@/components/ResearchPreview";
import { Ecosystem } from "@/components/Ecosystem";
import { Social } from "@/components/Social";
import { CtaBand } from "@/components/CtaBand";
import { Footer } from "@/components/Footer";
import { StickyCta } from "@/components/StickyCta";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const memberCount = await prisma.user.count().catch(() => 0);

  return (
    <>
      <Navbar />
      <main>
        <Hero memberCount={memberCount} />
        <MarketTicker />
        <ProofStrip />
        <About />
        <Products />
        <ResearchPreview />
        <Ecosystem />
        <Social />
        <CtaBand memberCount={memberCount} />
      </main>
      <Footer />
      <StickyCta />
    </>
  );
}
