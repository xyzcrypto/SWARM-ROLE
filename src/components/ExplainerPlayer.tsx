"use client";

import { useRef, useState } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The "What is XYZ Crypto?" explainer, below the hero.
 *
 * ⚠️ CLICK TO PLAY, and the video file is not even referenced until then.
 * This site is on the Vercel Hobby plan, where data transfer is rationed and has
 * already caused incidents (see the cost-check skill). A ~10 MB video that
 * downloaded for every visitor who scrolled past the hero would cost more than
 * every other homepage asset combined. Until the click, the section is a poster
 * image (tens of kB) and a button; `preload="none"` would still let some
 * browsers fetch metadata, so the <video> element simply does not exist yet.
 *
 * Desktop and phone get different cuts (16:9 and 9:16). The choice is made in
 * the click handler from the same breakpoint the CSS uses, never during render,
 * so the server and the first client render are identical (no hydration
 * mismatch - see CLAUDE.md on client-only signals).
 */
export const EXPLAINER = {
  version: "v1",
  /** Must match the Tailwind `md` breakpoint used for the frame and poster below. */
  desktopQuery: "(min-width: 768px)",
  desktop: "/media/explainer/xyz-explainer-v1-desktop.mp4",
  mobile: "/media/explainer/xyz-explainer-v1-mobile.mp4",
  posterDesktop: "/media/explainer/xyz-explainer-v1-poster-desktop.webp",
  posterMobile: "/media/explainer/xyz-explainer-v1-poster-mobile.webp",
  captions: "/media/explainer/xyz-explainer-v1-captions.vtt",
  durationLabel: "1:05",
  durationA11y: "1 minute 5 seconds",
} as const;

export function ExplainerPlayer() {
  const [src, setSrc] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const start = () => {
    const desktop = typeof window !== "undefined" && window.matchMedia(EXPLAINER.desktopQuery).matches;
    setSrc(desktop ? EXPLAINER.desktop : EXPLAINER.mobile);
    // Played from inside the click (a user gesture), so it may start WITH sound.
    requestAnimationFrame(() => void videoRef.current?.play().catch(() => {}));
  };

  return (
    <div
      className={cn(
        "relative mx-auto overflow-hidden rounded-3xl bg-ink-950 ring-1 ring-gold-500/25 shadow-gold",
        // Sized by the screen's HEIGHT, not its width, so the heading and the whole
        // frame fit on one screen together (owner request). The subtracted amount
        // is the fixed navbar plus the section heading above the frame; the frame's
        // width then follows from its aspect ratio. Phone: the 9:16 cut, never wider
        // than 400px. md+: the 16:9 cut, never wider than 1100px. Centred by mx-auto.
        "aspect-[9/16] w-full max-w-[min(25rem,calc((100svh_-_20.625rem)*9/16))]",
        "md:aspect-video md:max-w-[min(68.75rem,calc((100svh_-_21.25rem)*16/9))] md:rounded-4xl"
      )}
    >
      {src ? (
        <video
          ref={videoRef}
          src={src}
          poster={src === EXPLAINER.desktop ? EXPLAINER.posterDesktop : EXPLAINER.posterMobile}
          controls
          autoPlay
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full bg-ink-950 object-contain"
        >
          {/* On by default: plenty of people watch with the sound off. */}
          <track kind="captions" src={EXPLAINER.captions} srcLang="en" label="English" default />
        </video>
      ) : (
        <button
          type="button"
          onClick={start}
          aria-label={`Play the XYZ Crypto explainer video, ${EXPLAINER.durationA11y}`}
          className="group absolute inset-0 block h-full w-full text-left"
        >
          <picture>
            <source media={EXPLAINER.desktopQuery} srcSet={EXPLAINER.posterDesktop} type="image/webp" />
            {/* A plain <img>: a static, pre-sized poster gains nothing from next/image except optimisation cost (cost-check trap 3). */}
            <img
              src={EXPLAINER.posterMobile}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02] group-active:scale-[1.02]"
            />
          </picture>
          <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20" />
          <span className="absolute inset-0 grid place-items-center">
            <span className="relative grid h-20 w-20 place-items-center rounded-full bg-mint-500 text-ink-950 shadow-mint transition-transform duration-300 group-hover:scale-105 group-active:scale-105 sm:h-24 sm:w-24">
              <span className="explainer-ping absolute inset-0 rounded-full ring-2 ring-mint-400/60" />
              <Play className="ml-1 h-8 w-8 sm:h-10 sm:w-10" strokeWidth={1.7} fill="currentColor" />
            </span>
          </span>
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-3 sm:gap-3 sm:p-6">
            {/* Literal colours on purpose: the light theme remaps text-white / text-zinc-* to dark, which would vanish on this dark poster.
                ⚠️ And sm:text-[1rem], never sm:text-base: this config has a colour named `base`, so `text-base`
                also emits `color: var(--bg)` and painted this label the page background at sm and up. */}
            <span className="whitespace-nowrap text-sm font-semibold text-[#fff] sm:text-[1rem]">Watch the story</span>
            {/* The frame is narrow on a phone (it is sized to fit the screen's height), so the chip is short there. */}
            <span className="mono whitespace-nowrap rounded-full bg-black/55 px-2.5 py-1 text-[0.6875rem] text-[#f4f4f5] ring-1 ring-white/15 sm:px-3 sm:text-xs">
              {EXPLAINER.durationLabel}
              <span className="sm:hidden"> · CC</span>
              <span className="hidden sm:inline"> · sound + captions</span>
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
