import Link from "next/link";
import Image from "next/image";
import { site, navLinks } from "@/lib/site";
import {
  YouTubeIcon,
  XIcon,
  TelegramIcon,
  LinkedInIcon,
} from "./BrandIcons";

const socialList = [
  { href: site.socials.youtube,  Icon: YouTubeIcon,  label: "YouTube",  color: "hover:border-red-500/35 hover:bg-red-500/8 hover:text-red-400" },
  { href: site.socials.x,        Icon: XIcon,        label: "X",        color: "hover:border-zinc-400/30 hover:bg-white/[0.06] hover:text-zinc-100" },
  { href: site.socials.telegram, Icon: TelegramIcon, label: "Telegram", color: "hover:border-sky-500/35 hover:bg-sky-500/8 hover:text-sky-400" },
  { href: site.socials.linkedin, Icon: LinkedInIcon, label: "LinkedIn", color: "hover:border-blue-500/35 hover:bg-blue-500/8 hover:text-blue-400" },
];

const ecosystemLinks = [
  { label: "Web3 Academy",   href: site.ecosystem.web3Academy,    external: true },
  { label: "TradeKaroVerse", href: site.ecosystem.tradeKaroVerse, external: true },
  { label: "XYZ Premium",    href: "/signup",                     external: false },
];

export function Footer() {
  return (
    <footer className="relative border-t border-white/[0.04] bg-ink-950">
      {/* Animated top gradient line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/22 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-gold-400/8 to-transparent blur-sm" />

      {/* Subtle ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-48 w-96 -translate-x-1/2 rounded-full bg-gold-400/4 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.8fr_1fr_1fr_1fr]">

          {/* Brand column */}
          <div>
            <Link href="/" className="group flex items-center gap-3">
              <span className="relative inline-flex h-10 w-10 overflow-hidden rounded-full ring-1 ring-gold-400/32 shadow-[0_0_14px_-4px_rgba(233,160,32,0.35)] transition-all duration-300 group-hover:ring-gold-400/55 group-hover:shadow-[0_0_22px_-4px_rgba(233,160,32,0.55)]">
                <Image src="/logo.jpg" alt="XYZ Crypto" fill className="object-cover" sizes="40px" />
              </span>
              <span className="font-display text-lg font-bold">
                <span className="text-gold-gradient">XYZ</span>{" "}
                <span className="text-zinc-100">Crypto</span>
              </span>
            </Link>
            <p className="mt-4 max-w-[250px] text-[0.8rem] leading-[1.75] text-zinc-600">
              {site.slogan} A next-generation Web3 ecosystem — research,
              tooling, education and community in one trusted brand.
            </p>
            <div className="mt-6 flex gap-1.5">
              {socialList.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-zinc-600 transition-all duration-200 ${s.color}`}
                >
                  <s.Icon className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
          </div>

          {/* Explore */}
          <div>
            <h4 className="font-display text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
              Explore
            </h4>
            <ul className="mt-5 space-y-3 text-[0.82rem]">
              {navLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-zinc-600 transition-colors duration-200 hover:text-gold-100"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Ecosystem */}
          <div>
            <h4 className="font-display text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
              Ecosystem
            </h4>
            <ul className="mt-5 space-y-3 text-[0.82rem]">
              {ecosystemLinks.map((l) => (
                <li key={l.label}>
                  {l.external ? (
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-600 transition-colors duration-200 hover:text-gold-100"
                    >
                      {l.label}
                    </a>
                  ) : (
                    <Link
                      href={l.href}
                      className="text-zinc-600 transition-colors duration-200 hover:text-gold-100"
                    >
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="font-display text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
              Account
            </h4>
            <ul className="mt-5 space-y-3 text-[0.82rem]">
              <li>
                <Link href="/signup" className="text-zinc-600 transition-colors duration-200 hover:text-gold-100">
                  Create account
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-zinc-600 transition-colors duration-200 hover:text-gold-100">
                  Log in
                </Link>
              </li>
              <li>
                <Link href="/research" className="text-zinc-600 transition-colors duration-200 hover:text-gold-100">
                  Research hub
                </Link>
              </li>
              <li>
                <a href={`mailto:${site.email}`} className="text-zinc-600 transition-colors duration-200 hover:text-gold-100">
                  Contact us
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-white/[0.04] pt-7 sm:flex-row">
          <p className="text-[11px] text-zinc-700">
            © {new Date().getFullYear()} XYZ Crypto. All rights reserved.
          </p>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-zinc-700">The home of next-gen Web3</span>
            <span className="h-3 w-px bg-zinc-800" />
            <span className="rounded-full border border-gold-400/18 bg-gold-400/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-gold-400/60">
              v3.2
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
