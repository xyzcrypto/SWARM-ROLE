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
    border: "hover:border-red-500/40",
    bg: "hover:bg-red-500/8",
    iconBg: "bg-red-500/8 ring-red-500/18 group-hover:bg-red-500/15 group-hover:ring-red-500/35 group-hover:shadow-[0_0_28px_-6px_rgba(239,68,68,0.6)]",
    color: "text-red-400",
    glowColor: "bg-red-500/15",
    accentLine: "from-transparent via-red-500/25 to-transparent",
    cta: "Watch now",
  },
  {
    name: "X (Twitter)",
    handle: "@XYZCryptos",
    desc: "Real-time alpha, market calls and ecosystem updates.",
    href: site.socials.x,
    Icon: XIcon,
    border: "hover:border-zinc-400/35",
    bg: "hover:bg-white/[0.06]",
    iconBg: "bg-white/6 ring-white/10 group-hover:bg-white/12 group-hover:ring-white/22 group-hover:shadow-[0_0_28px_-6px_rgba(255,255,255,0.3)]",
    color: "text-zinc-100",
    glowColor: "bg-white/10",
    accentLine: "from-transparent via-zinc-400/20 to-transparent",
    cta: "Follow now",
  },
  {
    name: "Telegram",
    handle: "@X_Y_Z_Crypto",
    desc: "Live community chat, announcements and alerts.",
    href: site.socials.telegram,
    Icon: TelegramIcon,
    border: "hover:border-sky-500/40",
    bg: "hover:bg-sky-500/8",
    iconBg: "bg-sky-500/8 ring-sky-500/18 group-hover:bg-sky-500/15 group-hover:ring-sky-500/35 group-hover:shadow-[0_0_28px_-6px_rgba(14,165,233,0.6)]",
    color: "text-sky-400",
    glowColor: "bg-sky-500/15",
    accentLine: "from-transparent via-sky-500/25 to-transparent",
    cta: "Join now",
  },
  {
    name: "LinkedIn",
    handle: "/company/xyzcrypto",
    desc: "Professional updates, partnerships and company news.",
    href: site.socials.linkedin,
    Icon: LinkedInIcon,
    border: "hover:border-blue-500/40",
    bg: "hover:bg-blue-500/8",
    iconBg: "bg-blue-500/8 ring-blue-500/18 group-hover:bg-blue-500/15 group-hover:ring-blue-500/35 group-hover:shadow-[0_0_28px_-6px_rgba(59,130,246,0.6)]",
    color: "text-blue-400",
    glowColor: "bg-blue-500/15",
    accentLine: "from-transparent via-blue-500/25 to-transparent",
    cta: "Connect now",
  },
];

export function Social() {
  return (
    <section id="community" className="relative py-28">
      <hr className="section-sep" />

      <div className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 lg:px-8">
        <Reveal>
          <p className="text-center text-xs font-bold uppercase tracking-[0.22em] text-gold-400">
            Stay Connected
          </p>
          <h2 className="mx-auto mt-4 max-w-3xl text-center font-display text-3xl font-bold text-zinc-50 sm:text-5xl">
            Join the <span className="text-gold-gradient">community</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-center text-base leading-[1.8] text-zinc-500">
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
                className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-800/40 p-6 transition-all duration-350 hover:-translate-y-2 ${c.border} ${c.bg}`}
              >
                {/* Top accent line */}
                <div className={`absolute inset-x-0 top-0 h-[1.5px] rounded-t-2xl bg-gradient-to-r opacity-0 transition-opacity duration-350 group-hover:opacity-100 ${c.accentLine}`} />

                {/* Corner glow */}
                <div className={`pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full ${c.glowColor} opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-80`} />

                {/* Icon */}
                <span className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl ring-1 transition-all duration-350 ${c.iconBg} ${c.color}`}>
                  <c.Icon className="h-5 w-5 transition-transform duration-350 group-hover:scale-110" />
                </span>

                {/* Text */}
                <span className="font-display text-[0.95rem] font-bold text-zinc-100 transition-colors duration-200 group-hover:text-white">
                  {c.name}
                </span>
                <span className="mt-0.5 text-[11px] font-medium text-zinc-600 transition-colors duration-200 group-hover:text-zinc-500">
                  {c.handle}
                </span>
                <p className="mt-3 flex-1 text-[0.78rem] leading-[1.65] text-zinc-500 transition-colors duration-200 group-hover:text-zinc-400">
                  {c.desc}
                </p>

                {/* Hover CTA */}
                <div className="mt-5 flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1 ${c.color}`}>
                    {c.cta}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 17 17 7M9 7h8v8" />
                    </svg>
                  </span>
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/[0.06] text-zinc-700 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:border-white/[0.12]">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </span>
                </div>
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
