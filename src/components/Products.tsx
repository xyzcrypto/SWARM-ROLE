import {
  LineChart,
  Gauge,
  Gift,
  Crown,
  GraduationCap,
  Plus,
} from "lucide-react";
import { Reveal } from "./Reveal";
import { TiltCard } from "./TiltCard";
import { AnimatedIcon } from "./AnimatedIcon";
import { AnimatedEmoji } from "./AnimatedEmoji";
import { Container, Section, SectionHeading, Badge } from "./ui/primitives";
import {
  TradingVisual,
  AirdropVisual,
  PremiumVisual,
  AcademyVisual,
  MoreVisual,
} from "./ProductVisuals";
import { PerpChartLazy as PerpChart } from "./PerpChartLazy";

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
          title={
            <>
              Products built to <span className="text-gold-gradient">power your edge.</span>{" "}
              <AnimatedEmoji emoji="⚡" variant="twinkle" className="align-middle text-[0.8em]" />
            </>
          }
          subtitle="A full product suite, shipping in stages, what's live, what's building, and what's next."
        />

        <div className="mt-10 grid gap-4 sm:mt-12 lg:grid-cols-3">
          {/* Perp DEX spotlight */}
          <Reveal className="lg:col-span-2">
            <TiltCard max={4}>
            <div className="surface lift group relative h-full overflow-hidden rounded-4xl p-7 transition-all duration-300 hover:shadow-[0_0_50px_-12px_rgba(226,167,47,0.35)] sm:p-9">
              <div className="glow-orb -right-10 top-0 h-48 w-48 bg-gold-500/15" />
              <div className="relative flex items-start justify-between">
                <AnimatedIcon tone="gold" index={0} className="h-12 w-12 rounded-2xl">
                  <LineChart className="h-6 w-6" strokeWidth={1.7} />
                </AnimatedIcon>
                <Chip s="Coming Soon" />
              </div>
              <h3 className="relative mt-6 font-display text-2xl font-semibold text-zinc-50">Perp DEX</h3>
              <p className="relative mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
                A high-performance decentralized perpetuals exchange, deep
                liquidity, low fees and full self-custody. Built for serious
                on-chain traders.
              </p>
              {/* live BTC + ETH perp charts (real CoinGecko data) */}
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <PerpChart coin={{ id: "bitcoin", symbol: "BTC", base: 64000 }} />
                <PerpChart coin={{ id: "ethereum", symbol: "ETH", base: 3400 }} />
              </div>
            </div>
            </TiltCard>
          </Reveal>

          {/* Trading Tools tall */}
          <Reveal delay={1}>
            <TiltCard max={4}>
            <div className="surface surface-hover lift group flex h-full flex-col rounded-4xl p-7">
              <div className="flex items-start justify-between">
                <AnimatedIcon tone="sky" index={1} className="h-12 w-12 rounded-2xl">
                  <Gauge className="h-6 w-6" strokeWidth={1.7} />
                </AnimatedIcon>
                <Chip s="In Development" />
              </div>
              <h3 className="mt-6 font-display text-xl font-semibold text-zinc-50">Trading Tools</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Pro-grade screeners, on-chain scanners, alerts and analytics to
                give you a real, repeatable trading edge.
              </p>
              <TradingVisual />
            </div>
            </TiltCard>
          </Reveal>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {small.map((p, i) => (
            <Reveal key={p.name} delay={i} variant="pop">
              <TiltCard>
              <div className="surface surface-hover lift group flex h-full flex-col rounded-4xl p-6">
                <div className="flex items-start justify-between">
                  <AnimatedIcon tone="gold" index={i} className="h-11 w-11">
                    <p.Icon className="h-5 w-5" strokeWidth={1.7} />
                  </AnimatedIcon>
                  <Chip s={p.status} />
                </div>
                <h3 className="mt-5 font-display text-base font-semibold text-zinc-50">{p.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{p.desc}</p>
                <p.Visual />
              </div>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
