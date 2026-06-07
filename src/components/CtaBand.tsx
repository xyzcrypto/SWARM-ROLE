import Link from "next/link";
import { Reveal } from "./Reveal";

export function CtaBand() {
  return (
    <section className="relative py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-gold-500/30 bg-gradient-to-br from-gold-500/15 via-ink-700 to-ink-800 px-6 py-14 text-center sm:px-12">
            <div className="glow-orb left-1/2 top-0 h-60 w-60 -translate-x-1/2 bg-gold-500/30" />
            <h2 className="relative font-display text-3xl font-bold text-zinc-50 sm:text-4xl">
              Ready to join the{" "}
              <span className="text-gold-gradient">next generation of Web3?</span>
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-zinc-300">
              Create your free XYZ Crypto account to unlock research, early
              product access and the full ecosystem.
            </p>
            <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/signup" className="btn-gold w-full sm:w-auto">
                Create free account
              </Link>
              <Link href="/research" className="btn-ghost w-full sm:w-auto">
                Browse research
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
