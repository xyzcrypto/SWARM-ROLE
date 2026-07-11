import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Reveal } from "./Reveal";
import { TiltCard } from "./TiltCard";
import {
  MarketsIcon,
  GaugeIcon,
  GiftIcon,
  CrownIcon,
  AcademyIcon,
  LayersIcon,
  NewspaperIcon,
  CandlesIcon,
  GamepadIcon,
} from "./Icons3D";
import { RobotIcon } from "./RobotIcon";
import { AnimatedEmoji } from "./AnimatedEmoji";
import type { ComponentType } from "react";
import { Container, Section, SectionHeading, Badge } from "./ui/primitives";
import {
  TradingVisual,
  AirdropVisual,
  PremiumVisual,
  AcademyVisual,
  AiVisual,
  GamifiedVisual,
  MoreVisual,
} from "./ProductVisuals";
import { LiveMarketVisual } from "./LiveMarketVisual";
import { LiveNewsVisual } from "./LiveNewsVisual";
import { PerpChartLazy as PerpChart } from "./PerpChartLazy";

type Status = "Live" | "Coming Soon" | "In Development" | "In Research" | "Planned" | "Next Version";
const tone: Record<Status, "mint" | "gold" | "sky" | "zinc" | "violet"> = {
  Live: "mint",
  "Coming Soon": "gold",
  "In Development": "sky",
  "In Research": "violet",
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

type Icon3D = ComponentType<{ className?: string }>;
type SmallProduct = {
  name: string;
  status: Status;
  desc: string;
  Icon: Icon3D;
  Visual: ComponentType;
  href?: string;
};

// Live products first (clickable into the real pages), then what's building,
// then what's next. "& More" always closes the grid.
const small: SmallProduct[] = [
  { name: "Web3 Market", status: "Live", href: "/markets", desc: "Live prices, market cap, trending coins and on-chain data in real time.", Icon: CandlesIcon as Icon3D, Visual: LiveMarketVisual },
  { name: "Web3 News", status: "Live", href: "/news", desc: "Breaking crypto headlines with an AI briefing, ranked by what matters.", Icon: NewspaperIcon as Icon3D, Visual: LiveNewsVisual },
  { name: "Web3 Academy", status: "Live", href: "/research", desc: "Structured education and research, from zero to on-chain pro.", Icon: AcademyIcon as Icon3D, Visual: AcademyVisual },
  { name: "Airdrop Tools", status: "Planned", desc: "Track, qualify and farm airdrops with automated checklists and eligibility.", Icon: GiftIcon as Icon3D, Visual: AirdropVisual },
  { name: "XYZ Premium", status: "Planned", desc: "Early calls, private research and members-only tooling.", Icon: CrownIcon as Icon3D, Visual: PremiumVisual },
  { name: "AI Hub", status: "Planned", desc: "An on-site AI assistant for research, summaries and on-chain Q&A.", Icon: RobotIcon as Icon3D, Visual: AiVisual },
  { name: "Gamified", status: "Coming Soon", desc: "Earn XP, level up and unlock rewards as you learn and trade on-chain.", Icon: GamepadIcon as Icon3D, Visual: GamifiedVisual },
  { name: "& More", status: "Next Version", desc: "New products and integrations ship every version.", Icon: LayersIcon as Icon3D, Visual: MoreVisual },
];

const SMALL_CARD = "surface surface-hover lift group flex h-full flex-col rounded-4xl p-6";

export function Products() {
  return (
    <Section id="products">
      <div className="glow-orb left-1/2 top-10 h-72 w-72 -translate-x-1/2 bg-gold-600/10" />
      <Container className="relative">
        <SectionHeading
          eyebrow="The Ecosystem"
          title={
            <>
              Products built to <span className="text-shine">power your edge.</span>{" "}
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
                <MarketsIcon className="h-12 w-12 transition-transform duration-300 group-hover:scale-110" />
                <Chip s="In Research" />
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
                <GaugeIcon className="h-12 w-12 transition-transform duration-300 group-hover:scale-110" />
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
          {small.map((p, i) => {
            const inner = (
              <>
                <div className="flex items-start justify-between gap-2">
                  <p.Icon className="h-11 w-11 transition-transform duration-300 group-hover:scale-110" />
                  <div className="flex items-center gap-2">
                    <Chip s={p.status} />
                    {p.href && (
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-zinc-600 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gold-200" />
                    )}
                  </div>
                </div>
                <h3 className="mt-5 font-display text-base font-semibold text-zinc-50">{p.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{p.desc}</p>
                <p.Visual />
              </>
            );
            return (
              <Reveal key={p.name} delay={i} variant="pop">
                <TiltCard>
                  {p.href ? (
                    <Link href={p.href} className={SMALL_CARD}>
                      {inner}
                    </Link>
                  ) : (
                    <div className={SMALL_CARD}>{inner}</div>
                  )}
                </TiltCard>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
