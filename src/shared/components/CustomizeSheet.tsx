"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SlidersHorizontal, X } from "lucide-react";
import { CUSTOMIZE_EVENT } from "@shared/utils/site-prefs";
import { consumePending } from "@shared/hooks/useIdleGate";
import { chatPressFeedback } from "@shared/utils/chat-feedback";
import { useScrollLock } from "@shared/hooks/useScrollLock";
import { CustomizePanel } from "./CustomizePanel";

/**
 * The "Customize website" sheet, mounted once for the whole site and opened by
 * `openCustomize()` from the navbar, the side menu or Settings. Renders nothing
 * until opened. A bottom sheet on phones, a centred dialog from `sm` up.
 */
export function CustomizeSheet() {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  useScrollLock(open);

  useEffect(() => {
    // Asked for before this chunk had loaded: open now.
    if (consumePending(CUSTOMIZE_EVENT)) queueMicrotask(() => setOpen(true));
    const onOpen = () => setOpen(true);
    window.addEventListener(CUSTOMIZE_EVENT, onOpen);
    return () => window.removeEventListener(CUSTOMIZE_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-ink-950/75 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customize-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
      onPointerDownCapture={chatPressFeedback}
    >
      <div className="app-fade-in flex max-h-[92svh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-hairline bg-surface-2 shadow-elevate sm:max-h-[88svh] sm:rounded-3xl">
        <div aria-hidden className="flex justify-center pt-2.5 sm:hidden"><span className="h-1 w-10 rounded-full bg-zinc-500/40" /></div>
        <div className="flex items-start gap-3 px-5 pb-3 pt-3 sm:pt-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-500/15 text-gold-300 ring-1 ring-gold-500/30"><SlidersHorizontal className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="customize-title" className="font-display text-lg font-bold tracking-tight text-content">Customize website</h2>
            <p className="mt-0.5 text-xs text-content-subtle">Make XYZ Crypto look and feel the way you like.</p>
          </div>
          <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-hairline text-content-subtle transition-colors hover:border-gold-500/30 hover:text-content">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
          <CustomizePanel />
        </div>
        <div className="flex justify-end border-t border-hairline px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:pb-3.5">
          <button type="button" onClick={() => setOpen(false)} className="btn-gold inline-flex min-h-10 items-center text-xs">Done</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
