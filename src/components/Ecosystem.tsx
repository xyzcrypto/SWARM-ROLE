import { Reveal } from "./Reveal";
import { site } from "@/lib/site";
import { TelegramIcon } from "./BrandIcons";
import { BrandLogo } from "./BrandLogo";

/**
 * Web3 Academy & TradeKaroVerse.
 * The main XYZ logo is at /public/logo.jpg. To use the dedicated logos you
 * mentioned, drop them in /public as `web3-academy.jpg` and
 * `tradekaroverse.jpg`, then set `logo` below to that path.
 */
const brands = [
  {
    name: "Web3 Academy",
    handle: "@X_Y_Z_Web3",
    tag: "Learn",
    blurb:
      "Free, structured Web3 education — from wallets and security to DeFi, trading and on-chain mastery. Built for absolute beginners to advanced degens.",
    href: site.ecosystem.web3Academy,
    logo: "/web3-academy.jpg",
    initials: "W3",
    accent: "from-gold-500/20 to-gold-700/5",
  },
  {
    name: "TradeKaroVerse",
    handle: "@TradeKaro_Verse",
    tag: "Trade",
    blurb:
      "A trading-first community universe — calls, setups, market breakdowns and a place to grow as a trader alongside the XYZ Crypto family.",
    href: site.ecosystem.tradeKaroVerse,
    logo: "/tradekaroverse.jpg",
    initials: "TKV",
    accent: "from-sky-500/20 to-sky-700/5",
  },
];

export function Ecosystem() {
  return (
    <section id="ecosystem" className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <p className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-gold-400">
            Our Communities
          </p>
          <h2 className="mx-auto mt-3 max-w-3xl text-center font-display text-3xl font-bold text-zinc-50 sm:text-5xl">
            The <span className="text-gold-gradient">XYZ Verse</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-center text-zinc-400">
            Two thriving communities under the XYZ Crypto umbrella — one to
            learn, one to trade. Join the conversation on Telegram.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {brands.map((b, i) => (
            <Reveal key={b.name} delay={i}>
              <a
                href={b.href}
                target="_blank"
                rel="noopener noreferrer"
                className="card-gold-border group relative block h-full overflow-hidden rounded-3xl p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-gold"
              >
                <div className={`pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br ${b.accent} blur-2xl`} />
                <div className="relative flex items-start gap-5">
                  <BrandLogo logo={b.logo} initials={b.initials} name={b.name} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-2xl font-bold text-zinc-50">
                        {b.name}
                      </h3>
                      <span className="rounded-full bg-gold-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-gold-200 ring-1 ring-gold-500/30">
                        {b.tag}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">{b.handle}</p>
                  </div>
                </div>
                <p className="relative mt-5 text-sm leading-relaxed text-zinc-400">
                  {b.blurb}
                </p>
                <div className="relative mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gold-200">
                  <TelegramIcon className="h-4 w-4" />
                  Join on Telegram
                  <svg className="transition-transform group-hover:translate-x-1" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
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
