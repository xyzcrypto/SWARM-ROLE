import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { PageBackground } from "@/components/PageBackground";
import { pageSeo } from "@/lib/seo";
import { ArrowLeft, Wallet } from "lucide-react";

export const metadata: Metadata = pageSeo({
  title: "Portfolio Tracker",
  description: "Track all your crypto farming and airdrop positions in one place.",
  path: "/portfolio",
});

export default function PortfolioPage() {
  return (
    <>
      <Navbar />
      <main className="relative min-h-screen pt-28 flex flex-col justify-center items-center">
        <PageBackground />
        <div className="relative mx-auto max-w-[680px] px-5 py-24 text-center">
          <span className="eyebrow eyebrow-glass inline-flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-400/80" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint-400" />
            </span>
            <span className="mono font-mono text-[10px] font-semibold uppercase tracking-[0.16em] sm:text-[11px]">
              <span className="text-[#fdf7e7]">Portfolio</span>{" "}
              <span className="text-shine">Intelligence</span>
            </span>
          </span>

          <div className="mx-auto mt-8 grid h-16 w-16 place-items-center rounded-2xl border border-hairline bg-surface-2 shadow-2xl">
            <Wallet className="h-8 w-8 text-gold-400" />
          </div>

          <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight text-content sm:text-5xl">
            Coming <span className="text-shine">Soon</span>
          </h1>

          <p className="mt-4 text-sm sm:text-base text-content-muted leading-relaxed max-w-lg mx-auto">
            We are building an all-in-one portfolio dashboard to track your farming positions, automated ROI analytics, and multi-wallet airdrop allocations.
          </p>

          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="/points"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold-400 to-amber-500 px-5 py-2.5 text-xs font-bold text-black shadow-lg shadow-gold-500/20 transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Points Calculator</span>
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
