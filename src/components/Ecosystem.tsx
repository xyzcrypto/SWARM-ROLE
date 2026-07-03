import { ArrowUpRight } from "lucide-react";
import { Reveal } from "./Reveal";
import { site } from "@/lib/site";
import { TelegramIcon } from "./BrandIcons";
import { BrandLogo } from "./BrandLogo";
import { Container, Section, SectionHeading, Badge } from "./ui/primitives";

/**
 * Web3 Academy & TradeKaroVerse. Logos live at /public/web3-academy.jpg and
 * /public/tradekaroverse.jpg (swap those files to update the imagery).
 */
const brands = [
  {
    name: "Web3 Academy",
    handle: "@X_Y_Z_Web3",
    tag: "Learn",
    blurb:
      "Free, structured Web3 education, from wallets and security to DeFi, trading and on-chain mastery. Built for absolute beginners to advanced degens.",
    href: site.ecosystem.web3Academy,
    logo: "/web3-academy.jpg",
    initials: "W3",
    glow: "bg-gold-500/15",
    shadow: "hover:shadow-[0_0_50px_-15px_rgba(226,167,47,0.35)]",
  },
  {
    name: "TradeKaroVerse",
    handle: "@TradeKaro_Verse",
    tag: "Trade",
    blurb:
      "A trading-first community universe, calls, setups, market breakdowns and a place to grow as a trader alongside the XYZ Crypto family.",
    href: site.ecosystem.tradeKaroVerse,
    logo: "/tradekaroverse.jpg",
    initials: "TKV",
    glow: "bg-mint-500/12",
    shadow: "hover:shadow-[0_0_50px_-15px_rgba(34,214,146,0.30)]",
  },
];

export function Ecosystem() {
  return (
    <Section id="ecosystem">
      <Container>
        <SectionHeading
          eyebrow="Our Communities"
          title={
            <>
              The XYZ Verse.
            </>
          }
          subtitle="Two thriving communities under the XYZ Crypto umbrella, one to learn, one to trade. Join the conversation on Telegram."
        />

        <div className="mt-10 grid gap-5 sm:mt-12 md:grid-cols-2">
          {brands.map((b, i) => (
            <Reveal key={b.name} delay={i} variant="pop">
              <a
                href={b.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`surface surface-hover lift group relative block h-full overflow-hidden rounded-4xl p-5 transition-all duration-300 sm:p-8 ${b.shadow}`}
              >
                <div className={`glow-orb -right-12 -top-12 h-44 w-44 ${b.glow}`} />
                <div className="relative flex items-start gap-3.5 sm:gap-5">
                  <BrandLogo logo={b.logo} initials={b.initials} name={b.name} className="h-14 w-14 transition-transform duration-300 group-hover:scale-105 sm:h-20 sm:w-20" />
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg font-semibold text-zinc-50 sm:text-2xl">{b.name}</h3>
                      <Badge tone="gold"><span className="mono text-[10px] uppercase">{b.tag}</span></Badge>
                    </div>
                    <p className="mt-1 mono text-xs text-zinc-500">{b.handle}</p>
                  </div>
                  <ArrowUpRight className="h-5 w-5 shrink-0 text-zinc-600 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gold-200" />
                </div>
                <p className="relative mt-5 text-sm leading-relaxed text-zinc-400">{b.blurb}</p>
                <div className="relative mt-6 inline-flex items-center gap-2 text-sm font-semibold text-mint-300 transition-colors group-hover:text-mint-200">
                  <TelegramIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                  Join on Telegram
                </div>
              </a>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
