import Link from "next/link";
import { Reveal } from "./Reveal";

const trustItems = [
  {
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
    label: "Free to join",
  },
  {
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
    label: "No credit card",
  },
  {
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
        <circle cx="12" cy="9" r="2.5" />
      </svg>
    ),
    label: "Web3 native",
  },
  {
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinejoin="round" />
      </svg>
    ),
    label: "Early access perks",
  },
];

export function CtaBand() {
  return (
    <section className="relative py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-gold-400/22 bg-gradient-to-br from-gold-400/10 via-ink-800 to-ink-950 px-8 py-16 text-center sm:px-14">

            {/* Multi-layer glows */}
            <div className="glow-orb left-1/2 -top-16 h-96 w-96 -translate-x-1/2 bg-gold-400/22" />
            <div className="glow-orb left-[8%] bottom-0 h-56 w-56 bg-gold-500/12" />
            <div className="glow-orb right-[8%] top-6 h-56 w-56 bg-gold-400/10" />
            <div className="glow-orb left-[35%] bottom-[-20px] h-40 w-40 bg-gold-300/8" />

            {/* Animated ring */}
            <div className="cta-ring" />

            {/* Top accent */}
            <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-3xl bg-gradient-to-r from-transparent via-gold-400/60 to-transparent" />

            {/* Corner shimmer dots */}
            <div className="absolute left-6 top-6 h-1.5 w-1.5 rounded-full bg-gold-400/30" />
            <div className="absolute right-6 top-6 h-1.5 w-1.5 rounded-full bg-gold-400/20" />
            <div className="absolute bottom-6 left-6 h-1 w-1 rounded-full bg-gold-400/15" />
            <div className="absolute bottom-6 right-6 h-1 w-1 rounded-full bg-gold-400/15" />

            {/* Label */}
            <p className="relative text-xs font-bold uppercase tracking-[0.24em] text-gold-400">
              Join XYZ Crypto
            </p>

            {/* Decorative diamond separator */}
            <div className="relative mx-auto mt-3 flex items-center justify-center gap-2">
              <div className="h-px w-10 bg-gradient-to-r from-transparent to-gold-400/25" />
              <span className="text-[8px] text-gold-400/50">◆</span>
              <div className="h-px w-10 bg-gradient-to-l from-transparent to-gold-400/25" />
            </div>

            <h2 className="relative mx-auto mt-4 max-w-2xl font-display text-3xl font-extrabold text-zinc-50 sm:text-4xl lg:text-5xl">
              Ready to join the{" "}
              <span className="text-gold-gradient">
                next generation of Web3?
              </span>
            </h2>

            <p className="relative mx-auto mt-5 max-w-lg text-[0.92rem] leading-[1.8] text-zinc-500">
              Create your free XYZ Crypto account to unlock research, early
              product access and the full ecosystem.
            </p>

            <div className="relative mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/signup" className="btn-gold w-full sm:w-auto">
                Create free account
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
              <Link href="/research" className="btn-ghost w-full sm:w-auto">
                Browse research
              </Link>
            </div>

            {/* Trust badges row */}
            <div className="relative mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5">
              {trustItems.map((item) => (
                <span key={item.label} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-600">
                  <span className="text-gold-400/60">{item.icon}</span>
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
