"use client";

import { useSession } from "next-auth/react";
import { ArrowRight, ChevronRight } from "lucide-react";
import { ActionLink } from "./ActionLink";
import { scrollToHash } from "./HashScroll";
import { CommunityIcon, CrownIcon, LayersIcon, LockIcon, ResearchLabIcon, SecurityIcon } from "./Icons3D";

export type HeroResearch = {
  /** Published research posts. */
  count: number;
  /** Pre-formatted "2h ago" for the most recent one, or null if there are none. */
  newest: string | null;
};

/**
 * The hero's call to action.
 *
 * Three blocks in descending weight: the research card, one secondary row, and
 * a trust line. Everything above it (eyebrow, headline, lede) and below it
 * (live stats) is untouched.
 *
 * The card used to carry a live band scrolling our published research titles.
 * The owner asked for it gone (2026-08-04); the card keeps the two facts that
 * band was really there to prove - how many reports exist and how recent the
 * newest one is - as one quiet sub-line.
 *
 * ## The sizing rule this card has to respect
 *
 * The hero's text column is a **grid item**, so it carries the default
 * `min-width: auto`: any in-flow descendant with a wide max-content size pushes
 * the column out and drags the site's own headline with it. Measured here, the
 * removed track took the column from 372px to 3036px at 412px wide.
 *
 * Nowrap text is therefore bounded by the mechanism that actually applies to
 * it, and it is not the same one in every case:
 *   - a FLEX ITEM is bounded by `min-width: 0` (its automatic minimum),
 *   - a plain BLOCK is not - `overflow: hidden` clips the paint but leaves
 *     min-content at the full text width, so it needs a GRID track declared
 *     `minmax(0, 1fr)`.
 *
 * Assuming the first rule covered the second cost two fixes that changed
 * nothing. What survives here is the flex-item case: the title/sub-line block
 * is `min-w-0` inside a flex row, which is what keeps a long report count from
 * widening the hero.
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

  return (
    // CSS entrance rather than a motion `initial`, so the card is painted by
    // the browser instead of waiting for hydration - see the "Hero entrance"
    // block in globals.css.
    <div
      style={{ "--rise-dur": "0.6s", "--rise-delay": "0.24s" } as React.CSSProperties}
      className="hero-rise hero-ctablock mt-7 flex w-full min-w-0 max-w-full flex-col gap-2.5 text-left lg:max-w-[36.25rem] lg:gap-3"
    >
      {/* ---------------- primary: research ---------------- */}
      <ActionLink
        href="/academy/research"
        className="hero-cta group relative isolate flex min-w-0 max-w-full flex-col overflow-hidden rounded-2xl px-3.5 py-3.5 transition-[border-color,transform,box-shadow] duration-[400ms] ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-0.5 active:-translate-y-0.5 lg:rounded-[1.125rem] lg:px-[1.125rem] lg:py-4"
      >
        <span className="flex w-full min-w-0 items-center gap-3.5 lg:gap-[1.125rem]">
          <span className="hero-cta-icon relative grid h-[3.625rem] w-[3.625rem] flex-none place-items-center lg:h-[4.5rem] lg:w-[4.5rem]">
            <ResearchLabIcon className="relative h-full w-full" />
          </span>
          <span className="min-w-0 flex-1 overflow-hidden">
            <span className="block truncate text-[1.0625rem] font-bold leading-tight tracking-[-0.022em] text-zinc-50 lg:text-[1.3125rem]">
              Explore Research
            </span>
            <span className="mt-0.5 block truncate text-xs text-zinc-400 lg:mt-1 lg:text-[0.84375rem]">
              <b className="mono font-semibold text-mint-300 tabular-nums">{research.count}</b>{" "}
              {research.count === 1 ? "report" : "reports"}
              {research.newest ? ` · newest ${research.newest}` : ""}
            </span>
          </span>
          <span className="hero-cta-go relative grid h-11 w-11 flex-none place-items-center rounded-full text-[#04120c] lg:h-[3.25rem] lg:w-[3.25rem]">
            <span className="hero-cta-halo absolute inset-0 rounded-full border border-mint-500" />
            <ArrowRight
              className="relative z-10 h-[1.1875rem] w-[1.1875rem] transition-transform duration-[400ms] ease-[cubic-bezier(.22,1,.36,1)] group-hover:translate-x-[0.1875rem]"
              strokeWidth={2.4}
            />
          </span>
        </span>
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
        className="hero-row group/row flex min-w-0 max-w-full items-center gap-3 rounded-[0.875rem] border border-hairline bg-surface-2 px-3.5 py-2.5 transition-colors duration-300 lg:px-4 lg:py-3"
      >
        <span className="grid h-8 w-8 flex-none place-items-center opacity-90 transition-[transform,opacity] duration-300 ease-[cubic-bezier(.22,1,.36,1)] group-hover/row:-translate-y-px group-hover/row:scale-105 group-hover/row:opacity-100 lg:h-9 lg:w-9">
          {session ? <LayersIcon className="h-full w-full" /> : <CrownIcon className="h-full w-full" />}
        </span>
        <span className="min-w-0 flex-1 truncate text-[0.90625rem] font-semibold text-zinc-100 lg:text-[0.96875rem]">
          {session ? "View products" : "Get early access"}
        </span>
        {!session && <span className="mono flex-none text-[0.71875rem] text-zinc-500">Free</span>}
        <ChevronRight className="h-[1.0625rem] w-[1.0625rem] flex-none text-zinc-500 transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] group-hover/row:translate-x-[0.1875rem] group-hover/row:text-zinc-300" />
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
    </div>
  );
}

function TrustItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="group/t inline-flex min-w-0 items-center gap-1.5">
      <span className="grid h-[1.125rem] w-[1.125rem] flex-none place-items-center opacity-[0.68] transition-[transform,opacity] duration-300 ease-[cubic-bezier(.22,1,.36,1)] group-hover/t:-translate-y-0.5 group-hover/t:scale-110 group-hover/t:opacity-100 lg:h-5 lg:w-5">
        {icon}
      </span>
      <span className="whitespace-nowrap text-[0.65625rem] text-zinc-500 lg:text-[0.71875rem]">{label}</span>
    </span>
  );
}
