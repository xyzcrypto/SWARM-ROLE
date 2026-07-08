import Link from "next/link";
import { Check } from "lucide-react";
import { Lock, MagicStar } from "iconsax-react";
import { MagneticButton } from "./MagneticButton";

const PERKS = ["Full breakdown & thesis", "On-chain data & charts", "Actionable analysis"];

/**
 * Locked teaser shown in place of a premium post's body for non-Premium users.
 * The full content is never rendered/sent here - gating happens server-side.
 */
export function PremiumLock({ loggedIn }: { loggedIn: boolean }) {
  return (
    <div className="relative mt-8 overflow-hidden rounded-2xl border border-gold-500/25 bg-gradient-to-b from-gold-500/[0.07] to-transparent p-8 text-center sm:p-12">
      {/* Soft brand glow behind the card. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[28rem] max-w-[120%] -translate-x-1/2 rounded-full bg-gold-500/20 blur-3xl"
      />

      {/* Faux preview lines - hint at hidden content, fading into the lock. */}
      <div aria-hidden className="pointer-events-none mb-8 space-y-2.5 [mask-image:linear-gradient(to_bottom,black,transparent)]">
        {["w-[92%]", "w-[80%]", "w-[88%]", "w-[64%]"].map((w, i) => (
          <div key={i} className={`mx-auto h-3 rounded-full bg-white/[0.07] blur-[2px] ${w}`} />
        ))}
      </div>

      <div className="relative">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-shine text-ink shadow-gold ring-1 ring-gold-500/40">
          <Lock size={24} variant="Bold" color="#0a0a0d" />
        </div>
        <p className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-gold-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gold-200 ring-1 ring-gold-500/30">
          <MagicStar size={14} variant="Bold" color="#f3d488" /> Premium Content
        </p>
        <h2 className="mt-4 font-display text-2xl font-bold text-zinc-50 sm:text-3xl">
          This is a Premium research piece
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
          Unlock the full breakdown, on-chain data and analysis with an XYZ Crypto
          Premium membership.
        </p>

        <ul className="mx-auto mt-6 flex max-w-md flex-col gap-2 text-left sm:flex-row sm:flex-wrap sm:justify-center">
          {PERKS.map((p) => (
            <li key={p} className="inline-flex items-center gap-2 text-sm text-zinc-300">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-mint-500/15 text-mint-300 ring-1 ring-mint-500/30">
                <Check className="h-3 w-3" />
              </span>
              {p}
            </li>
          ))}
        </ul>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          {loggedIn ? (
            <MagneticButton>
              <Link href="/premium" className="btn-gold !px-6">
                Upgrade to Premium
              </Link>
            </MagneticButton>
          ) : (
            <>
              <MagneticButton>
                <Link href="/signup" className="btn-gold !px-6">
                  Create account
                </Link>
              </MagneticButton>
              <MagneticButton>
                <Link href="/login" className="btn-ghost !px-6">
                  Log in
                </Link>
              </MagneticButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
