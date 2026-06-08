import Link from "next/link";
import { Reveal } from "./Reveal";

export function CtaBand() {
  return (
    <section className="relative py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-gold-400/22 bg-gradient-to-br from-gold-400/10 via-ink-800 to-ink-950 px-8 py-16 text-center sm:px-14">
            {/* Glows */}
            <div className="glow-orb left-1/2 -top-12 h-80 w-80 -translate-x-1/2 bg-gold-400/20" />
            <div className="glow-orb left-[12%] bottom-0 h-44 w-44 bg-gold-500/10" />
            <div className="glow-orb right-[12%] top-8 h-44 w-44 bg-gold-400/8" />

            {/* Top accent */}
            <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-3xl bg-gradient-to-r from-transparent via-gold-400/55 to-transparent" />

            {/* Label */}
            <p className="relative text-xs font-bold uppercase tracking-[0.24em] text-gold-400">
              Join XYZ Crypto
            </p>

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

            {/* Trust line */}
            <p className="relative mt-8 text-[11px] text-zinc-600">
              Free to join · No credit card required · Web3 native
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
