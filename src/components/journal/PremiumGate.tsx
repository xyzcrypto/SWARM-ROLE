import Link from "next/link";
import { Check } from "lucide-react";
import { MagicStar } from "iconsax-react";
import { LockIcon } from "@/components/Icons3D";
import { MagneticButton } from "@/components/MagneticButton";

// Compact premium teaser for gating a dashboard SECTION (not a full page like
// PremiumLock.tsx, which is a marketing-weight card for a whole research
// post). Same visual language (gold glow, lock icon, perks), smaller footprint.
export function PremiumGate({ title, perks, loggedIn }: { title: string; perks: string[]; loggedIn: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-gold-500/25 bg-gradient-to-b from-gold-500/[0.06] to-transparent p-7 text-center sm:p-9">
      <div aria-hidden className="pointer-events-none absolute -top-16 left-1/2 h-40 w-80 max-w-[120%] -translate-x-1/2 rounded-full bg-gold-500/15 blur-3xl" />
      <div className="relative">
        <LockIcon className="mx-auto h-11 w-11" />
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gold-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gold-200 ring-1 ring-gold-500/30">
          <MagicStar size={12} variant="Bold" color="#f3d488" /> Premium
        </p>
        <h3 className="mt-3 font-display text-lg font-semibold text-zinc-50">{title}</h3>
        <ul className="mx-auto mt-4 flex max-w-sm flex-col gap-1.5 text-left">
          {perks.map((p) => (
            <li key={p} className="inline-flex items-center gap-2 text-xs text-zinc-300">
              <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-mint-500/15 text-mint-300 ring-1 ring-mint-500/30">
                <Check className="h-2.5 w-2.5" />
              </span>
              {p}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {loggedIn ? (
            <MagneticButton>
              <Link href="/premium" className="btn-gold !px-5 !py-2 text-sm">
                Upgrade to Premium
              </Link>
            </MagneticButton>
          ) : (
            <MagneticButton>
              <Link href="/login?callbackUrl=/journal" className="btn-gold !px-5 !py-2 text-sm">
                Log in
              </Link>
            </MagneticButton>
          )}
        </div>
      </div>
    </div>
  );
}
