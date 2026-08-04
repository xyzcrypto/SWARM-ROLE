"use client";

import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { ArrowRight, ChevronRight, Layers, ShieldCheck, Users, Wallet } from "lucide-react";
import { ActionLink } from "./ActionLink";
import { scrollToHash } from "./HashScroll";

export type HeroResearch = {
  /** Titles of our own published research posts, newest first. Titles only. */
  titles: string[];
  /** Total published research posts (may exceed titles.length). */
  count: number;
  /** Pre-formatted "2h ago" style label for the newest post, or null. */
  newest: string | null;
};

/**
 * The hero's call to action.
 *
 * Three blocks, in descending weight: the research card, one secondary row, and
 * a trust line. Everything above it (eyebrow, headline, lede) and below it (live
 * stats) is untouched.
 *
 * ## Why the layout is shaped the way it is
 *
 * The card is a COLUMN, not a row: the feed band gets the card's full width
 * rather than competing with the illustration and the button for one line.
 * That is not a style preference. The hero's text column is a **grid item**, so
 * it carries the default `min-width: auto` - any in-flow descendant with a wide
 * max-content size pushes the whole column out and drags the site's own headline
 * with it. Measured during design: a five-post feed on the same line took the
 * column from 372px to 3036px. Two consequences are load-bearing here:
 *
 *  1. `.hero-feed-track` is absolutely positioned (see globals.css), so its
 *     width contributes nothing to intrinsic sizing. No number of posts can
 *     widen the hero.
 *  2. Text that must not wrap (`truncate`) sits inside `overflow-hidden`
 *     parents. `min-w-0` alone does NOT zero a block child's min-content
 *     contribution; `overflow: hidden` does. A sub-line without it leaked 44px
 *     at 360px.
 *
 * Verified at 360 / 412 / 1440: headline, stack and card all report the same x
 * and the same width.
 */
export function HeroCta({ research }: { research: HeroResearch }) {
  const { data: session } = useSession();

  // A single copy is duplicated below; the marquee translates -50%, so the loop
  // is seamless for any count. Under three titles there is not enough content to
  // fill the band, and a short loop reads as a stutter rather than a ticker, so
  // it renders static instead.
  const titles = research.titles;
  const scrolls = titles.length >= 3;
  // ~7s of travel per title keeps the speed constant whether there are 4 posts
  // or 40.
  const durationS = Math.max(18, titles.length * 7);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.24 }}
      className="mt-7 flex w-full min-w-0 max-w-full flex-col gap-2.5 text-left lg:max-w-[580px] lg:gap-3"
    >
      {/* ---------------- primary: research ---------------- */}
      <ActionLink
        href="/research"
        className="hero-cta group relative isolate flex min-w-0 max-w-full flex-col gap-2.5 overflow-hidden rounded-2xl border border-mint-500/30 bg-[linear-gradient(135deg,rgba(34,214,146,0.12),rgba(34,214,146,0.02))] px-3.5 py-3.5 transition-[border-color,transform,box-shadow] duration-[400ms] ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-0.5 hover:border-mint-500/70 hover:shadow-[0_18px_40px_-24px_rgba(11,187,124,0.55)] lg:gap-3 lg:rounded-[18px] lg:px-[18px] lg:py-4"
      >
        <span className="flex w-full min-w-0 items-center gap-3.5 lg:gap-[18px]">
          <ResearchScene />
          <span className="min-w-0 flex-1 overflow-hidden">
            <span className="block truncate text-[17px] font-bold leading-tight tracking-[-0.022em] text-[#f4fff9] lg:text-[21px]">
              Explore Research
            </span>
            <span className="mt-0.5 block truncate text-xs text-zinc-400 lg:mt-1 lg:text-[13.5px]">
              <b className="mono font-semibold text-mint-200 tabular-nums">{research.count}</b>{" "}
              {research.count === 1 ? "report" : "reports"}
              {research.newest ? ` · newest ${research.newest}` : ""}
            </span>
          </span>
          <span className="relative grid h-11 w-11 flex-none place-items-center rounded-full bg-[linear-gradient(160deg,#48e5aa,#0bbb7c)] text-[#04120c] lg:h-[52px] lg:w-[52px]">
            <span className="hero-cta-halo absolute inset-0 rounded-full border border-mint-500" />
            <ArrowRight
              className="relative z-10 h-[19px] w-[19px] transition-transform duration-[400ms] ease-[cubic-bezier(.22,1,.36,1)] group-hover:translate-x-[3px]"
              strokeWidth={2.4}
            />
          </span>
        </span>

        {titles.length > 0 && (
          <span className="flex w-full min-w-0 items-center gap-2.5 border-t border-mint-500/15 pt-2.5 lg:gap-3 lg:pt-3">
            {/* Pinned, never scrolls. This is the one word that has to be read,
                and a moving label cannot be. */}
            <span className="mono inline-flex flex-none items-center gap-1.5 rounded-[5px] bg-mint-500 px-1.5 py-[4.5px] text-[8.5px] font-bold leading-none tracking-[0.12em] text-[#04120c] lg:px-[7px] lg:py-[5px] lg:text-[9px]">
              <i className="hero-cta-blink h-1 w-1 rounded-full bg-[#04120c]" />
              NEW LIVE
            </span>
            <span className="hero-feed-mask relative h-[17px] min-w-0 flex-1 overflow-hidden lg:h-[19px]">
              <span
                className={scrolls ? "hero-feed-track" : "absolute left-0 top-0 flex h-full items-center"}
                style={scrolls ? { animationDuration: `${durationS}s` } : undefined}
              >
                {(scrolls ? [...titles, ...titles] : titles).map((t, i) => (
                  <span
                    key={`${i}-${t}`}
                    className={`flex flex-none items-center whitespace-nowrap pr-[18px] text-[12.5px] lg:pr-[22px] lg:text-[13.5px] after:ml-2.5 after:h-[3px] after:w-[3px] after:rounded-full after:bg-zinc-600 after:content-[''] ${
                      i === 0 ? "font-semibold text-[#eafff6]" : "text-zinc-300"
                    }`}
                  >
                    {t}
                  </span>
                ))}
              </span>
            </span>
          </span>
        )}
      </ActionLink>

      {/* ---------------- secondary row ----------------
          Guests keep the signup path they had before this redesign; members,
          who cannot sign up again, get the products jump instead. Dropping the
          signup CTA for logged-out visitors would have been a silent conversion
          change, so it is deliberately preserved. */}
      {session ? (
        <ActionLink
          href="/#products"
          onClick={(e) => {
            if (scrollToHash("#products")) e.preventDefault();
          }}
          className="group/row flex min-w-0 max-w-full items-center gap-3 rounded-[14px] border border-white/[0.085] bg-white/[0.016] px-3.5 py-3 transition-colors duration-300 hover:border-violet-400/40 hover:bg-violet-500/[0.045] lg:px-4 lg:py-3.5"
        >
          <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] border border-violet-400/30 bg-violet-500/[0.13] text-violet-300 transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] group-hover/row:-translate-y-px group-hover/row:scale-105">
            <Layers className="h-[17px] w-[17px]" strokeWidth={1.8} />
          </span>
          <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-zinc-100 lg:text-[15.5px]">
            View products
          </span>
          <ChevronRight className="h-[17px] w-[17px] flex-none text-zinc-500 transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] group-hover/row:translate-x-[3px] group-hover/row:text-zinc-300" />
        </ActionLink>
      ) : (
        <ActionLink
          href="/signup"
          className="group/row flex min-w-0 max-w-full items-center gap-3 rounded-[14px] border border-white/[0.085] bg-white/[0.016] px-3.5 py-3 transition-colors duration-300 hover:border-mint-500/40 hover:bg-mint-500/[0.05] lg:px-4 lg:py-3.5"
        >
          <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] border border-mint-500/30 bg-mint-500/[0.13] text-mint-300 transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] group-hover/row:-translate-y-px group-hover/row:scale-105">
            <Users className="h-[17px] w-[17px]" strokeWidth={1.8} />
          </span>
          <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-zinc-100 lg:text-[15.5px]">
            Get early access
          </span>
          <span className="mono flex-none text-[11.5px] text-zinc-500">Free</span>
          <ChevronRight className="h-[17px] w-[17px] flex-none text-zinc-500 transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] group-hover/row:translate-x-[3px] group-hover/row:text-zinc-300" />
        </ActionLink>
      )}

      {/* ---------------- trust line ----------------
          Deliberately the quietest thing here: no card, no dividers, no tinted
          tiles. Boxed, it carried the same visual weight as the two real
          actions above it, which is not what a reassurance line is for. */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-0.5 lg:justify-start lg:gap-x-5">
        <TrustItem icon={<ShieldCheck className="h-[13px] w-[13px]" strokeWidth={2} />} tone="text-mint-400" label="Free to join" />
        <TrustItem icon={<Wallet className="h-[13px] w-[13px]" strokeWidth={2} />} tone="text-violet-400" label="No wallet required" />
        <TrustItem icon={<Users className="h-[13px] w-[13px]" strokeWidth={2} />} tone="text-gold-500" label="Community first" />
      </div>
    </motion.div>
  );
}

function TrustItem({ icon, tone, label }: { icon: React.ReactNode; tone: string; label: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className={`grid flex-none place-items-center opacity-85 ${tone}`}>{icon}</span>
      <span className="whitespace-nowrap text-[10.5px] text-zinc-500 lg:text-[11.5px]">{label}</span>
    </span>
  );
}

/**
 * The card's illustration: a lens over candles on an orbit pad, drawn inline.
 *
 * Deliberately SVG and not an image. The reference mockup used a 3D render we
 * have no asset for; at hero position an image would also be the LCP element and
 * cost a request. This is roughly 2 kB of markup and paints with the document.
 */
function ResearchScene() {
  return (
    <span className="h-[72px] w-[72px] flex-none lg:h-[92px] lg:w-[92px]">
      <svg viewBox="0 0 92 92" aria-hidden="true" className="block h-full w-full overflow-visible">
        <defs>
          <clipPath id="heroLens">
            <circle cx="46" cy="36" r="17" />
          </clipPath>
          <linearGradient id="heroRim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#48e5aa" />
            <stop offset="1" stopColor="#0bbb7c" />
          </linearGradient>
        </defs>
        <ellipse className="hero-pad" cx="46" cy="72" rx="30" ry="9" fill="none" stroke="#22d692" strokeWidth="1.5" />
        <ellipse className="hero-pad hero-pad-2" cx="46" cy="72" rx="22" ry="6.5" fill="none" stroke="#22d692" strokeWidth="1.5" />
        <ellipse className="hero-pad hero-pad-3" cx="46" cy="72" rx="13" ry="4" fill="none" stroke="#22d692" strokeWidth="1.5" />
        <g className="hero-panel-l">
          <rect x="4" y="30" width="20" height="17" rx="4" fill="rgba(34,214,146,0.09)" stroke="rgba(34,214,146,0.3)" />
          <rect x="8" y="39" width="3" height="5" rx="1" fill="#22d692" />
          <rect x="13" y="36" width="3" height="8" rx="1" fill="#22d692" opacity="0.75" />
          <rect x="18" y="33" width="3" height="11" rx="1" fill="#22d692" opacity="0.55" />
        </g>
        <g className="hero-panel-r">
          <rect x="68" y="26" width="21" height="18" rx="4" fill="rgba(34,214,146,0.09)" stroke="rgba(34,214,146,0.3)" />
          <circle cx="73" cy="32" r="1.8" fill="#22d692" />
          <rect x="77" y="31" width="9" height="2" rx="1" fill="#22d692" opacity="0.5" />
          <circle cx="73" cy="38" r="1.8" fill="#22d692" opacity="0.6" />
          <rect x="77" y="37" width="7" height="2" rx="1" fill="#22d692" opacity="0.35" />
        </g>
        <g className="hero-lens">
          <circle cx="46" cy="36" r="17" fill="rgba(4,18,12,0.85)" stroke="url(#heroRim)" strokeWidth="3" />
          <g clipPath="url(#heroLens)">
            <rect className="hero-candle" x="36" y="34" width="3.4" height="10" rx="1.2" fill="#48e5aa" />
            <rect className="hero-candle" x="42" y="30" width="3.4" height="14" rx="1.2" fill="#22d692" />
            <rect className="hero-candle" x="48" y="33" width="3.4" height="11" rx="1.2" fill="#48e5aa" />
            <rect className="hero-candle" x="54" y="28" width="3.4" height="16" rx="1.2" fill="#22d692" />
          </g>
          <path d="M58 48 L68 58" stroke="url(#heroRim)" strokeWidth="3.4" strokeLinecap="round" />
        </g>
      </svg>
    </span>
  );
}
