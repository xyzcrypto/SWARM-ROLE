"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticTap } from "@shared/utils/haptics";

export type AttachItem = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
  busy?: boolean;
  disabled?: boolean;
};

/**
 * One "+" button for everything you can attach, instead of a row of them.
 *
 * ⚠️ Why this exists: the room's composer had Poll, GIF and Photo as three
 * separate 36px buttons in front of the text box. On a 390px phone that left
 * the text box so narrow that its placeholder wrapped onto two lines, the empty
 * composer grew to two lines to fit it, and the row stopped lining up with its
 * own buttons - the screenshot that prompted this. One button gives the text
 * box its width back, and the tray has room for a label on each option.
 *
 * `children` renders inside the positioned wrapper, so a picker opened from the
 * tray (the GIF picker) anchors to the same spot.
 */
export function AttachTray({ items, children }: { items: AttachItem[]; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const busy = items.some((i) => i.busy);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (items.length === 0) return <>{children}</>;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => { hapticTap(); setOpen((v) => !v); }}
        aria-label="Attach"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-300 transition-[background-color,color,transform] duration-200 hover:border-gold-500/40 hover:text-gold-200 active:scale-95",
          open && "border-gold-500/40 bg-gold-500/10 text-gold-200"
        )}
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className={cn("h-5 w-5 transition-transform duration-200", open && "rotate-45")} />}
      </button>
      {open && (
        <div
          role="menu"
          className="app-fade-in absolute bottom-full left-0 z-40 mb-2 w-48 overflow-hidden rounded-2xl border border-white/10 bg-ink-900 p-1.5 shadow-elevate"
        >
          {items.map(({ key, label, icon: Icon, onSelect, busy: itemBusy, disabled }) => (
            <button
              key={key}
              type="button"
              role="menuitem"
              disabled={disabled || itemBusy}
              onClick={() => { setOpen(false); onSelect(); }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] font-medium text-zinc-200 transition-colors hover:bg-white/[0.06] disabled:opacity-40"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.05] text-gold-300">
                {itemBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
              </span>
              {label}
            </button>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}
