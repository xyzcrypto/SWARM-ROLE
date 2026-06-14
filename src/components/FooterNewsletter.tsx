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
    <div className="grid items-center gap-6 border-b border-line py-12 md:grid-cols-2">
      <div>
        <h3 className="font-display text-xl font-semibold text-zinc-50">
          Get alpha in your inbox
        </h3>
        <p className="mt-2 max-w-sm text-sm text-zinc-500">
          Research drops, product launches and airdrop alerts, straight to your
          email. No spam.
        </p>
      </div>
      <WaitlistForm source="footer" cta="Subscribe" />
    </div>
  );
}
