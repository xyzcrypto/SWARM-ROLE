import {
  LineChart,
  Gauge,
  Gift,
  Crown,
  GraduationCap,
  Plus,
} from "lucide-react";
import { Reveal } from "./Reveal";
import { Container, Section, SectionHeading, Badge } from "./ui/primitives";
import {
  TradingVisual,
  AirdropVisual,
  PremiumVisual,
  AcademyVisual,
  MoreVisual,
} from "./ProductVisuals";

type Status = "Live" | "Coming Soon" | "In Development" | "Planned" | "Next Version";
const tone: Record<Status, "mint" | "gold" | "sky" | "zinc" | "violet"> = {
  Live: "mint",
  "Coming Soon": "gold",
  "In Development": "sky",
  Planned: "zinc",
  "Next Version": "violet",
};

function Chip({ s }: { s: Status }) {
  return (
    <Badge tone={tone[s]}>
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse-dot" />
      <span className="mono text-[10px] uppercase tracking-wider">{s}</span>
    </Badge>
  );
}

const small = [
  { name: "Airdrop Tools", status: "Planned" as Status, desc: "Track, qualify and farm airdrops with automated checklists and eligibility.", Icon: Gift, Visual: AirdropVisual },
  { name: "XYZ Premium", status: "Planned" as Status, desc: "Early calls, private research and members-only tooling.", Icon: Crown, Visual: PremiumVisual },
  { name: "Web3 Academy", status: "Live" as Status, desc: "Structured education from zero to on-chain pro.", Icon: GraduationCap, Visual: AcademyVisual },
  { name: "& More", status: "Next Version" as Status, desc: "New products and integrations ship every version.", Icon: Plus, Visual: MoreVisual },
];

export function Products() {
  return (
    <Section id="products">
      <div className="glow-orb left-1/2 top-10 h-72 w-72 -translate-x-1/2 bg-gold-600/10" />
      <Container className="relative">
        <SectionHeading
          eyebrow="The Ecosystem"
          title={<>Products built to <span className="text-gold-gradient">power your edge.</span></>}
          subtitle="A full product suite, shipping in stages — what's live, what's building, and what's next."
        />

        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {/* Perp DEX spotlight */}
          <Reveal className="lg:col-span-2">
            <div className="surface lift group relative h-full overflow-hidden rounded-4xl p-7 sm:p-9">
              <div className="glow-orb -right-10 top-0 h-48 w-48 bg-gold-500/15" />
              <div className="relative flex items-start justify-between">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-500/12 text-gold-300 ring-1 ring-gold-500/25">
                  <LineChart className="h-6 w-6" strokeWidth={1.7} />
                </div>
                <Chip s="Coming Soon" />
              </div>
              <h3 className="relative mt-6 font-display text-2xl font-semibold text-zinc-50">Perp DEX</h3>
              <p className="relative mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
                A high-performance decentralized perpetuals exchange — deep
                liquidity, low fees and full self-custody. Built for serious
                on-chain traders.
              </p>
              {/* faux chart */}
              <div className="relative mt-7 h-28 overflow-hidden rounded-2xl border border-line bg-ink-950/60">
                <svg viewBox="0 0 400 110" className="h-full w-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(34,214,146,0.35)" />
                      <stop offset="100%" stopColor="rgba(34,214,146,0)" />
                    </linearGradient>
                  </defs>
                  <path d="M0 80 L40 70 L80 76 L120 50 L160 58 L200 38 L240 46 L280 26 L320 34 L360 16 L400 22 L400 110 L0 110 Z" fill="url(#fill)" />
                  <path d="M0 80 L40 70 L80 76 L120 50 L160 58 L200 38 L240 46 L280 26 L320 34 L360 16 L400 22" fill="none" stroke="#22d692" strokeWidth="2" />
                </svg>
                <div className="absolute right-3 top-3 mono text-[11px] text-mint-300">+24.7%</div>
              </div>
            </div>
          </Reveal>

          {/* Trading Tools tall */}
          <Reveal delay={1}>
            <div className="surface surface-hover lift group flex h-full flex-col rounded-4xl p-7">
              <div className="flex items-start justify-between">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/12 text-sky-300 ring-1 ring-sky-500/25">
                  <Gauge className="h-6 w-6" strokeWidth={1.7} />
                </div>
                <Chip s="In Development" />
              </div>
              <h3 className="mt-6 font-display text-xl font-semibold text-zinc-50">Trading Tools</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Pro-grade screeners, on-chain scanners, alerts and analytics to
                give you a real, repeatable trading edge.
              </p>
              <TradingVisual />
            </div>
          </Reveal>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {small.map((p, i) => (
            <Reveal key={p.name} delay={i}>
              <div className="surface surface-hover lift group flex h-full flex-col rounded-4xl p-6">
                <div className="flex items-start justify-between">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gold-500/10 text-gold-300 ring-1 ring-gold-500/20">
                    <p.Icon className="h-5 w-5" strokeWidth={1.7} />
                  </div>
                  <Chip s={p.status} />
                </div>
                <h3 className="mt-5 font-display text-base font-semibold text-zinc-50">{p.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{p.desc}</p>
                <p.Visual />
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
