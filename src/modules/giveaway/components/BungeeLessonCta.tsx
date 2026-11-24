"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Copy, ExternalLink, Gift, Radio } from "lucide-react";
import { BUNGEE_CODE, BUNGEE_LINKS, BUNGEE_PRIZE, BUNGEE_REF_URL } from "../lib/bungee";

/**
 * Shown on Bungee Funded Perps lessons. Every lesson gets a slim giveaway
 * banner; the last lesson gets the full card with XYZ Crypto's referral link
 * and checkout code.
 */
export function BungeeLessonCta({ last }: { last: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(BUNGEE_CODE).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => undefined
    );
  };

  if (!last) {
    return (
      <Link
        href={BUNGEE_LINKS.giveaway}
        className="mt-10 flex items-center gap-3 rounded-2xl border border-gold-400/25 bg-gold-400/[0.05] px-4 py-3 text-sm text-content-muted transition-colors hover:border-gold-400/45"
      >
        <Gift className="h-4 w-4 shrink-0 text-gold-300" />
        <span className="min-w-0 flex-1">
          <span className="font-semibold text-content">{BUNGEE_PRIZE} giveaway.</span> Complete every lesson in this track, then enter.
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-gold-300" />
      </Link>
    );
  }

  return (
    <div className="mt-10 overflow-hidden rounded-3xl border border-gold-400/35 bg-gradient-to-br from-gold-400/[0.12] via-transparent to-mint-400/[0.06] p-6 sm:p-8">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-300">XYZ Crypto x Bungee Funded Perps</div>
      <h2 className="mt-2 font-display text-2xl font-semibold text-content">Start your Bungee challenge</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-content-muted">
        Open Bungee through the XYZ Crypto link and use code <span className="font-semibold text-gold-200">{BUNGEE_CODE}</span> at checkout for the discount. Check the
        final price before you pay in USDC on Base.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <a href={BUNGEE_REF_URL} target="_blank" rel="noopener noreferrer sponsored" className="btn-gold h-11 px-5 text-sm">
          Get funded on Bungee <ExternalLink className="h-4 w-4" />
        </a>
        <button type="button" onClick={copy} className="btn-ghost h-11 px-4 text-sm" aria-label={`Copy code ${BUNGEE_CODE}`}>
          {copied ? <Check className="h-4 w-4 text-mint-300" /> : <Copy className="h-4 w-4" />}
          <span className="font-mono tracking-wider">{BUNGEE_CODE}</span>
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link href={BUNGEE_LINKS.giveaway} className="group flex items-start gap-3 rounded-2xl border border-hairline bg-surface-2 p-4 transition-colors hover:border-gold-400/40">
          <Gift className="mt-0.5 h-5 w-5 shrink-0 text-gold-300" />
          <span>
            <span className="block text-sm font-semibold text-content">Enter the giveaway</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-content-subtle">{BUNGEE_PRIZE}. Finish every lesson check, then submit your entry.</span>
          </span>
        </Link>
        <Link href={BUNGEE_LINKS.live} className="group flex items-start gap-3 rounded-2xl border border-hairline bg-surface-2 p-4 transition-colors hover:border-mint-400/40">
          <Radio className="mt-0.5 h-5 w-5 shrink-0 text-mint-300" />
          <span>
            <span className="block text-sm font-semibold text-content">Play the Bungee live quiz</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-content-subtle">Play every live round until the giveaway ends. Activity counts.</span>
          </span>
        </Link>
      </div>

      <p className="mt-5 text-[11px] leading-relaxed text-content-subtle">
        Trading involves substantial risk. Past performance is not indicative of future results. Funded accounts are subject to the Bungee Funded Perps rulebook.
      </p>
    </div>
  );
}
