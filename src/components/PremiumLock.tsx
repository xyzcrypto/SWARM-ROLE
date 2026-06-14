import Link from "next/link";
import { Lock, Sparkles } from "lucide-react";

/**
 * Locked teaser shown in place of a premium post's body for non-Premium users.
 * The full content is never rendered/sent here - gating happens server-side.
 */
export function PremiumLock({ loggedIn }: { loggedIn: boolean }) {
  return (
    <div className="relative mt-8 overflow-hidden rounded-2xl border border-gold-500/25 bg-gradient-to-b from-gold-500/[0.06] to-transparent p-8 text-center sm:p-12">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-500/15 ring-1 ring-gold-500/30">
        <Lock className="h-6 w-6 text-gold-300" />
      </div>
      <p className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-gold-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gold-200 ring-1 ring-gold-500/30">
        <Sparkles className="h-3.5 w-3.5" /> Premium Content
      </p>
      <h2 className="mt-4 font-display text-2xl font-bold text-zinc-50">
        This is a Premium research piece
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
        Unlock the full breakdown, on-chain data and analysis with an XYZ Crypto
        Premium membership.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {loggedIn ? (
          <Link href="/premium" className="btn-gold !px-6">
            Upgrade to Premium
          </Link>
        ) : (
          <>
            <Link href="/signup" className="btn-gold !px-6">
              Create account
            </Link>
            <Link href="/login" className="btn-ghost !px-6">
              Log in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
