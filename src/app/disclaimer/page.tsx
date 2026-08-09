import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { pageSeo } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata: Metadata = pageSeo({
  title: "Disclaimer",
  description:
    "Nothing on XYZ Crypto is financial advice. What our research, market data, tools and AI assistant are - and the limits of each.",
  path: "/disclaimer",
});

const LAST_UPDATED = "9 August 2026";

export default function DisclaimerPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Disclaimer", path: "/disclaimer" }])}
      />
      <Navbar />
      <main className="relative min-h-screen pt-28">
        <div className="mesh" />
        <article className="relative mx-auto max-w-3xl px-4 pb-24 sm:px-6">
          <p className="mono text-xs uppercase tracking-[0.14em] text-zinc-500">Legal</p>
          <h1 className="mt-2 font-display text-3xl font-bold leading-tight text-zinc-50 sm:text-4xl">
            Disclaimer
          </h1>
          <p className="mt-3 text-sm text-zinc-500">Last updated: {LAST_UPDATED}</p>

          <div className="mt-6 rounded-xl border border-gold-500/20 bg-gold-500/[0.05] p-4 text-sm text-gold-100">
            Nothing on {site.name} is financial, investment, tax, or legal advice. Cryptocurrency is
            volatile and high-risk, and you can lose everything you put in. You are solely responsible
            for your own decisions.
          </div>

          <div className="prose-xyz mt-10">
            <h2>1. No financial advice</h2>
            <p>
              All research, market data, calculator outputs, AI assistant responses and community
              content on {site.name} are provided for general informational and educational purposes
              only. They are not a recommendation to buy, sell, or hold any asset, and they take no
              account of your circumstances, objectives, or risk tolerance. Consult a qualified,
              licensed professional before making any financial decision.
            </p>

            <h2>2. Market data can be wrong</h2>
            <p>
              Prices, TVL, volumes, yields and protocol metrics come from public third-party APIs
              (principally CoinGecko and DefiLlama) and are shown as received. They can be delayed,
              incomplete, or incorrect, and they are cached for short periods to keep the site fast.
              Never place a trade on a number read here without checking it at your venue.
            </p>

            <h2>3. The AI assistant can be wrong</h2>
            <p>
              XYZ AI answers from our published research and live market data, but it is a language
              model: it can misread, omit, or state something confidently that is untrue. Every answer
              carries that warning in the panel. Where it cites an article, read the article.
            </p>

            <h2>4. The Trading Journal is a record, not a signal</h2>
            <p>
              Analytics, risk figures and challenge results in the{" "}
              <Link href="/journal">Journal</Link> are computed from what you enter. They describe your
              past decisions. They do not predict future results, and past performance never implies
              future performance.
            </p>

            <h2>5. Third-party links and protocols</h2>
            <p>
              We link to exchanges, protocols, airdrop campaigns and other external sites. We do not
              control them, have not audited their contracts, and are not responsible for their
              security, solvency, or conduct. Interacting with any on-chain protocol risks total loss
              of funds. Verify contract addresses yourself, from the project&apos;s own channels.
            </p>

            <h2>6. No custody</h2>
            <p>
              <strong>
                {site.name} never holds, custodies, transmits, or has access to your cryptocurrency,
                funds, or private keys.
              </strong>{" "}
              Nobody from {site.name} will ever ask for your seed phrase or private key. Any message
              that does is a scam, regardless of what it appears to come from.
            </p>

            <h2>7. Availability and errors</h2>
            <p>
              The site is provided &ldquo;as is&rdquo;. Features can change, data feeds can fail, and
              pages can be unavailable. We correct errors when we find them or when they are reported —
              please <Link href="/contact">tell us</Link> if you spot one.
            </p>

            <h2>8. Your jurisdiction</h2>
            <p>
              Crypto regulation differs by country and changes often. It is your responsibility to know
              and follow the rules that apply where you live, including tax obligations.
            </p>

            <h2>Related</h2>
            <p>
              See also our <Link href="/terms">Terms of Service</Link>,{" "}
              <Link href="/privacy">Privacy Policy</Link>, and <Link href="/about">About</Link> page.
            </p>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
