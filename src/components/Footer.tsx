import Link from "next/link";
import Image from "next/image";
import { site, navLinks } from "@/lib/site";
import { YouTubeIcon, XIcon, TelegramIcon, LinkedInIcon } from "./BrandIcons";
import { Container } from "./ui/primitives";
import { WaitlistForm } from "./WaitlistForm";

const socialList = [
  { href: site.socials.youtube, Icon: YouTubeIcon, label: "YouTube" },
  { href: site.socials.x, Icon: XIcon, label: "X" },
  { href: site.socials.telegram, Icon: TelegramIcon, label: "Telegram" },
  { href: site.socials.linkedin, Icon: LinkedInIcon, label: "LinkedIn" },
];

export function Footer() {
  return (
    <footer className="relative border-t border-line bg-ink-950">
      <Container>
        <div className="grid items-center gap-6 border-b border-line py-12 md:grid-cols-2">
          <div>
            <h3 className="font-display text-xl font-semibold text-zinc-50">
              Get alpha in your inbox
            </h3>
            <p className="mt-2 max-w-sm text-sm text-zinc-500">
              Research drops, product launches and airdrop alerts — straight to
              your email. No spam.
            </p>
          </div>
          <WaitlistForm source="footer" cta="Subscribe" />
        </div>

        <div className="grid gap-10 py-14 lg:grid-cols-[1.6fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-3">
              <span className="relative inline-flex h-10 w-10 overflow-hidden rounded-xl ring-1 ring-gold-500/40">
                <Image src="/logo.jpg" alt="XYZ Crypto" fill className="object-cover" sizes="40px" />
              </span>
              <span className="font-display text-lg font-semibold">
                <span className="text-gold-gradient">XYZ</span>{" "}
                <span className="text-zinc-100">Crypto</span>
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-zinc-500">
              {site.slogan}. A next-generation Web3 ecosystem — research,
              tooling, education and community in one trusted brand.
            </p>
            <div className="mt-6 flex gap-2.5">
              {socialList.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white/5 text-zinc-400 transition-all hover:border-gold-500/40 hover:text-gold-200"
                >
                  <s.Icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mono text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Explore</h4>
            <ul className="mt-4 space-y-3 text-sm">
              {navLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-zinc-500 transition-colors hover:text-gold-200">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mono text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Account</h4>
            <ul className="mt-4 space-y-3 text-sm">
              <li><Link href="/signup" className="text-zinc-500 transition-colors hover:text-gold-200">Create account</Link></li>
              <li><Link href="/login" className="text-zinc-500 transition-colors hover:text-gold-200">Log in</Link></li>
              <li><Link href="/research" className="text-zinc-500 transition-colors hover:text-gold-200">Research hub</Link></li>
              <li><a href={`mailto:${site.email}`} className="text-zinc-500 transition-colors hover:text-gold-200">Contact us</a></li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-line py-6 sm:flex-row">
          <p className="mono text-[11px] text-zinc-600">© {new Date().getFullYear()} XYZ Crypto. All rights reserved.</p>
          <p className="mono text-[11px] text-zinc-600">Built for the Next Generation of Web3 · v2.0</p>
        </div>
        <p className="pb-8 text-center text-[11px] leading-relaxed text-zinc-700">
          Disclaimer: Nothing on this site is financial advice. Crypto assets are
          volatile and high-risk. Always do your own research.
        </p>
      </Container>
    </footer>
  );
}
