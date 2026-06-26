"use client";

import { useSession } from "next-auth/react";
import { WaitlistForm } from "./WaitlistForm";

/**
 * The footer "Get alpha in your inbox" capture. Hidden for signed-in members -
 * they already have an account, so the repeated waitlist/subscribe band on every
 * page is redundant (and was reported as a duplicate). Guests still see it.
 */
export function FooterNewsletter() {
  const { data: session, status } = useSession();
  if (status === "loading" || session?.user) return null;

  return (
    <div className="py-12">
      <div className="surface relative grid items-center gap-6 overflow-hidden rounded-3xl p-6 sm:p-8 md:grid-cols-2">
        <div className="glow-orb -left-10 -top-12 h-44 w-44 bg-gold-500/12" />
        <div className="relative">
          <span className="eyebrow text-gold-200">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
            <span className="mono text-[11px] uppercase tracking-[0.18em]">Newsletter</span>
          </span>
          <h3 className="mt-4 font-display text-xl font-semibold text-zinc-50">
            Get alpha in your inbox
          </h3>
          <p className="mt-2 max-w-sm text-sm text-zinc-500">
            Research drops, product launches and airdrop alerts, straight to your
            email. No spam.
          </p>
        </div>
        <div className="relative">
          <WaitlistForm source="footer" cta="Subscribe" />
        </div>
      </div>
    </div>
  );
}
