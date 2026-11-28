"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ImagePlus, Loader2, Lock, RefreshCw, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/lib/useClientFlag";
import { Avatar } from "@/components/Avatar";
import { presetsIn, type ChatBackground } from "@modules/community/lib/chat-backgrounds";
import { DIM_MAX, photoReadability, type WallpaperTheme } from "@modules/community/lib/chat-wallpaper";
import { ChatWallpaper, swatchStyle } from "./ChatWallpaper";
import type { ChatAppearance } from "./useChatAppearance";
import { ChatFeelSections } from "./ChatFeelSections";
import { feelAttrs, useChatFeel } from "@shared/utils/chat-feel";
import { lockScroll, unlockScroll } from "@shared/hooks/useScrollLock";

/**
 * Chat appearance: presets, your own photo, and a live preview of both.
 *
 * ## The preview is the room, not a picture of it
 *
 * It renders through `ChatWallpaper` - the same component the room uses - with
 * three message rows built from the room's real classes and the real `Avatar`.
 * A preview drawn separately would drift the first time either side changed,
 * and then the one thing this sheet exists to show would be wrong.
 *
 * ## Readability is shown, not asserted
 *
 * For a photo, the sheet prints the actual contrast of message text over the
 * photo's worst region at the current dim ("Text contrast 6.8:1 · AA"). The
 * slider cannot go below the computed floor, so the number can never read
 * under AA - but showing it turns "trust us" into something a member can see.
 *
 * ## Shape
 *
 * A bottom sheet on a phone (thumb-reachable, safe-area aware) and a centred
 * dialog from `sm` up. Portalled, because the chat shell is `overflow-hidden`
 * and a fixed child of an overflow-hidden ancestor is still clipped by it.
 */
export function ChatAppearanceSheet({
  appearance,
  theme,
  onClose,
}: {
  appearance: ChatAppearance;
  theme: WallpaperTheme;
  onClose: () => void;
}) {
  const hydrated = useHydrated();
  const feel = useChatFeel();
  const { choice, photo, settings, busy, error } = appearance;
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Shared, nested-safe lock: a hand-rolled save/restore here once left the
    // page frozen when two overlays closed out of order.
        lockScroll();
    document.addEventListener("keydown", onKey);
    return () => {
      unlockScroll();
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // A pending "tap again to remove" expires, so it cannot be armed by accident
  // and triggered minutes later.
  useEffect(() => {
    if (!confirmRemove) return;
    const t = setTimeout(() => setConfirmRemove(false), 3500);
    return () => clearTimeout(t);
  }, [confirmRemove]);

  const readability = photo ? photoReadability(photo, settings.dim, theme) : null;

  const pick = (files: FileList | null) => {
    const f = files?.[0];
    if (f) void appearance.uploadPhoto(f);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files);
  };

  if (!hydrated) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink-950/75 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="appearance-title"
      onMouseDown={(e) => {
        // Only a press that STARTS on the backdrop closes, so dragging the dim
        // slider past the sheet's edge does not dismiss it mid-adjustment.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="animate-rise-in flex max-h-[92svh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-hairline bg-surface-2 shadow-elevate sm:max-h-[88svh] sm:rounded-3xl">
        {/* Grab handle - a phone affordance only. */}
        <div aria-hidden className="flex justify-center pt-2.5 sm:hidden">
          {/* zinc, not `content-subtle`: an opacity modifier on a var()-based token
              emits no rule at all. */}
          <span className="h-1 w-10 rounded-full bg-zinc-500/40" />
        </div>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 px-5 pb-3 pt-3 sm:pt-5">
          <div className="min-w-0 flex-1">
            <h2 id="appearance-title" className="font-display text-lg font-bold tracking-tight text-content">
              Chat appearance
            </h2>
            <p className="mt-0.5 text-xs text-content-subtle">Background, colours, text, haptics and sounds - just for you, on this device.</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close chat appearance"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-hairline text-content-subtle transition-all hover:scale-105 hover:border-gold-500/30 hover:text-content active:scale-105"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          {/* ── Live preview ────────────────────────────────────── */}
          <div
            // A chat surface of its own, so the preview shows the chosen
            // accent, text size and spacing live.
            data-chat-surface="room"
            {...feelAttrs(feel)}
            className="relative isolate h-48 overflow-hidden rounded-2xl border border-hairline bg-base"
            aria-label="Preview of the chat with this background"
            role="img"
          >
            <ChatWallpaper choice={choice} photo={photo} settings={settings} className="absolute inset-0" />
            <div className="relative z-[1] flex h-full flex-col justify-end gap-1 p-3">
              <PreviewRow name="Aarav" time="9:41 AM" text="gm — Sodex snapshot lands Friday 👀" />
              <PreviewRow name="Sara" time="9:42 AM" text="Variational points up 12% this week" />
              <PreviewRow name="You" time="9:43 AM" text="Farming both. LFG 🚀" mine />
            </div>

            {readability && choice === "photo" && (
              <span
                className="absolute right-2.5 top-2.5 z-[2] inline-flex items-center gap-1 rounded-full border border-mint-500/30 bg-ink-950/70 px-2 py-0.5 text-[0.625rem] font-semibold text-mint-200 backdrop-blur"
                title="Contrast of message text over the brightest part of your photo"
              >
                <Check className="h-3 w-3" strokeWidth={2.5} />
                Text contrast {readability.contrast.toFixed(1)}:1 · {readability.contrast >= 7 ? "AAA" : "AA"}
              </span>
            )}
          </div>

          {/* ── Your photo ──────────────────────────────────────── */}
          <section className="mt-5" aria-labelledby="appearance-photo">
            <h3 id="appearance-photo" className="mono text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-content-subtle">
              Your photo
            </h3>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                pick(e.target.files);
                // Reset so picking the SAME file again still fires a change.
                e.target.value = "";
              }}
            />

            {!photo ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                disabled={busy}
                className={cn(
                  "mt-2.5 flex w-full items-center gap-3.5 rounded-2xl border border-dashed px-4 py-4 text-left transition-all duration-200 active:scale-[0.99] disabled:opacity-70",
                  dragging
                    ? "border-gold-400/60 bg-gold-500/[0.08]"
                    : "border-hairline hover:border-gold-500/35 hover:bg-white/[0.03]"
                )}
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gold-500/25 bg-gold-500/10 text-gold-200">
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" strokeWidth={1.8} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-content">
                    {busy ? "Preparing your photo…" : "Add your own photo"}
                  </span>
                  <span className="mt-0.5 block text-[0.6875rem] leading-relaxed text-content-subtle">
                    JPG, PNG or WebP, up to 20 MB{" "}
                    <span className="hidden sm:inline">· or drop it here</span>
                  </span>
                </span>
              </button>
            ) : (
              <div className="mt-2.5 space-y-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={choice === "photo"}
                    aria-label="Use your photo"
                    onClick={appearance.choosePhoto}
                    className={cn(
                      "relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border-2 transition-all duration-200 active:scale-95",
                      choice === "photo" ? "border-gold-400" : "border-hairline hover:border-gold-500/40"
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- local blob: URL */}
                    <img src={photo.url} alt="" className="h-full w-full object-cover" draggable={false} />
                    {choice === "photo" && <SelectedBadge />}
                  </button>

                  <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={busy}
                      className="btn-secondary inline-flex min-h-10 items-center gap-1.5 text-xs disabled:opacity-60"
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      {busy ? "Preparing…" : "Replace"}
                    </button>
                    {/* ⚠️ Two taps. Removing deletes the photo from this
                        browser, and the brief asks for confirmation before
                        anything destructive - a modal for this would be
                        heavier than the action deserves. */}
                    <button
                      type="button"
                      onClick={() => {
                        if (!confirmRemove) {
                          setConfirmRemove(true);
                          return;
                        }
                        setConfirmRemove(false);
                        void appearance.removePhoto();
                      }}
                      className={cn(
                        "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-xs font-semibold transition-all duration-200 active:scale-95",
                        confirmRemove
                          ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
                          : "border-hairline text-content-muted hover:border-amber-500/40 hover:text-amber-200"
                      )}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {confirmRemove ? "Tap again to remove" : "Remove"}
                    </button>
                  </div>
                </div>

                {choice === "photo" && readability && (
                  <div className="space-y-3 rounded-2xl border border-hairline p-3.5">
                    <label className="block">
                      <span className="flex items-center justify-between text-xs font-semibold text-content">
                        Dim
                        <span className="mono text-[0.6875rem] font-medium text-content-subtle">
                          {Math.round(readability.dim * 100)}%
                        </span>
                      </span>
                      <input
                        type="range"
                        min={Math.round(readability.floor * 100)}
                        max={Math.round(DIM_MAX * 100)}
                        step={1}
                        value={Math.round(readability.dim * 100)}
                        onChange={(e) => appearance.updateSettings({ dim: Number(e.target.value) / 100 })}
                        aria-valuetext={`${Math.round(readability.dim * 100)} percent`}
                        className="mt-2 block h-2 w-full cursor-pointer accent-gold-400"
                      />
                    </label>
                    {readability.floor > 0 && (
                      <p className="text-[0.6875rem] leading-relaxed text-content-subtle">
                        Can&rsquo;t go lighter than {Math.round(readability.floor * 100)}% on this photo — messages
                        would get hard to read.
                      </p>
                    )}

                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-content">Soften</span>
                        <span className="block text-[0.6875rem] text-content-subtle">
                          Blur the photo so it sits behind the conversation.
                        </span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={settings.blur}
                        aria-label="Blur the photo"
                        onClick={() => appearance.updateSettings({ blur: !settings.blur })}
                        className={cn(
                          "relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-200",
                          settings.blur ? "border-gold-400/60 bg-gold-500/80" : "border-hairline bg-zinc-500/30"
                        )}
                      >
                        <span
                          className={cn(
                            "absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
                            settings.blur ? "translate-x-[1.375rem]" : "translate-x-0.5"
                          )}
                        />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="mt-2.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3.5 py-2.5 text-xs leading-relaxed text-amber-200"
              >
                {error}
              </p>
            )}

            <p className="mt-2.5 inline-flex items-center gap-1.5 text-[0.6875rem] text-content-subtle">
              <Lock className="h-3 w-3" strokeWidth={2} />
              Stays in this browser. Never uploaded.
            </p>
          </section>

          <PresetSection title="Colour" items={presetsIn("colour")} appearance={appearance} />
          <PresetSection title="Pattern" items={presetsIn("pattern")} appearance={appearance} />

          <div className="mt-7 border-t border-hairline pt-1">
            <p className="mt-4 font-display text-[0.9375rem] font-bold tracking-tight text-content">Style &amp; feel</p>
          </div>
          <ChatFeelSections />
        </div>

        {/* ── Footer ───────────────────────────────────────────── */}
        <div className="flex justify-end border-t border-hairline px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:pb-3.5">
          <button type="button" onClick={onClose} className="btn-gold inline-flex min-h-10 items-center text-xs">
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function PresetSection({
  title,
  items,
  appearance,
}: {
  title: string;
  items: ChatBackground[];
  appearance: ChatAppearance;
}) {
  const id = `appearance-${title.toLowerCase()}`;
  return (
    <section className="mt-5" aria-labelledby={id}>
      <h3 id={id} className="mono text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-content-subtle">
        {title}
      </h3>
      <div className="mt-2.5 grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup" aria-labelledby={id}>
        {items.map((bg) => {
          const active = appearance.choice === bg.id;
          return (
            <button
              key={bg.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => appearance.choosePreset(bg.id)}
              className={cn(
                "group flex flex-col gap-1.5 rounded-xl border p-1.5 text-left transition-all duration-200 active:scale-[0.97]",
                active ? "border-gold-500/50 bg-gold-500/[0.07]" : "border-hairline hover:border-gold-500/25"
              )}
            >
              {/* The swatch paints the ACTUAL preset, through the same CSS
                  path the room uses, so it always shows the current theme. */}
              <span
                aria-hidden
                className="chat-wp relative block h-12 w-full overflow-hidden rounded-lg border border-hairline bg-base"
                style={swatchStyle(bg.dark, bg.light, bg.size)}
              >
                {active && <SelectedBadge />}
              </span>
              <span className={cn("truncate text-[0.6875rem] font-medium", active ? "text-gold-200" : "text-content-muted")}>
                {bg.label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SelectedBadge() {
  return (
    <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-gold-400 text-ink-950 shadow">
      <Check className="h-2.5 w-2.5" strokeWidth={3} />
    </span>
  );
}

/** One message row, built from the room's real classes. */
function PreviewRow({ name, time, text, mine = false }: { name: string; time: string; text: string; mine?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl px-2.5 py-1.5",
        mine && "chat-own"
      )}
    >
      <Avatar name={name} image={null} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[0.8125rem] font-semibold text-zinc-100">{name}</span>
          <span className="text-[0.6875rem] text-zinc-600">{time}</span>
        </div>
        <p className="truncate text-[length:var(--chat-fs)] leading-relaxed text-zinc-200">{text}</p>
      </div>
    </div>
  );
}
