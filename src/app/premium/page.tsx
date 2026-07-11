import type { Metadata } from "next";
import { Check, Hourglass } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Container, Section, SectionHeading, Badge } from "@/components/ui/primitives";
import { Reveal } from "@/components/Reveal";
import { ActionLink } from "@/components/ActionLink";
import { AnimatedEmoji } from "@/components/AnimatedEmoji";
import { GuestOnly } from "@/components/GuestOnly";
import { SignedIn } from "@/components/SignedIn";

export const metadata: Metadata = {
  title: "Premium Plans - Coming Soon",
  description:
    "XYZ Crypto Premium is on the way: private research, early product access, airdrop intelligence and more. Join the waitlist for launch.",
  alternates: { canonical: "/premium" },
};

const tiers = [
  {
    name: "Free",
    price: "$0",
    note: "Available now",
    available: true,
    features: ["Public research hub", "Community chat", "Market data & ticker", "Profile & account"],
  },
  {
    name: "Premium",
    price: "Coming soon",
    note: "Launching shortly",
    highlight: true,
    features: [
      "Private Web3 research & curated alpha",
      "Early access to the Perp DEX & trading tools",
      "Airdrop alerts & eligibility tracking",
      "Priority support",
    ],
  },
  {
    name: "Pro / Teams",
    price: "Coming soon",
    note: "On the roadmap",
    features: ["Everything in Premium", "Team seats & shared workspaces", "Advanced on-chain analytics", "API access"],
  },
];

export default function PremiumPage() {
  return (
    <>
      <Navbar />
      <main className="relative min-h-screen pt-24">
        <div className="mesh" />
        <Section className="relative">
          <Container>
            <div className="mx-auto max-w-2xl text-center">
              <Reveal>
                <Badge tone="gold" className="!px-3 !py-1">
                  <Hourglass className="h-3.5 w-3.5" /> Coming soon
                </Badge>
              </Reveal>
              <Reveal delay={1}>
                <h1 className="mt-5 font-display text-display-lg font-semibold tracking-tight text-zinc-50">
                  Premium Plans
                  <span className="mt-1 block text-shine">
                    Coming Soon{" "}
                    <AnimatedEmoji emoji="🚀" variant="launch" className="align-middle text-[0.9em]" />
                  </span>
                </h1>
              </Reveal>
              <Reveal delay={2}>
                <p className="mt-4 text-base leading-relaxed text-zinc-400">
                  We&apos;re putting the finishing touches on XYZ Crypto Premium - private
                  research, early product access and airdrop intelligence. Plans and pricing
                  will be announced here. Create a free account to be first in line.
                </p>
              </Reveal>
              <Reveal delay={3}>
                {/* Guests are prompted to sign up; members already have an account,
                    so they get a member-appropriate CTA instead. */}
                <GuestOnly>
                  <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                    <ActionLink href="/signup" className="btn-gold !px-6">
                      Create a free account
                    </ActionLink>
                    <ActionLink href="/research" className="btn-ghost !px-6">
                      Explore research
                    </ActionLink>
                  </div>
                </GuestOnly>
                <SignedIn>
                  <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                    <ActionLink href="/research" className="btn-gold !px-6">
                      Explore research
                    </ActionLink>
                    <ActionLink href="/profile" className="btn-ghost !px-6">
                      Your profile
                    </ActionLink>
                  </div>
                </SignedIn>
              </Reveal>
            </div>

            <div className="mt-16 grid gap-5 lg:grid-cols-3">
              {tiers.map((t, i) => (
                <Reveal key={t.name} delay={i + 1}>
                  <div
                    className={
                      "relative flex h-full flex-col rounded-3xl border p-6 sm:p-7 " +
                      (t.highlight
                        ? "border-gold-500/30 bg-gradient-to-b from-gold-500/[0.07] to-transparent"
                        : "border-line surface")
                    }
                  >
                    {t.highlight && (
                      <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-gold-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gold-200 ring-1 ring-gold-500/30">
                        <AnimatedEmoji emoji="⭐" variant="twinkle" className="text-xs" /> Most popular
                      </span>
                    )}
                    <p className="font-display text-lg font-semibold text-zinc-100">{t.name}</p>
                    <p className="mt-2 font-display text-2xl font-bold text-zinc-50">{t.price}</p>
                    <p className="mt-1 text-[12px] text-zinc-500">{t.note}</p>
                    <ul className="mt-5 space-y-2.5">
                      {t.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-300">
                          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mint-500/15 text-mint-300 ring-1 ring-mint-500/30">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-6 pt-1">
                      {t.available ? (
                        <ActionLink href="/signup" className="group btn-secondary w-full">
                          Get started{" "}
                          <AnimatedEmoji emoji="🚀" variant="launch" hoverOnly className="text-[0.95em]" />
                        </ActionLink>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="btn-ghost w-full cursor-not-allowed opacity-60"
                        >
                          Notify me at launch
                        </button>
                      )}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>

            <SectionHeading
              className="mt-20"
              eyebrow="Stay in the loop"
              title={<>Be first to know when Premium goes live</>}
              subtitle="A free account gets you research, community and early-access perks today - and a front-row seat for the Premium launch."
            />
            <div className="mt-7 flex justify-center">
              <GuestOnly>
                <ActionLink href="/signup" className="btn-gold !px-7">
                  Create your free account
                </ActionLink>
              </GuestOnly>
              <SignedIn>
                <ActionLink href="/research" className="btn-gold !px-7">
                  Explore the research hub
                </ActionLink>
              </SignedIn>
            </div>
          </Container>
        </Section>
      </main>
      <Footer />
    </>
  );
}
