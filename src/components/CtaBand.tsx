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
                  Ready to join the{" "}
                  <span className="text-gold-gradient">next generation of Web3?</span>
                </h2>
                <p className="mt-4 max-w-md text-zinc-400">
                  Create your free XYZ Crypto account to unlock research, early
                  product access and the full ecosystem.
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

              <div className="lg:pl-8">
                <div className="surface rounded-3xl p-6">
                  <p className="font-display text-base font-semibold text-zinc-100">
                    Join the waitlist
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    Drop your email for early access, no wallet, no account
                    needed to start.
                  </p>
                  <div className="mt-5">
                    <WaitlistForm source="cta-band" cta="Join" />
                  </div>
                  <div className="my-5 flex items-center gap-3 text-[11px] text-zinc-600">
                    <span className="h-px flex-1 bg-line" />
                    or
                    <span className="h-px flex-1 bg-line" />
                  </div>
                  <EarlyAccessCta className="btn-ghost w-full" label="Create a full account" />
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
