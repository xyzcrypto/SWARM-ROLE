import { Reveal } from "./Reveal";
import { AnimatedEmoji } from "./AnimatedEmoji";
import { ResearchIcon, ToolingIcon, CommunityIcon, SecurityIcon, CalendarIcon, LayersIcon } from "./Icons3D";
import Link from "next/link";
import { Container, Section, Eyebrow } from "./ui/primitives";

const credibility = [
  { label: "Active since 2019", Icon: CalendarIcon },
  { label: "Research driven", Icon: ResearchIcon },
  { label: "Community first", Icon: CommunityIcon },
  { label: "Web3 native", Icon: LayersIcon },
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
      {/* Two equal columns, vertically centred against each other, so neither
          side hangs lower than the other. Children of the copy column keep
          their natural width (the eyebrow no longer stretches full-width). */}
      <Container className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-12">
        <Reveal variant="left" className="flex flex-col items-start">
          <Eyebrow>Who we are</Eyebrow>
          <h2 className="mt-5 font-display text-display-md font-semibold tracking-tight text-zinc-50">
            One ecosystem for the{" "}
            <span className="text-gold-gradient">entire Web3 journey.</span>{" "}
            <AnimatedEmoji emoji="🚀" variant="launch" className="align-middle text-[0.8em]" />
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-400">
            XYZ Crypto unifies research, tooling, education and community into a
            single, trusted brand. We help newcomers learn, traders win, and
            builders ship, all on-chain, all in one place.
          </p>
          <div className="mt-7 grid w-full grid-cols-3 gap-3">
            {[
              { k: "Learn", v: "Web3 Academy", href: "/academy" },
              { k: "Trade", v: "Tools & Perp DEX", href: "/markets" },
              { k: "Earn", v: "Airdrops & alpha", href: "/points" },
            ].map((s) => (
              <Link
                key={s.k}
                href={s.href}
                className="group rounded-xl border-l-2 border-mint-500/30 py-1 pl-3 transition-colors hover:border-mint-400 active:border-mint-400"
              >
                <div className="mono text-sm font-semibold text-mint-300">{s.k}</div>
                <div className="text-xs text-zinc-500 transition-colors group-hover:text-zinc-300 group-active:text-zinc-300">{s.v}</div>
              </Link>
            ))}
          </div>

          {/* Credibility / trust block (Since 2019) */}
          <div className="surface surface-hover lift group relative mt-7 w-full overflow-hidden rounded-2xl p-5">
            <div className="glow-orb -right-10 -top-10 h-32 w-32 bg-gold-500/15" />
            <div className="relative flex items-center gap-2">
              <span className="mono text-[11px] font-semibold tracking-[0.16em] text-gold-200">
                SINCE 2019
              </span>
              <span className="h-px flex-1 bg-gold-500/20" />
            </div>
            <div className="relative mt-4 grid grid-cols-2 gap-x-4 gap-y-3.5">
              {credibility.map((c) => (
                <div key={c.label} className="flex items-center gap-2.5">
                  <c.Icon className="h-7 w-7 shrink-0" />
                  <span className="text-xs font-medium text-zinc-300">{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="grid auto-rows-fr gap-4 sm:grid-cols-2">
          {pillars.map((p, i) => (
            <Reveal key={p.title} delay={i} variant="pop" className="h-full">
              <div className="surface surface-hover lift group flex h-full flex-col rounded-3xl p-6">
                <p.Icon3D className="mb-4 h-12 w-12 transition-transform duration-300 group-hover:scale-110 group-active:scale-110" />
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
