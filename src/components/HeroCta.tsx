"use client";

import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { ArrowRight, ChevronRight } from "lucide-react";
import { ActionLink } from "./ActionLink";
import { scrollToHash } from "./HashScroll";
import { CommunityIcon, CrownIcon, LayersIcon, LockIcon, ResearchIcon, SecurityIcon } from "./Icons3D";

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
 * Three blocks in descending weight: the research card, one secondary row, and
 * a trust line. Everything above it (eyebrow, headline, lede) and below it
 * (live stats) is untouched.
 *
 * ## Why the layout is shaped the way it is
 *
 * The card is a COLUMN, not a row: the feed gets the card's full width rather
 * than competing with the icon and the button for one line. That is not a style
 * preference. The hero's text column is a **grid item**, so it carries the
 * default `min-width: auto` - any in-flow descendant with a wide max-content
 * size pushes the whole column out and drags the site's own headline with it.
 * Measured during design: a five-post feed on the same line took the column from
 * 372px to 3036px. Two consequences are load-bearing:
 *
 *  1. `.hero-feed-track` is absolutely positioned (see globals.css), so its
 *     width contributes nothing to intrinsic sizing. No post count can widen
 *     the hero.
 *  2. Nowrap text is bounded by the mechanism that actually applies to it,
 *     which is not the same one in every case:
 *       - a FLEX ITEM is bounded by `min-width: 0` (its automatic minimum),
 *       - a plain BLOCK is not - `overflow: hidden` clips the paint but leaves
 *         min-content at the full text width, so it must sit in a GRID track
 *         declared `minmax(0, 1fr)`.
 *     Both were measured here, and assuming the first rule covered the second
 *     cost two fixes that changed nothing.
 *
 * ## Colour
 *
 * Icons come from the project's own Icons3D set rather than being drawn here,
 * so the depth treatment (gradient body, gloss, drop shadow) and the always-on
 * `i3d-*` signature motion match the rest of the site instead of being a
 * second, slightly-different 3D language.
 */
export function HeroCta({ research }: { research: HeroResearch }) {
  const { data: session } = useSession();

  // The newest post is pinned and static so it can actually be read as "this
  // one is new"; everything older scrolls. That split is the whole point of the
  // band - a headline that is already mid-slide on arrival announces nothing.
  const [newest, ...older] = research.titles;
  // Under three older titles there is not enough content to fill the track, and
  // a short loop reads as a stutter rather than a ticker, so it renders static.
  const scrolls = older.length >= 3;
  // ~7s of travel per title keeps the speed constant at any post count.
  const durationS = Math.max(18, older.length * 7);

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
        className="hero-cta group relative isolate flex min-w-0 max-w-full flex-col gap-3 overflow-hidden rounded-2xl px-3.5 py-3.5 transition-[border-color,transform,box-shadow] duration-[400ms] ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-0.5 lg:rounded-[18px] lg:px-[18px] lg:py-4"
      >
        <span className="flex w-full min-w-0 items-center gap-3.5 lg:gap-[18px]">
          <span className="hero-cta-icon relative grid h-[58px] w-[58px] flex-none place-items-center lg:h-[72px] lg:w-[72px]">
            <ResearchIcon className="relative h-full w-full" />
          </span>
          <span className="min-w-0 flex-1 overflow-hidden">
            <span className="block truncate text-[17px] font-bold leading-tight tracking-[-0.022em] text-zinc-50 lg:text-[21px]">
              Explore Research
            </span>
            <span className="mt-0.5 block truncate text-xs text-zinc-400 lg:mt-1 lg:text-[13.5px]">
              <b className="mono font-semibold text-mint-300 tabular-nums">{research.count}</b>{" "}
              {research.count === 1 ? "report" : "reports"}
              {research.newest ? ` · newest ${research.newest}` : ""}
            </span>
          </span>
          <span className="hero-cta-go relative grid h-11 w-11 flex-none place-items-center rounded-full text-[#04120c] lg:h-[52px] lg:w-[52px]">
            <span className="hero-cta-halo absolute inset-0 rounded-full border border-mint-500" />
            <ArrowRight
              className="relative z-10 h-[19px] w-[19px] transition-transform duration-[400ms] ease-[cubic-bezier(.22,1,.36,1)] group-hover:translate-x-[3px]"
              strokeWidth={2.4}
            />
          </span>
        </span>

        {/* The band is a GRID with a `minmax(0, 1fr)` column, not a flex column,
            and that is load-bearing rather than styling.

            `overflow: hidden` only zeroes the automatic minimum of a FLEX ITEM.
            A plain block still reports the full width of its nowrap text as
            min-content however hard it is clipped, and the hero's own column
            (a grid item, so `min-width: auto`) then grows to fit it. Measured
            at 360px: the pinned title took the column from 320 to 367, and
            neither `min-w-0` nor `overflow-hidden` on it or on any parent moved
            that - two attempted fixes changed nothing. A `minmax(0, 1fr)` track
            caps its items at a zero minimum, which is the thing that actually
            bounds it. */}
        {newest && (
          <span className="hero-feed grid w-full min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5 overflow-hidden rounded-xl px-2.5 py-2 lg:gap-2 lg:px-3 lg:py-2.5">
            {/* (a) the new one, pinned and static. One truncating block with the
                badge inline rather than a flex row of badge + title: as two flex
                siblings each was fine alone but together they pushed the column
                out, and a single line is simpler anyway. */}
            <span className="block w-full min-w-0 truncate text-[12.5px] font-semibold text-zinc-100 lg:text-[13.5px]">
              <span className="mono mr-1.5 inline-flex items-center gap-1.5 rounded-md bg-mint-500 px-1.5 py-[3.5px] align-[1.5px] text-[8.5px] font-bold leading-none tracking-[0.12em] text-[#04120c] lg:px-2 lg:py-1 lg:text-[9px]">
                <i className="hero-cta-blink h-1 w-1 rounded-full bg-[#04120c]" />
                NEW
              </span>
              {newest}
            </span>

            {/* (b) everything already published, scrolling */}
            {older.length > 0 && (
              <span className="hero-feed-mask relative h-[15px] w-full min-w-0 overflow-hidden lg:h-[17px]">
                <span
                  className={scrolls ? "hero-feed-track" : "absolute left-0 top-0 flex h-full items-center"}
                  style={scrolls ? { animationDuration: `${durationS}s` } : undefined}
                >
                  {(scrolls ? [...older, ...older] : older).map((t, i) => (
                    <span
                      key={`${i}-${t}`}
                      className="flex flex-none items-center whitespace-nowrap pr-4 text-[11.5px] text-zinc-400 after:ml-2 after:h-[3px] after:w-[3px] after:rounded-full after:bg-current after:opacity-40 after:content-[''] lg:pr-5 lg:text-[12.5px]"
                    >
                      {t}
                    </span>
                  ))}
                </span>
              </span>
            )}
          </span>
        )}
      </ActionLink>

      {/* ---------------- secondary row ----------------
          Guests keep the signup path they had before this redesign; members,
          who cannot sign up again, get the products jump instead. Dropping the
          signup CTA for logged-out visitors would have been a silent conversion
          change, so it is deliberately preserved. */}
      <ActionLink
        href={session ? "/#products" : "/signup"}
        onClick={
          session
            ? (e) => {
                if (scrollToHash("#products")) e.preventDefault();
              }
            : undefined
        }
        className="hero-row group/row flex min-w-0 max-w-full items-center gap-3 rounded-[14px] border border-hairline bg-surface-2 px-3.5 py-2.5 transition-colors duration-300 lg:px-4 lg:py-3"
      >
        <span className="grid h-9 w-9 flex-none place-items-center transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] group-hover/row:-translate-y-px group-hover/row:scale-105 lg:h-10 lg:w-10">
          {session ? <LayersIcon className="h-full w-full" /> : <CrownIcon className="h-full w-full" />}
        </span>
        <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-zinc-100 lg:text-[15.5px]">
          {session ? "View products" : "Get early access"}
        </span>
        {!session && <span className="mono flex-none text-[11.5px] text-zinc-500">Free</span>}
        <ChevronRight className="h-[17px] w-[17px] flex-none text-zinc-500 transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] group-hover/row:translate-x-[3px] group-hover/row:text-zinc-300" />
      </ActionLink>

      {/* ---------------- trust line ----------------
          Deliberately the quietest thing here: no card, no dividers, no tinted
          tiles. Boxed, it carried the same visual weight as the two real
          actions above it, which is not what a reassurance line is for. */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-0.5 lg:justify-start lg:gap-x-5">
        <TrustItem icon={<SecurityIcon className="h-full w-full" />} label="Free to join" />
        <TrustItem icon={<LockIcon className="h-full w-full" />} label="No wallet required" />
        <TrustItem icon={<CommunityIcon className="h-full w-full" />} label="Community first" />
      </div>
    </motion.div>
  );
}

function TrustItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="group/t inline-flex min-w-0 items-center gap-1.5">
      <span className="grid h-[22px] w-[22px] flex-none place-items-center transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] group-hover/t:-translate-y-0.5 group-hover/t:scale-110 lg:h-6 lg:w-6">
        {icon}
      </span>
      <span className="whitespace-nowrap text-[10.5px] text-zinc-500 lg:text-[11.5px]">{label}</span>
    </span>
  );
}
