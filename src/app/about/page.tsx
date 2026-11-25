import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { pageSeo } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata: Metadata = pageSeo({
  title: "About",
  description:
    "What XYZ Crypto is, who it is for, how it makes money, and what it deliberately does not do. Written plainly.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "About", path: "/about" }])} />
      <Navbar />
      <main className="relative min-h-screen pt-28">
        <div className="mesh" />
        <article className="relative mx-auto max-w-3xl px-4 pb-24 sm:px-6">
          <p className="mono text-xs uppercase tracking-[0.14em] text-zinc-500">About</p>
          <h1 className="mt-2 font-display text-3xl font-bold leading-tight text-zinc-50 sm:text-4xl">
            About {site.name}
          </h1>
          <p className="mt-3 text-sm text-zinc-500">{site.slogan}</p>

          {/* Same honest framing the Terms page already uses. Search engines and
              readers both reward a trust page that states its limits. */}
          <div className="mt-6 rounded-xl border border-gold-500/20 bg-gold-500/[0.05] p-4 text-sm text-gold-100">
            {site.name} is currently operated by its founder(s) and has not yet been formally
            incorporated as a registered company. This page will be updated to name the registered
            entity once incorporation is complete.
          </div>

          <div className="prose-xyz mt-10">
            <h2>What this is</h2>
            <p>
              {site.name} is a Web3 research and community platform. It publishes on-chain and market
              research, shows live cryptocurrency market data, and gives members a personal{" "}
              <Link href="/journal">trading journal</Link>, a set of{" "}
              <Link href="/tools">calculators and tools</Link>, a{" "}
              <Link href="/community">community room</Link>, and an AI assistant that answers from the
              site&apos;s own published <Link href="/academy/research">research</Link>.
            </p>

            <h2>Who it is for</h2>
            <p>
              People who want to understand crypto rather than be told what to buy — traders keeping an
              honest record of their decisions, builders tracking protocols and airdrops, and readers
              who would rather have one careful explanation than ten confident threads.
            </p>

            <h2>What it is not</h2>
            <p>
              <strong>
                {site.name} is not an exchange, broker, custodian, or financial institution.
              </strong>{" "}
              We never hold, custody, transmit, or have access to anyone&apos;s cryptocurrency, funds, or
              private keys. Nothing here is financial, investment, tax, or legal advice — see the{" "}
              <Link href="/disclaimer">full disclaimer</Link>.
            </p>

            <h2>How it makes money</h2>
            <p>
              Through <Link href="/premium">Premium memberships</Link>. There is a free tier with real
              value in it, and Premium unlocks deeper research, higher limits and the full Journal. We
              do not sell member data, and we do not take payment to feature a token or protocol. Where
              anything on the site is sponsored or affiliated, it is labelled.
            </p>

            <h2>Where the data comes from</h2>
            <p>
              Market prices and protocol metrics come from public third-party APIs, principally
              CoinGecko and DefiLlama. They are shown as received and can be delayed, incomplete, or
              wrong; treat them as a starting point, not a source of truth for a trade.
            </p>

            <h2>Talk to us</h2>
            <p>
              Corrections, questions and criticism are all welcome — the{" "}
              <Link href="/contact">contact page</Link> reaches us directly, and every research post can
              be replied to. If something on this site is wrong, we would rather hear it than not.
            </p>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
