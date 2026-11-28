"use client";

import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, Loader2, Sparkles, X } from "lucide-react";
import { RobotIcon } from "@/components/RobotIcon";
import { MarkdownLite } from "@/components/MarkdownLite";
import { formatDateTime } from "@/lib/utils";
import { useHydrated } from "@/lib/useClientFlag";
import type { RadarItem } from "@modules/points/lib/airdrop-radar";
import { lockScroll, unlockScroll } from "@shared/hooks/useScrollLock";

/**
 * The AI briefing, given a page of its own instead of a drawer.
 *
 * ## Why this is a modal and not the strip it replaced
 *
 * The briefing used to render inside the news card's header as a panel capped at
 * `max-h-36` with its own scrollbar - roughly six lines. The model is asked for
 * what changed, what it means for farmers, dates to watch and what is still
 * unknown; four sections do not fit in six lines, so the reader met a scroll
 * region inside a card inside a hero. The answer was complete and the surface
 * was not.
 *
 * So the brief now takes the foreground: full height, the site's own type ramp,
 * and the stories it was built from listed underneath, because "which headlines
 * produced this" is the first question anyone asks of an AI summary.
 *
 * ## Portal, and why it is not optional
 *
 * ⚠️ The card this is launched from lives inside the hero, which sets
 * `overflow-hidden` and a `rounded-3xl`. A `position: fixed` child of an
 * `overflow-hidden` ancestor is still clipped by it in every engine, so rendered
 * in place this would be cropped to the hero's rounded corner rather than
 * covering the page. `createPortal` to `document.body` is what makes "fixed"
 * mean fixed.
 *
 * `useHydrated()` gates it because `document` does not exist on the server, and
 * this project has a standing rule that nothing reaching the DOM may be derived
 * from a client-only signal during render - the hook is the sanctioned way to
 * ask, since it carries a server snapshot.
 */
export function AirdropBriefModal({
  open,
  onClose,
  loading,
  streaming = false,
  text,
  error,
  sources,
  generatedAt,
  onRetry,
}: {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  /** Text is still arriving. `loading` ends at the first word; this ends at the last. */
  streaming?: boolean;
  text: string | null;
  error: string | null;
  /** The headlines the briefing was built from, in the order they were sent. */
  sources: RadarItem[];
  generatedAt: number | null;
  onRetry: () => void;
}) {
  const hydrated = useHydrated();
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // Escape closes, and the page behind does not scroll while this is up.
  // Restoring the exact previous value rather than setting "" matters: another
  // overlay may already have locked it, and blanking it would free the page
  // while that one is still open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
        lockScroll();
    document.addEventListener("keydown", onKey);
    return () => {
      unlockScroll();
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Focus the close button on open, so the overlay is reachable from the
  // keyboard and Escape is not the only way out.
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  const shown = useMemo(() => sources.slice(0, 8), [sources]);

  if (!open || !hydrated) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-ink-950/80 p-4 backdrop-blur-md sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="AI airdrop briefing"
      onMouseDown={(e) => {
        // Only a click that STARTS on the backdrop closes. Using onClick here
        // would close the dialog when a text selection that began inside the
        // panel happened to end on the backdrop, which is a real way to lose a
        // briefing someone was in the middle of reading.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="animate-rise-in glass my-auto flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-gold-500/20 shadow-elevate">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden border-b border-hairline bg-gradient-to-br from-gold-500/[0.10] via-transparent to-mint-500/[0.06] px-5 py-4 sm:px-7 sm:py-5">
          {/* One sheen pass on open. A loop here would be decoration; a single
              crossing reads as the panel arriving. */}
          <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 animate-sweep-x bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />

          <div className="relative flex items-start gap-3">
            <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-gold-500/25 bg-gold-500/10">
              <RobotIcon className="h-6 w-6 text-mint-300" />
              {loading && (
                <span className="absolute inset-0 animate-glow-breathe rounded-2xl ring-2 ring-mint-400/40" />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <span className="eyebrow eyebrow-glass inline-flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-gold-300" strokeWidth={2} />
                <span className="mono text-[0.625rem] font-semibold uppercase tracking-[0.16em]">
                  XYZ AI
                </span>
              </span>
              <h2 className="mt-2 font-display text-xl font-bold tracking-tight text-content sm:text-2xl">
                Airdrop <span className="text-shine">Briefing</span>
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-content-muted sm:text-sm">
                {shown.length > 0
                  ? `Written from the ${shown.length} most recent perp DEX and airdrop headlines.`
                  : "Written from the latest perp DEX and airdrop headlines."}
                {generatedAt ? ` · ${formatDateTime(new Date(generatedAt))}` : ""}
              </p>
            </div>

            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close the briefing"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-hairline text-content-subtle transition-all hover:scale-105 hover:border-gold-500/30 hover:text-content active:scale-105"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div className="max-h-[62vh] overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Loader2 className="h-7 w-7 animate-spin text-mint-300" strokeWidth={1.7} />
              <p className="text-sm text-content-muted">Reading the headlines…</p>
              <p className="max-w-sm text-xs leading-relaxed text-content-subtle">
                It starts writing in a second or two, and you can read it as it goes.
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] px-5 py-4">
              <p className="text-sm leading-relaxed text-amber-200">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="btn-secondary mt-3 inline-flex min-h-9 items-center text-xs"
              >
                Try again
              </button>
            </div>
          )}

          {text && !loading && (
            // The site's own prose treatment, not the 12px grey the strip used.
            // A briefing is the longest text on this page and was the smallest.
            <div className="text-sm leading-[1.75] text-content-muted [&_strong]:text-content">
              <MarkdownLite text={text} />
              {/* ⚠️ The stream has to be VISIBLE as a stream. Without this, a
                  briefing still being written is indistinguishable from one
                  that finished early - which is the exact ambiguity that made
                  the one-shot version so hard to diagnose. */}
              {streaming && (
                <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-mint-400 align-middle" />
              )}
            </div>
          )}

          {/* ── What it read ──────────────────────────────────────────── */}
          {shown.length > 0 && !loading && !streaming && (
            <div className="mt-7 border-t border-hairline pt-5">
              <h3 className="mono text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-content-subtle">
                Built from these stories
              </h3>
              <ol className="mt-3 space-y-1.5">
                {shown.map((s, n) => (
                  <li key={s.id}>
                    <a
                      href={s.url ? `/news/read?u=${encodeURIComponent(s.url)}` : "#"}
                      className="group flex items-start gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-white/[0.04]"
                    >
                      <span className="mono mt-0.5 shrink-0 text-[0.6875rem] font-semibold text-gold-300/70">
                        {String(n + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium leading-snug text-content">
                          {s.title}
                        </span>
                        <span className="mt-0.5 block text-[0.6875rem] text-content-subtle">
                          {s.source}
                          {s.venues.length > 0 ? ` · ${s.venues.slice(0, 2).join(", ")}` : ""}
                        </span>
                      </span>
                      <ArrowUpRight
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-content-subtle transition-all group-hover:translate-x-0.5 group-active:translate-x-0.5 group-hover:text-gold-300"
                        strokeWidth={1.7}
                      />
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        {/* ⚠️ `bg-surface-2`, never `bg-surface-2/60`. The semantic tokens are
            `var()`-backed, and an opacity modifier on a plain `var()` colour
            emits NO rule at all - the measured alpha comes back 0. That is the
            `bg-base/95` failure this project already shipped once, and
            `points-light-theme.test.ts` fails the build over it. */}
        <div className="flex flex-wrap items-center gap-3 border-t border-hairline bg-surface-2 px-5 py-3.5 sm:px-7">
          {/* ⚠️ Says what wrote it, every time. An AI summary of market news that
              does not announce itself is the one kind of copy on this site that
              could be mistaken for the desk's own reporting. */}
          <span className="inline-flex items-center gap-1.5 text-[0.6875rem] text-content-subtle">
            <RobotIcon className="h-3.5 w-3.5 text-mint-300" />
            Generated by XYZ AI. Check anything you would act on.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary ml-auto inline-flex min-h-9 items-center text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
