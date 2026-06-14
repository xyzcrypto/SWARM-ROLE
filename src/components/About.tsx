import { Search, Wrench, Users, ShieldCheck, CalendarClock, Boxes } from "lucide-react";
import { Reveal } from "./Reveal";
import { AnimatedIcon } from "./AnimatedIcon";
import { Container, Section, Eyebrow } from "./ui/primitives";

const credibility = [
  { label: "Active since 2019", Icon: CalendarClock },
  { label: "Research driven", Icon: Search },
  { label: "Community first", Icon: Users },
  { label: "Web3 native", Icon: Boxes },
];

const pillars = [
  { title: "Research-driven", body: "Unbiased Web3 research and on-chain analysis, act on signal, not noise.", Icon: Search },
  { title: "Builder tooling", body: "Trading tools, an upcoming perp DEX and automation built for performance.", Icon: Wrench },
  { title: "Community first", body: "An open ecosystem where the community shares the upside, airdrops to academies.", Icon: Users },
  { title: "Security & trust", body: "Transparency by default. Every product ships with safety and clarity in mind.", Icon: ShieldCheck },
];

export function About() {
  return (
    <Section id="about">
      <Container className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <Reveal variant="left">
          <Eyebrow>Who we are</Eyebrow>
          <h2 className="mt-5 font-display text-display-md font-semibold tracking-tight text-zinc-50">
            One ecosystem for the{" "}
            <span className="text-gold-gradient">entire Web3 journey.</span>
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-zinc-400">
            XYZ Crypto unifies research, tooling, education and community into a
            single, trusted brand. We help newcomers learn, traders win, and
            builders ship, all on-chain, all in one place.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
            {[
              { k: "Learn", v: "Web3 Academy" },
              { k: "Trade", v: "Tools & Perp DEX" },
              { k: "Earn", v: "Airdrops & alpha" },
            ].map((s) => (
              <div key={s.k}>
                <div className="mono text-sm font-semibold text-mint-300">{s.k}</div>
                <div className="text-xs text-zinc-500">{s.v}</div>
              </div>
            ))}
          </div>

          {/* Credibility / trust block (Since 2019) */}
          <div className="mt-8 rounded-2xl border border-gold-500/20 bg-gold-500/[0.04] p-4">
            <div className="flex items-center gap-2">
              <span className="mono text-[11px] font-semibold tracking-[0.16em] text-gold-200">
                SINCE 2019
              </span>
              <span className="h-px flex-1 bg-gold-500/20" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
              {credibility.map((c) => (
                <div key={c.label} className="flex items-center gap-2.5">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gold-500/10 text-gold-300 ring-1 ring-gold-500/20">
                    <c.Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </span>
                  <span className="text-xs font-medium text-zinc-300">{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="grid gap-4 sm:grid-cols-2">
          {pillars.map((p, i) => (
            <Reveal key={p.title} delay={i} variant="pop">
              <div className="surface surface-hover lift group h-full rounded-3xl p-6">
                <AnimatedIcon tone={i % 2 === 0 ? "gold" : "mint"} className="mb-5 h-11 w-11">
                  <p.Icon className="h-5 w-5" strokeWidth={1.7} />
                </AnimatedIcon>
                <h3 className="font-display text-base font-semibold text-zinc-100">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{p.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
