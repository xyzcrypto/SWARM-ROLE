"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CHAT_BACKGROUNDS,
  CHAT_BG_KEY,
  chatBackgroundById,
  isChatBackgroundId,
  type ChatBackgroundId,
} from "@modules/community/lib/chat-backgrounds";

/**
 * Remember the reader's chat background.
 *
 * ## Why `localStorage` and not the database
 *
 * ⚠️ A deliberate architecture choice, and the brief asked for the simplest one
 * that fits. A wallpaper is a per-DEVICE display preference, like the theme
 * toggle this site already stores the same way. Putting it on `User` would mean
 * a schema column, a settings endpoint, a write on every change, and a
 * round-trip before the room can paint - to synchronise something nobody misses
 * when it differs between their laptop and their phone.
 *
 * It also means guests and members behave identically, with no second code path.
 *
 * ## Why the read is in an effect
 *
 * ⚠️ `localStorage` does not exist on the server. Reading it during render
 * makes the first client render disagree with the server's, which is React
 * #418 - the failure that once blanked every page on this site. So the state
 * starts at the same default the server assumed, and the stored choice is
 * applied one commit later. The only visible consequence is that a non-default
 * background fades in on load, which is why the container animates it.
 */
export function useChatBackground() {
  const [id, setId] = useState<ChatBackgroundId>("default");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHAT_BG_KEY);
      // Required, not an oversight: `localStorage` does not exist on the
      // server, so this MUST happen after mount. Reading it during render is
      // precisely the client-only-signal hydration mismatch (React #418) that
      // once blanked every page on this site.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (isChatBackgroundId(saved)) setId(saved);
    } catch {
      // Private mode, blocked storage: the default is a fine answer.
    }
  }, []);

  const choose = (next: ChatBackgroundId) => {
    setId(next);
    try {
      localStorage.setItem(CHAT_BG_KEY, next);
    } catch {
      // Not persisting is survivable; not applying it would not be.
    }
  };

  return { id, choose };
}

/**
 * The picker. A small popover of swatches, opened from the room header.
 *
 * Each swatch previews the real gradient rather than a coloured dot, because
 * the whole point of the choice is what it looks like behind messages.
 */
export function ChatBackgroundPicker({
  value,
  onChange,
  isDark,
}: {
  value: ChatBackgroundId;
  onChange: (id: ChatBackgroundId) => void;
  /** Which variant to preview. The room is used in both themes. */
  isDark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Same dismissal contract as the other popovers in this app: outside click
  // and Escape. A menu that only closes by re-clicking its own trigger is the
  // kind of thing that ships.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Change the chat background"
        aria-expanded={open}
        aria-haspopup="menu"
        title="Chat background"
        className={cn(
          // 36px, which is the size the other header controls use; the 44px
          // floor applies to the message-row actions, which are the ones that
          // get mis-tapped.
          "grid h-9 w-9 place-items-center rounded-xl border transition-all duration-200",
          "hover:scale-105 active:scale-105",
          open
            ? "border-gold-500/40 bg-gold-500/10 text-gold-200"
            : "border-hairline text-content-subtle hover:border-gold-500/30 hover:text-content"
        )}
      >
        <Palette className="h-4 w-4" strokeWidth={1.8} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Chat backgrounds"
          className="animate-rise-in absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-hairline bg-surface-2 p-2 shadow-elevate"
        >
          <p className="mono px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-content-subtle">
            Background
          </p>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            {CHAT_BACKGROUNDS.map((bg) => {
              const active = bg.id === value;
              const preview = isDark ? bg.dark : bg.light;
              return (
                <button
                  key={bg.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    onChange(bg.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "group flex flex-col gap-1.5 rounded-xl border p-1.5 text-left transition-all duration-200 active:scale-[0.98]",
                    active
                      ? "border-gold-500/45 bg-gold-500/[0.07]"
                      : "border-hairline hover:border-gold-500/25"
                  )}
                >
                  {/* The swatch paints the ACTUAL preset over the room's own
                      base, so what you see is what the room becomes. */}
                  <span
                    aria-hidden="true"
                    className="relative block h-10 w-full overflow-hidden rounded-lg border border-hairline bg-base"
                    style={preview ? { backgroundImage: preview } : undefined}
                  >
                    {active && (
                      <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-gold-400 text-ink-950">
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "truncate text-[11px] font-medium",
                      active ? "text-gold-200" : "text-content-muted"
                    )}
                  >
                    {bg.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export { chatBackgroundById };
