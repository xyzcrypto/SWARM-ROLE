import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { NewsClient } from "@/components/NewsClient";

export const metadata: Metadata = {
  title: "Live Web3 News",
  description:
    "Real-time Web3 news & intelligence — breaking news, market updates and everything across crypto, filterable by category, from reputable sources, with AI context.",
};

export const revalidate = 120;

export default function NewsPage() {
  return (
    <>
      <Navbar />
      <main className="relative min-h-screen pt-28">
        <div className="mesh" />
        <div className="relative mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold-400">
              Live Intelligence
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold text-zinc-50 sm:text-6xl">
              Web3 <span className="text-gold-gradient">News</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-zinc-400">
              Everything happening across crypto, in real time — filtered by what matters
              to you, from reputable sources, with AI context.
            </p>
          </div>

          <div className="mt-10">
            <NewsClient />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
