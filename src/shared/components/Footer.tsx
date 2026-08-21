import Link from "next/link";
import Image from "next/image";
import { site, navLinks } from "@/lib/site";
import { YouTubeIcon, XIcon, TelegramIcon, LinkedInIcon } from "@/components/BrandIcons";
import { Container } from "@/components/ui/primitives";
import { GuestOnly } from "@/components/GuestOnly";
import { SignedIn } from "@/components/SignedIn";
import { FooterNewsletter } from "@/components/FooterNewsletter";
import { LiveStats } from "@/components/LiveStats";

const socialList = [
  { href: site.socials.youtube, Icon: YouTubeIcon, label: "YouTube", color: "text-red-500", hover: "hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/10" },
  { href: site.socials.x, Icon: XIcon, label: "X", color: "text-zinc-100", hover: "hover:border-white/40 hover:text-white hover:bg-white/10" },
  { href: site.socials.telegram, Icon: TelegramIcon, label: "Telegram", color: "text-sky-400", hover: "hover:border-sky-500/50 hover:text-sky-300 hover:bg-sky-500/10" },
  { href: site.socials.linkedin, Icon: LinkedInIcon, label: "LinkedIn", color: "text-blue-500", hover: "hover:border-blue-500/50 hover:text-blue-400 hover:bg-blue-500/10" },
];

export function Footer() {
  return (
    <footer className="relative border-t border-line bg-ink-950">
      <Container>
        <FooterNewsletter />

        <div className="grid gap-10 py-14 lg:grid-cols-[1.6fr_1fr_1fr]">
          <div>
            <Link href="/" prefetch={false} className="flex items-center gap-3">
              <span className="relative inline-flex h-10 w-10 rounded-xl ring-1 ring-gold-500/40">
                <Image src="/logo.png" alt="XYZ Crypto" fill className="object-contain" sizes="40px" />
              </span>
              <span className="font-display text-lg font-semibold">
                <span className="text-gold-gradient">XYZ</span>{" "}
                <span className="text-zinc-100">Crypto</span>
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-zinc-500">
              {site.slogan}. A next-generation Web3 ecosystem, research,
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
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white/5 transition-all hover:-translate-y-0.5 hover:scale-110 ${s.color} ${s.hover}`}
                >
                  <s.Icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="flex items-center gap-2 mono text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
              <span className="h-1 w-1 rounded-full bg-gold-400/80" />
              Explore
            </h4>
            {/* `py-1.5 -my-1.5` grows the tap target to ~40px without moving
                anything visually: the padding enlarges the hit area, the equal
                negative margin pulls layout back to where it was. A measured
                audit found these links 20-25px tall on a 320px screen, well
                under what Apple's HIG and WCAG 2.5.8 ask for - readable, but
                genuinely fiddly to hit with a thumb. Row spacing drops from
                space-y-3 to space-y-1.5 so the visible rhythm is unchanged. */}
            <ul className="mt-4 space-y-1.5 text-sm">
              {navLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    prefetch={false}
                    className="-my-1.5 inline-block py-1.5 text-zinc-500 transition-all hover:translate-x-0.5 hover:text-gold-200"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="flex items-center gap-2 mono text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
              <span className="h-1 w-1 rounded-full bg-gold-400/80" />
              Account
            </h4>
            <ul className="mt-4 space-y-1.5 text-sm">
              {/* Guests get sign-up / log-in; members get profile / settings. */}
              <GuestOnly>
                <li><Link href="/signup" prefetch={false} className="-my-1.5 inline-block py-1.5 text-zinc-500 transition-all hover:translate-x-0.5 hover:text-gold-200">Create account</Link></li>
                <li><Link href="/login" prefetch={false} className="-my-1.5 inline-block py-1.5 text-zinc-500 transition-all hover:translate-x-0.5 hover:text-gold-200">Log in</Link></li>
              </GuestOnly>
              <SignedIn>
                <li><Link href="/profile" prefetch={false} className="-my-1.5 inline-block py-1.5 text-zinc-500 transition-all hover:translate-x-0.5 hover:text-gold-200">Your profile</Link></li>
                <li><Link href="/settings" prefetch={false} className="-my-1.5 inline-block py-1.5 text-zinc-500 transition-all hover:translate-x-0.5 hover:text-gold-200">Settings</Link></li>
              </SignedIn>
              <li><Link href="/research" prefetch={false} className="-my-1.5 inline-block py-1.5 text-zinc-500 transition-all hover:translate-x-0.5 hover:text-gold-200">Research hub</Link></li>
              <li><Link href="/contact" prefetch={false} className="-my-1.5 inline-block py-1.5 text-zinc-500 transition-all hover:translate-x-0.5 hover:text-gold-200">Contact us</Link></li>
            </ul>
          </div>
        </div>

        {/* Live site stats (real-time online + visits) */}
        <LiveStats className="border-t border-line py-5" />

        <div className="flex flex-col items-center gap-3 border-t border-line py-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="mono text-[11px] text-zinc-600">© {new Date().getFullYear()} XYZ Crypto. All rights reserved.</p>
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
            <div className="flex items-center gap-4">
              <Link href="/about" prefetch={false} className="tap-target-y mono text-[11px] text-zinc-600 transition-colors hover:text-gold-200">About</Link>
              <Link href="/terms" prefetch={false} className="tap-target-y mono text-[11px] text-zinc-600 transition-colors hover:text-gold-200">Terms</Link>
              <Link href="/privacy" prefetch={false} className="tap-target-y mono text-[11px] text-zinc-600 transition-colors hover:text-gold-200">Privacy</Link>
              <Link href="/disclaimer" prefetch={false} className="tap-target-y mono text-[11px] text-zinc-600 transition-colors hover:text-gold-200">Disclaimer</Link>
            </div>
            <p className="mono text-[11px] text-zinc-600">Built for the Next Generation of Web3 · v2.0</p>
          </div>
        </div>
        <p className="mx-auto max-w-2xl pb-8 text-center text-[11px] leading-relaxed text-zinc-700">
          Disclaimer: Nothing on this site is financial advice. Crypto assets are
          volatile and high-risk. Always do your own research.
        </p>
      </Container>
    </footer>
  );
}
