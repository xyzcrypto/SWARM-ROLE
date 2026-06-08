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
    desc: "Video research, market analysis and Web3 tutorials.",
    href: site.socials.youtube,
    Icon: YouTubeIcon,
    hover: "hover:border-red-500/40 hover:bg-red-500/8",
    iconBg: "bg-red-500/10 ring-red-500/20",
    color: "text-red-400",
  },
  {
    name: "X (Twitter)",
    handle: "@XYZCryptos",
    desc: "Real-time alpha, market calls and ecosystem updates.",
    href: site.socials.x,
    Icon: XIcon,
    hover: "hover:border-zinc-400/30 hover:bg-white/[0.06]",
    iconBg: "bg-white/8 ring-white/12",
    color: "text-zinc-100",
  },
  {
    name: "Telegram",
    handle: "@X_Y_Z_Crypto",
    desc: "Live community chat, announcements and alerts.",
    href: site.socials.telegram,
    Icon: TelegramIcon,
    hover: "hover:border-sky-500/40 hover:bg-sky-500/8",
    iconBg: "bg-sky-500/10 ring-sky-500/20",
    color: "text-sky-400",
  },
  {
    name: "LinkedIn",
    handle: "/company/xyzcrypto",
    desc: "Professional updates, partnerships and company news.",
    href: site.socials.linkedin,
    Icon: LinkedInIcon,
    hover: "hover:border-blue-500/40 hover:bg-blue-500/8",
    iconBg: "bg-blue-500/10 ring-blue-500/20",
    color: "text-blue-400",
  },
];

export function Social() {
  return (
    <section id="community" className="relative py-28">
      <hr className="section-sep" />

      <div className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 lg:px-8">
        <Reveal>
          <p className="text-center text-xs font-bold uppercase tracking-[0.22em] text-gold-500">
            Stay Connected
          </p>
          <h2 className="mx-auto mt-4 max-w-3xl text-center font-display text-3xl font-bold text-zinc-50 sm:text-5xl">
            Join the <span className="text-gold-gradient">community</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-center text-base leading-relaxed text-zinc-400">
            Follow XYZ Crypto across every platform for research drops, alpha,
            product launches and live market coverage.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {channels.map((c, i) => (
            <Reveal key={c.name} delay={i}>
              <a
                href={c.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${c.name} — ${c.handle}`}
                className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-700/50 p-6 transition-all duration-300 hover:-translate-y-1.5 ${c.hover}`}
              >
                {/* Icon */}
                <span className={`mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl ring-1 transition-all duration-300 group-hover:scale-[1.08] ${c.iconBg} ${c.color}`}>
                  <c.Icon className="h-6 w-6" />
                </span>

                {/* Text */}
                <span className="font-display text-base font-bold text-zinc-100">
                  {c.name}
                </span>
                <span className="mt-1 text-xs font-medium text-zinc-600">
                  {c.handle}
                </span>
                <p className="mt-3 flex-1 text-xs leading-relaxed text-zinc-500">
                  {c.desc}
                </p>

                {/* Hover CTA */}
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-gold-300 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0.5">
                  Follow
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 17 17 7M9 7h8v8" />
                  </svg>
                </span>

                {/* Hover corner glow */}
                <div className="pointer-events-none absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-current opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-[0.08]" />
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
