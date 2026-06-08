import { Reveal } from "./Reveal";
import { site } from "@/lib/site";
import { TelegramIcon } from "./BrandIcons";
import { BrandLogo } from "./BrandLogo";

const communities = [
  {
    name: "Web3 Academy",
    handle: "@X_Y_Z_Web3",
    tag: "Learn",
    tagColor: "text-gold-100 bg-gold-400/10 ring-gold-400/25",
    blurb:
      "Free, structured Web3 education — from wallets and security to DeFi, trading and on-chain mastery. Built for absolute beginners to advanced degens.",
    href: site.ecosystem.web3Academy,
    logo: "/web3-academy.jpg",
    initials: "W3",
    glowColor: "bg-gold-400/15",
    cta: "Join on Telegram",
  },
  {
    name: "TradeKaroVerse",
    handle: "@TradeKaro_Verse",
    tag: "Trade",
    tagColor: "text-sky-300 bg-sky-500/10 ring-sky-500/25",
    blurb:
      "A trading-first community universe — calls, setups, market breakdowns and a place to grow as a trader alongside the XYZ Crypto family.",
    href: site.ecosystem.tradeKaroVerse,
    logo: "/tradekaroverse.jpg",
    initials: "TKV",
    glowColor: "bg-sky-500/12",
    cta: "Join on Telegram",
  },
];

export function Ecosystem() {
  return (
    <section id="ecosystem" className="relative py-28">
      <hr className="section-sep" />

      <div className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 lg:px-8">
        <Reveal>
          <p className="text-center text-xs font-bold uppercase tracking-[0.22em] text-gold-400">
            Our Ecosystem
          </p>
          <h2 className="mx-auto mt-4 max-w-3xl text-center font-display text-3xl font-bold text-zinc-50 sm:text-5xl">
            The <span className="text-gold-gradient">XYZ Verse</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-center text-base leading-[1.8] text-zinc-500">
            Three pillars of the XYZ Crypto ecosystem — the hub, the academy,
            and the trading universe. All connected. All community-first.
          </p>
        </Reveal>

        {/* XYZ Crypto — parent brand card (full-width) */}
        <Reveal>
          <a
            href="/#about"
            className="brand-card mt-14 block rounded-3xl p-8 sm:p-10 lg:p-12"
          >
            {/* Glows */}
            <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-400/14 blur-3xl" />
            <div className="pointer-events-none absolute -left-10 bottom-0 h-44 w-44 rounded-full bg-gold-500/8 blur-2xl" />

            {/* Top accent */}
            <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-3xl bg-gradient-to-r from-transparent via-gold-400/50 to-transparent" />

            <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center">
              {/* Logo */}
              <span className="relative inline-flex h-20 w-20 shrink-0 overflow-hidden rounded-2xl ring-1 ring-gold-400/35 shadow-gold-lg">
                <img src="/logo.jpg" alt="XYZ Crypto" className="h-full w-full object-cover" />
              </span>

              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-display text-2xl font-extrabold text-zinc-50 sm:text-3xl">
                    XYZ Crypto
                  </h3>
                  <span className="rounded-full bg-gold-400/10 px-3 py-0.5 text-xs font-bold text-gold-100 ring-1 ring-gold-400/28">
                    The Hub
                  </span>
                  <span className="rounded-full bg-emerald-500/10 px-3 py-0.5 text-xs font-bold text-emerald-300 ring-1 ring-emerald-500/22">
                    Live
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-600">xyzcrypto.io</p>
                <p className="mt-3 max-w-2xl text-[0.88rem] leading-[1.75] text-zinc-400">
                  The unified Web3 ecosystem — research, trading tools, a perp DEX,
                  airdrop tools, premium intelligence and education in one trusted brand.
                  Built for the next generation of Web3.
                </p>
              </div>

              <div className="shrink-0 self-start sm:self-center">
                <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/28 bg-gold-400/6 px-5 py-2.5 text-sm font-semibold text-gold-100 transition-all duration-300 hover:bg-gold-400/12">
                  Explore Products
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </div>
            </div>
          </a>
        </Reveal>

        {/* Community arms — 2-col grid */}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {communities.map((b, i) => (
            <Reveal key={b.name} delay={i}>
              <a
                href={b.href}
                target="_blank"
                rel="noopener noreferrer"
                className="brand-card group block h-full rounded-3xl p-8"
              >
                {/* Corner glow */}
                <div className={`pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full ${b.glowColor} blur-2xl opacity-70`} />

                <div className="relative flex items-start gap-5">
                  <BrandLogo logo={b.logo} initials={b.initials} name={b.name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-xl font-bold text-zinc-50">
                        {b.name}
                      </h3>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1 ${b.tagColor}`}>
                        {b.tag}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-zinc-600">{b.handle}</p>
                  </div>
                </div>

                <p className="relative mt-5 text-[0.83rem] leading-[1.72] text-zinc-500">
                  {b.blurb}
                </p>

                <div className="relative mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gold-300 transition-colors group-hover:text-gold-100">
                  <TelegramIcon className="h-4 w-4 opacity-75" />
                  {b.cta}
                  <svg
                    className="transition-transform duration-200 group-hover:translate-x-1"
                    width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </div>
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
