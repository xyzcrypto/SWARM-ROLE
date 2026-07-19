import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of XYZ Crypto - our research, market data, trading journal, community and tools.",
  alternates: { canonical: "/terms" },
};

const LAST_UPDATED = "16 July 2026";

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="relative min-h-screen pt-28">
        <div className="mesh" />
        <article className="relative mx-auto max-w-3xl px-4 pb-24 sm:px-6">
          <p className="mono text-xs uppercase tracking-[0.14em] text-zinc-500">Legal</p>
          <h1 className="mt-2 font-display text-3xl font-bold leading-tight text-zinc-50 sm:text-4xl">
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-zinc-500">Last updated: {LAST_UPDATED}</p>

          <div className="mt-6 rounded-xl border border-gold-500/20 bg-gold-500/[0.05] p-4 text-sm text-gold-100">
            XYZ Crypto is currently operated by its founder(s) and has not yet been formally incorporated
            as a registered company. These Terms will be updated to reference the registered corporate
            entity once incorporation is complete. This document is a good-faith effort to set clear,
            fair rules for using the site and is not a substitute for advice from a qualified lawyer.
          </div>

          <div className="prose-xyz mt-10">
            <h2>1. Acceptance of these Terms</h2>
            <p>
              By creating an account, or by otherwise accessing or using {site.name} (the &ldquo;Service&rdquo;,
              &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;), you agree to be bound by these Terms
              of Service (&ldquo;Terms&rdquo;) and our <Link href="/privacy">Privacy Policy</Link>. If you do
              not agree, please do not use the Service.
            </p>

            <h2>2. What the Service is</h2>
            <p>
              {site.name} is a Web3 research and community platform. It provides published research
              articles, live cryptocurrency market data, a personal trading journal, calculators and
              tools, a community chat, and direct messaging between members.
            </p>
            <p>
              <strong>{site.name} is not a cryptocurrency exchange, broker, custodian, or financial
              institution.</strong> We never hold, custody, transmit, or have access to any user&apos;s
              cryptocurrency, funds, or private keys. Nothing on the Service constitutes an offer to buy
              or sell any security, token, or financial instrument.
            </p>

            <h2>3. Not financial advice</h2>
            <p>
              All research, market data, calculator outputs, AI assistant responses, and any other
              content on the Service are provided for general informational and educational purposes
              only. <strong>Nothing on {site.name} is financial, investment, tax, or legal advice.</strong>{" "}
              Cryptocurrency assets are volatile and high-risk. You are solely responsible for your own
              research and decisions, and should consult a qualified, licensed professional before making
              any financial decision.
            </p>

            <h2>4. Eligibility</h2>
            <p>
              You must be at least 18 years old (or the age of legal majority in your jurisdiction) to
              create an account. By registering, you confirm that you meet this requirement.
            </p>

            <h2>5. Your account</h2>
            <p>
              You&apos;re responsible for keeping your account credentials confidential and for all
              activity that happens under your account. Notify us immediately at{" "}
              <a href={`mailto:${site.email}`}>{site.email}</a> if you believe your account has been
              compromised. We may suspend or terminate accounts that violate these Terms.
            </p>

            <h2>6. Acceptable use</h2>
            <p>You agree not to use the Service to:</p>
            <ul>
              <li>Post or share illegal, defamatory, harassing, hateful, or sexually explicit content.</li>
              <li>Impersonate any person or entity, or misrepresent your affiliation with anyone.</li>
              <li>Spam, phish, or distribute malware, or attempt to disrupt or overload the Service.</li>
              <li>Attempt to gain unauthorized access to other accounts, systems, or data.</li>
              <li>Scrape, resell, or redistribute the Service&apos;s content or data at scale without permission.</li>
              <li>Use the Service for any activity that violates applicable law, including securities or financial-services regulations in your jurisdiction.</li>
            </ul>
            <p>
              We may remove content or suspend accounts that violate this section, at our discretion, and
              in line with our content-moderation and grievance-redressal process described below.
            </p>

            <h2>7. Content you create</h2>
            <p>
              You retain ownership of the content you post - comments, chat messages, direct messages,
              trading journal entries, and profile information. By posting content that is visible to
              other users (comments, public chat messages, or journal entries you explicitly mark
              &ldquo;Public&rdquo; or &ldquo;Anonymous&rdquo;), you grant {site.name} a non-exclusive,
              worldwide, royalty-free license to host, display, and distribute that content as part of
              operating the Service. You&apos;re solely responsible for content you post and confirm you
              have the right to post it.
            </p>

            <h2>8. Trading Journal</h2>
            <p>
              The Trading Journal is a personal record-keeping tool. Trade data you enter is exactly
              what you type in - we do not verify it against any exchange, broker, or real trading
              account, and we make no representation about its accuracy. Analytics, risk scores, and
              statistics computed from your journal are derived purely from the data you&apos;ve entered
              and are for your own reference only - not investment advice, and not a guarantee of future
              performance.
            </p>

            <h2>9. Premium / paid features</h2>
            <p>
              {site.name} currently offers a free tier. Paid membership tiers are planned but not yet
              launched at the time of writing. Once introduced, separate pricing, billing, and
              cancellation/refund terms will be published and will supplement these Terms.
            </p>

            <h2>10. Third-party content and links</h2>
            <p>
              The Service displays market data and links to third-party sources (including but not
              limited to CoinGecko, Binance, DefiLlama, and the protocols/projects covered in our
              research). We don&apos;t control and aren&apos;t responsible for third-party content,
              websites, or services, and referencing them is not an endorsement.
            </p>

            <h2>11. Intellectual property</h2>
            <p>
              The {site.name} name, logo, branding, and original site content (excluding user-generated
              content and third-party data) are owned by {site.name} and may not be copied, reproduced,
              or used without permission.
            </p>

            <h2>12. Disclaimers and limitation of liability</h2>
            <p>
              The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without
              warranties of any kind, express or implied. We do not guarantee the Service will be
              uninterrupted, error-free, or secure. To the fullest extent permitted by law, {site.name}
              and its operator(s) will not be liable for any indirect, incidental, or consequential
              damages, or for any financial loss arising from decisions made based on content available
              on the Service.
            </p>

            <h2>13. Termination</h2>
            <p>
              You may stop using the Service and delete your account at any time via Settings, or by
              contacting us. We may suspend or terminate access to the Service for anyone who violates
              these Terms.
            </p>

            <h2>14. Governing law</h2>
            <p>
              These Terms are governed by the laws of India, without regard to conflict-of-law
              principles. This is subject to change and will be updated once {site.name} is formally
              incorporated in a specific jurisdiction (see the note at the top of this page).
            </p>

            <h2>15. Changes to these Terms</h2>
            <p>
              We may update these Terms from time to time. Material changes will be reflected by
              updating the &ldquo;Last updated&rdquo; date above. Continued use of the Service after a
              change means you accept the updated Terms.
            </p>

            <h2>16. Grievance Officer &amp; contact</h2>
            <p>
              In accordance with the Information Technology Act, 2000 and the Information Technology
              (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, the following contact
              is designated to receive complaints regarding content on the Service. A named individual
              will be published here once {site.name} is formally registered as a company.
            </p>
            <p>
              <strong>Grievance contact:</strong>{" "}
              <a href={`mailto:${site.email}`}>{site.email}</a>
              <br />
              We aim to acknowledge complaints within 24 hours and resolve them within the timelines
              required by applicable law.
            </p>
            <p>
              For any other questions about these Terms, reach us at{" "}
              <a href={`mailto:${site.email}`}>{site.email}</a> or via our{" "}
              <Link href="/contact">Contact page</Link>.
            </p>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
