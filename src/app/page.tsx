import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { StatsBand } from "@/components/StatsBand";
import { About } from "@/components/About";
import { Products } from "@/components/Products";
import { ResearchPreview } from "@/components/ResearchPreview";
import { Ecosystem } from "@/components/Ecosystem";
import { Social } from "@/components/Social";
import { CtaBand } from "@/components/CtaBand";
import { Footer } from "@/components/Footer";
import { StickyCTA } from "@/components/StickyCTA";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <StatsBand />
        <About />
        <Products />
        <ResearchPreview />
        <Ecosystem />
        <Social />
        <CtaBand />
      </main>
      <Footer />
      <StickyCTA />
    </>
  );
}
