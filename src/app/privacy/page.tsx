import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How XYZ Crypto collects, uses, and protects your data.",
  alternates: { canonical: "/privacy" },
};

const LAST_UPDATED = "16 July 2026";

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="relative min-h-screen pt-28">
        <div className="mesh" />
        <article className="relative mx-auto max-w-3xl px-4 pb-24 sm:px-6">
          <p className="mono text-xs uppercase tracking-[0.14em] text-zinc-500">Legal</p>
          <h1 className="mt-2 font-display text-3xl font-bold leading-tight text-zinc-50 sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-zinc-500">Last updated: {LAST_UPDATED}</p>

          <div className="mt-6 rounded-xl border border-gold-500/20 bg-gold-500/[0.05] p-4 text-sm text-gold-100">
            XYZ Crypto is currently operated by its founder(s) and has not yet been formally incorporated
            as a registered company. This policy describes, honestly and specifically, what data the
            Service actually collects and how it&apos;s used - it will be updated to reference the
            registered corporate entity once incorporation is complete.
          </div>

          <div className="prose-xyz mt-10">
            <h2>1. What we collect</h2>
            <p><strong>Account data</strong> - name, email address, a securely hashed password (we never
            store your password in plain text), and optional profile information you add (avatar, bio,
            location, social links). If you sign in with Google, GitHub, or X/Twitter, we receive your
            basic profile info (name, email, avatar) from that provider.</p>
            <p><strong>Content you create</strong> - research comments and likes, community chat messages,
            direct messages, trading journal entries (trades, notes, challenges), and any files you
            upload (avatar/cover photos).</p>
            <p><strong>Usage &amp; technical data</strong> - pages you visit, timestamps, and your IP
            address (used briefly for abuse-prevention rate limiting, not stored long-term as a
            standalone profile).</p>

            <h2>2. How we use it</h2>
            <ul>
              <li>To operate the Service - create your account, save your content, show you your data.</li>
              <li>To send you account-related email (e.g. a one-time verification code at signup, password resets).</li>
              <li>To protect the Service from abuse, spam, and unauthorized access (rate limiting).</li>
              <li>To personalize your experience (e.g. your saved research, your own journal, your XP/achievements).</li>
              <li>To respond to support requests you send us.</li>
            </ul>
            <p>We do not sell your personal data to anyone, ever.</p>

            <h2>3. Cookies</h2>
            <p>
              We use a session cookie to keep you signed in. We do not currently use third-party
              advertising or cross-site tracking cookies.
            </p>

            <h2>4. Third-party service providers</h2>
            <p>
              To run the Service, we use the following third-party providers, each of which processes
              data only as needed to provide their specific function - we don&apos;t share more data with
              them than necessary:
            </p>
            <ul>
              <li><strong>Supabase</strong> - hosts our database, file storage (avatar/cover uploads), and real-time features (live chat, live updates).</li>
              <li><strong>Vercel</strong> - hosts and serves the website itself.</li>
              <li><strong>Upstash</strong> - rate limiting (briefly processes your IP address to prevent abuse).</li>
              <li><strong>Resend</strong> - sends transactional emails (signup verification codes, password resets).</li>
              <li><strong>Sentry</strong> - error monitoring, to help us catch and fix bugs (may capture technical error context, not your account password or private messages).</li>
              <li><strong>Groq / Google Gemini</strong> - power the XYZ AI assistant. If you use the assistant, your message is sent to whichever provider is answering that request.</li>
              <li><strong>LiveKit</strong> - powers community voice rooms (handles the audio connection if you join a voice room).</li>
              <li><strong>Google / GitHub / X (Twitter)</strong> - only if you choose to sign in using one of these, for authentication purposes.</li>
            </ul>
            <p>
              Market data providers (CoinGecko, Binance, DefiLlama) are used to show live prices and do
              not receive any of your personal data - those calls don&apos;t include any information
              about you.
            </p>

            <h2>5. Public vs. private content - please read this section</h2>
            <p>
              This matters specifically for the Trading Journal: <strong>trades you log are private by
              default</strong> and visible only to you. You can optionally mark an individual trade
              &ldquo;Public&rdquo; (shown with its symbol and direction) or &ldquo;Anonymous&rdquo;
              (shown without the symbol) - only trades you&apos;ve explicitly marked this way ever appear
              on your public profile&apos;s Journal Activity feed, and dollar amounts are never shown
              publicly, even for public trades.
            </p>
            <p>
              Separately: your public profile page, community chat messages, and research comments are
              inherently public by nature - anyone can see them, including people who aren&apos;t signed
              in. Direct messages and private journal entries are never public.
            </p>

            <h2>6. Data retention &amp; deletion</h2>
            <p>
              We keep your data for as long as your account is active. You can delete your account from
              Settings, or by contacting us at <a href={`mailto:${site.email}`}>{site.email}</a>; we will
              delete or anonymize your personal data within a reasonable time, except where we&apos;re
              legally required to retain certain records for longer.
            </p>

            <h2>7. Your rights</h2>
            <p>
              Depending on your location, you may have rights to access, correct, or delete your personal
              data, and to know what data we hold about you. Most of this you can already do yourself in
              Settings; for anything else, email <a href={`mailto:${site.email}`}>{site.email}</a>.
            </p>

            <h2>8. Children&apos;s privacy</h2>
            <p>The Service is not directed at anyone under 18, and we don&apos;t knowingly collect data from children.</p>

            <h2>9. Security</h2>
            <p>
              We use industry-standard practices - encrypted connections (HTTPS), securely hashed
              passwords, and rate limiting on sensitive actions. No system is 100% secure, and we can&apos;t
              guarantee absolute security, but we take reasonable steps to protect your data.
            </p>

            <h2>10. International data transfers</h2>
            <p>
              Some of the providers listed in Section 4 may process or store data outside India, depending
              on their hosting regions. We choose providers with strong security and privacy practices.
            </p>

            <h2>11. Changes to this policy</h2>
            <p>
              We may update this policy from time to time. Material changes will be reflected by updating
              the &ldquo;Last updated&rdquo; date at the top of this page.
            </p>

            <h2>12. Grievance Officer &amp; contact</h2>
            <p>
              In accordance with the Information Technology Act, 2000 and the Information Technology
              (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, questions or complaints
              about this policy or your data can be sent to:
            </p>
            <p>
              <strong>Grievance contact:</strong>{" "}
              <a href={`mailto:${site.email}`}>{site.email}</a>
              <br />
              A named Grievance Officer will be published here once {site.name} is formally registered as
              a company. See also our <Link href="/terms">Terms of Service</Link> and{" "}
              <Link href="/contact">Contact page</Link>.
            </p>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
