import { Reveal } from "./Reveal";
import { site } from "@/lib/site";
import {
  YouTubeIcon,
  XIcon,
  TelegramIcon,
  LinkedInIcon,
} from "./BrandIcons";

const channels = [
  {
    name: "YouTube",
    handle: "@xyzcrypto",
    href: site.socials.youtube,
    Icon: YouTubeIcon,
    hover: "hover:border-red-500/50 hover:bg-red-500/10",
    color: "text-red-400",
  },
  {
    name: "X (Twitter)",
    handle: "@XYZCryptos",
    href: site.socials.x,
    Icon: XIcon,
    hover: "hover:border-zinc-300/40 hover:bg-white/10",
    color: "text-zinc-100",
  },
  {
    name: "Telegram",
    handle: "@X_Y_Z_Crypto",
    href: site.socials.telegram,
    Icon: TelegramIcon,
    hover: "hover:border-sky-500/50 hover:bg-sky-500/10",
    color: "text-sky-400",
  },
  {
    name: "LinkedIn",
    handle: "/company/xyzcrypto",
    href: site.socials.linkedin,
    Icon: LinkedInIcon,
    hover: "hover:border-blue-500/50 hover:bg-blue-500/10",
    color: "text-blue-400",
  },
];

export function Social() {
  return (
    <section id="community" className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <p className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-gold-400">
            Stay Connected
          </p>
          <h2 className="mx-auto mt-3 max-w-3xl text-center font-display text-3xl font-bold text-zinc-50 sm:text-5xl">
            Join the <span className="text-gold-gradient">community</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-center text-zinc-400">
            Follow XYZ Crypto across every platform for research drops, alpha,
            product launches and live market coverage.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {channels.map((c, i) => (
            <Reveal key={c.name} delay={i}>
              <a
                href={c.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${c.name} — ${c.handle}`}
                className={`group flex h-full flex-col items-center rounded-2xl border border-white/8 bg-ink-700/50 p-7 text-center transition-all duration-300 hover:-translate-y-1.5 ${c.hover}`}
              >
                <span className={`mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10 transition-transform duration-300 group-hover:scale-110 ${c.color}`}>
                  <c.Icon className="h-7 w-7" />
                </span>
                <span className="font-display text-lg font-semibold text-zinc-100">
                  {c.name}
                </span>
                <span className="mt-1 text-sm text-zinc-500">{c.handle}</span>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-gold-200 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  Open
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
