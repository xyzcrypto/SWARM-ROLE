import { Reveal } from "./Reveal";
import { AnimatedEmoji } from "./AnimatedEmoji";
import { ResearchIcon, ToolingIcon, CommunityIcon, SecurityIcon, CalendarIcon, LayersIcon } from "./Icons3D";
import { TiltCard } from "./TiltCard";
import { Container, Section, Eyebrow } from "./ui/primitives";

const credibility = [
  { label: "Active since 2019", Icon: CalendarIcon },
  { label: "Research driven", Icon: ResearchIcon },
  { label: "Community first", Icon: CommunityIcon },
  { label: "Web3 native", Icon: LayersIcon },
];

const journey = [
  { k: "Learn", v: "Web3 Academy" },
  { k: "Trade", v: "Tools & Perp DEX" },
  { k: "Earn", v: "Airdrops & alpha" },
];

const pillars = [
  { title: "Research-driven", body: "Unbiased Web3 research and on-chain analysis, act on signal, not noise.", Icon3D: ResearchIcon },
  { title: "Builder tooling", body: "Trading tools, an upcoming perp DEX and automation built for performance.", Icon3D: ToolingIcon },
  { title: "Community first", body: "An open ecosystem where the community shares the upside, airdrops to academies.", Icon3D: CommunityIcon },
  { title: "Security & trust", body: "Transparency by default. Every product ships with safety and clarity in mind.", Icon3D: SecurityIcon },
];

export function About() {
  return (
    <Section id="about">
      <Container className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <Reveal variant="left">
          <Eyebrow>Who we are</Eyebrow>
          <h2 className="mt-5 font-display text-display-md font-semibold tracking-tight text-zinc-50">
            One ecosystem for the{" "}
            <span className="text-shine">entire Web3 journey.</span>{" "}
            <AnimatedEmoji emoji="🚀" variant="launch" className="align-middle text-[0.8em]" />
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-zinc-400">
            XYZ Crypto unifies research, tooling, education and community into a
            single, trusted brand. We help newcomers learn, traders win, and
            builders ship, all on-chain, all in one place.
          </p>

          {/* Learn / Trade / Earn — premium mini-cards with live mint keys */}
          <div className="mt-8 grid grid-cols-3 gap-3">
            {journey.map((s) => (
              <div
                key={s.k}
                className="surface surface-hover lift group relative overflow-hidden rounded-2xl px-3.5 py-3.5"
              >
                <span className="absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b from-mint-400/70 to-mint-500/0" />
                <div className="mono text-sm font-bold tracking-tight text-shine-mint">{s.k}</div>
                <div className="mt-1 text-[11px] leading-tight text-zinc-500 transition-colors group-hover:text-zinc-400">
                  {s.v}
                </div>
              </div>
            ))}
          </div>

          {/* Credibility / trust block (Since 2019) */}
          <div className="surface surface-hover lift group relative mt-6 overflow-hidden rounded-2xl p-4">
            <div className="glow-orb -right-10 -top-10 h-32 w-32 bg-gold-500/15" />
            <div className="relative flex items-center gap-2">
              <span className="mono text-[11px] font-semibold tracking-[0.16em] text-gold-200">
                SINCE 2019
              </span>
              <span className="h-px flex-1 bg-gold-500/20" />
            </div>
            <div className="relative mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
              {credibility.map((c) => (
                <div key={c.label} className="flex items-center gap-2.5">
                  <c.Icon className="h-7 w-7 shrink-0" />
                  <span className="text-xs font-medium text-zinc-300">{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="grid gap-4 sm:grid-cols-2">
          {pillars.map((p, i) => (
            <Reveal key={p.title} delay={i} variant="pop">
              <TiltCard className="h-full">
                <div className="surface surface-hover lift group relative h-full overflow-hidden rounded-3xl p-6">
                  <div className="glow-orb -right-12 -top-12 h-28 w-28 bg-gold-500/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <p.Icon3D className="relative mb-4 h-12 w-12 transition-transform duration-300 group-hover:scale-110" />
                  <h3 className="relative font-display text-base font-semibold text-zinc-100">{p.title}</h3>
                  <p className="relative mt-2 text-sm leading-relaxed text-zinc-400">{p.body}</p>
                </div>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
