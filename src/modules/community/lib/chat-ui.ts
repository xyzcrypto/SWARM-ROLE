/**
 * Shared chrome for the two chat surfaces (the community room and DMs), so a
 * header button in one is the same control in the other. Client-safe: class
 * strings only.
 */

/**
 * Every icon button in a chat header: a 40px target with a quiet resting state
 * that lights on hover, press and while its menu is open (`aria-expanded`).
 * The room's header used three different styles side by side - a bordered
 * square, a filled pill and a bare icon - which is most of why it looked
 * misaligned.
 */
export const CHAT_ICON_BTN =
  "grid h-10 w-10 shrink-0 place-items-center rounded-xl text-zinc-400 transition-[background-color,color,transform] duration-150 hover:bg-white/[0.07] hover:text-zinc-100 active:scale-95 aria-expanded:bg-white/[0.07] aria-expanded:text-zinc-100 aria-pressed:text-mint-300";

/** The bar behind a chat header or composer: solid enough to read, lets the wallpaper breathe. */
export const CHAT_BAR = "bg-ink-900/90 backdrop-blur-md";
