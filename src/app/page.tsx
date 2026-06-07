import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { About } from "@/components/About";
import { Products } from "@/components/Products";
import { ResearchPreview } from "@/components/ResearchPreview";
import { Ecosystem } from "@/components/Ecosystem";
import { Social } from "@/components/Social";
import { CtaBand } from "@/components/CtaBand";
import { Footer } from "@/components/Footer";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <About />
        <Products />
        <ResearchPreview />
        <Ecosystem />
        <Social />
        <CtaBand />
      </main>
      <Footer />
    </>
  );
}
