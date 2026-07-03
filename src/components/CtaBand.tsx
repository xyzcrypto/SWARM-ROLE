import { Check } from "lucide-react";
import { Reveal } from "./Reveal";
import { Container, Section } from "./ui/primitives";
import { WaitlistForm } from "./WaitlistForm";
import { EarlyAccessCta } from "./EarlyAccessCta";

const benefits = [
  "Early access to the Perp DEX & trading tools",
  "Private Web3 research & curated alpha",
  "Airdrop alerts & eligibility tracking",
];

export function CtaBand({ memberCount = 0 }: { memberCount?: number }) {
  return (
    <Section>
      <Container>
        <Reveal>
          <div className="relative overflow-hidden rounded-4xl border border-line-gold bg-ink-900 px-6 py-14 sm:px-12 sm:py-16">
            <div className="mesh" />
            <div className="grain" />
            <div className="relative grid items-center gap-10 lg:grid-cols-2">
              <div>
                <h2 className="font-display text-display-md font-semibold tracking-tight text-zinc-50">
                  Your edge in Web3 starts here.
                </h2>
                <p className="mt-4 max-w-md text-zinc-400">
                  One free account unlocks the research hub, early product
                  access and the community.
                </p>
                <ul className="mt-6 space-y-2.5">
                  {benefits.map((b) => (
                    <li key={b} className="flex items-center gap-3 text-sm text-zinc-300">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-mint-500/15 text-mint-300 ring-1 ring-mint-500/30">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>

              {/* ONE primary conversion path: the free account (gold). The
                  waitlist is the low-commitment fallback, demoted below it —
                  previously both competed as equals inside the same card. */}
              <div className="lg:pl-8">
                <div className="surface rounded-3xl p-6">
                  <p className="font-display text-base font-semibold text-zinc-100">
                    Create your free account
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    Takes under a minute — no wallet required.
                  </p>
                  <div className="mt-5">
                    <EarlyAccessCta className="btn-gold w-full" label="Get started free" />
                  </div>
                  {memberCount > 0 && (
                    <p className="mt-3 text-center mono text-[11px] text-zinc-500">
                      {memberCount.toLocaleString("en-US")}+ registered members
                    </p>
                  )}
                  <div className="my-5 flex items-center gap-3 text-[11px] text-zinc-600">
                    <span className="h-px flex-1 bg-line" />
                    not ready yet?
                    <span className="h-px flex-1 bg-line" />
                  </div>
                  <p className="text-sm text-zinc-500">Just get the updates by email:</p>
                  <div className="mt-3">
                    <WaitlistForm source="cta-band" cta="Join" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
