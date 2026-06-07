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
  { href: site.socials.youtube, Icon: YouTubeIcon, label: "YouTube" },
  { href: site.socials.x, Icon: XIcon, label: "X" },
  { href: site.socials.telegram, Icon: TelegramIcon, label: "Telegram" },
  { href: site.socials.linkedin, Icon: LinkedInIcon, label: "LinkedIn" },
];

export function Footer() {
  return (
    <footer className="relative border-t border-white/5 bg-ink-800">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-3">
              <span className="relative inline-flex h-11 w-11 overflow-hidden rounded-full ring-1 ring-gold-500/40">
                <Image src="/logo.jpg" alt="XYZ Crypto" fill className="object-cover" sizes="44px" />
              </span>
              <span className="font-display text-xl font-bold">
                <span className="text-gold-gradient">XYZ</span>{" "}
                <span className="text-zinc-100">Crypto</span>
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-zinc-500">
              {site.slogan}. A next-generation Web3 ecosystem — research,
              tooling, education and community in one trusted brand.
            </p>
            <div className="mt-6 flex gap-3">
              {socialList.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/8 bg-white/5 text-zinc-400 transition-all hover:border-gold-500/40 hover:text-gold-200"
                >
                  <s.Icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-zinc-300">
              Explore
            </h4>
            <ul className="mt-4 space-y-3 text-sm">
              {navLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-zinc-500 transition-colors hover:text-gold-200">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-zinc-300">
              Account
            </h4>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link href="/signup" className="text-zinc-500 transition-colors hover:text-gold-200">
                  Create account
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-zinc-500 transition-colors hover:text-gold-200">
                  Log in
                </Link>
              </li>
              <li>
                <Link href="/research" className="text-zinc-500 transition-colors hover:text-gold-200">
                  Research hub
                </Link>
              </li>
              <li>
                <a href={`mailto:${site.email}`} className="text-zinc-500 transition-colors hover:text-gold-200">
                  Contact us
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-6 sm:flex-row">
          <p className="text-xs text-zinc-600">
            © {new Date().getFullYear()} XYZ Crypto. All rights reserved.
          </p>
          <p className="text-xs text-zinc-600">
            Built for the Next Generation of Web3 · v1.0
          </p>
        </div>
      </div>
    </footer>
  );
}
