"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Ban, Check, CheckCheck, ChevronDown, ChevronUp, Copy, CornerUpLeft as Reply, Flag, Forward, Languages, Loader2, MessageSquare, MoreVertical, PenSquare, Pencil, Palette, Pin, PinOff, Search, ShieldOff, Sticker, Trash2, UserRound, X, ImagePlus, Smile } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { SendGlyph } from "@/components/SendGlyph";
import { EmojiPicker } from "@/components/EmojiPicker";
import { GifPicker } from "@/components/GifPicker";
import { timeAgo } from "@/lib/news";
import { useRealtime } from "@/lib/useRealtime";
import { useOnlineSet } from "@/lib/useUserOnline";
import { chatMediaUrl } from "@/lib/chat-media";
import { ImageLightbox } from "@/components/ImageLightbox";
import { NewsAlertsToggle } from "@/components/NewsAlertsToggle";
import { clockTime, dayLabel, isReadBy, newestRead } from "@/lib/chat-time";
import { canEditMessage } from "@/lib/chat-view";
import { lastSeenLabel } from "@/lib/last-seen";
import { useHydrated, useMediaQuery } from "@/lib/useClientFlag";
import { useAutoGrow } from "@shared/hooks/useAutoGrow";
import { DM_REACTIONS, type DmReaction, type DmReactions } from "@modules/messages/lib/dm-reactions";
import { AttachTray } from "@modules/community/components/AttachTray";
import { SwipeBubble } from "@modules/community/components/SwipeBubble";
import { CHAT_BAR, CHAT_ICON_BTN } from "@modules/community/lib/chat-ui";
import { AppMenu } from "@shared/components/AppMenu";
import { hapticTap, hapticToggle } from "@shared/utils/haptics";
import { useChatAppearance } from "@modules/community/components/useChatAppearance";
import { ChatWallpaper } from "@modules/community/components/ChatWallpaper";
import { ChatAppearanceSheet } from "@modules/community/components/ChatAppearanceSheet";
import { compressImage } from "@/lib/image";
import { cn } from "@/lib/utils";
import { MicButton } from "@/shared/components/MicButton";
import { MessageText } from "@shared/components/MessageText";
import { placeMenu, type MenuBox } from "@shared/utils/menu-placement";

type Other = { id?: string; name: string; username: string | null; image: string | null; lastSeenAt?: string | null } | null;
type Conversation = { id: string; other: Other; lastBody: string; lastMessageAt: string; unread: boolean; lastMine?: boolean; otherReadAt?: string | null; pinned?: boolean };
type Msg = {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
  /** Soft-deleted: the row stays so the thread keeps its shape. Body is "". */
  deleted?: boolean;
  editedAt?: string | null;
  pinned?: boolean;
  /** Marked forwarded. A flag only - never a link back to the original thread. */
  forwarded?: boolean;
  /** The quoted parent, when this is a reply. Always from THIS conversation. */
  replyTo?: { id: string; body: string; deleted: boolean; mine: boolean } | null;
  /** My reaction and theirs - one each, see `reactionA`/`reactionB`. */
  reactions?: DmReactions | null;
};
type Pinned = { id: string; body: string; mine: boolean } | null;
type Found = { id: string; name: string | null; username: string | null; image: string | null };

const THREAD_POLL_MS = 5000;

/**
 * Delivery state on your own messages. Three honest states and no more:
 *
 *  - `pending`  a single faint tick while the optimistic copy is in flight
 *  - sent       a single tick once the server has it
 *  - read       two mint ticks once the other side has opened the thread
 *
 * There is deliberately no "delivered" state between sent and read. WhatsApp
 * has one because its server knows when a device received the message; we have
 * no such signal, and inventing one from "are they online right now" would be a
 * guess dressed as a fact.
 *
 * Mint rather than the familiar blue: the palette here is gold for brand and
 * mint for positive, and read is the positive outcome. A new colour would be
 * the one thing the design system asks not to add.
 */
/** ~6 lines, then the composer scrolls inside itself. Same as the room. */
const DM_COMPOSER_MAX_H = 148;

function ReadTicks({ read, pending }: { read: boolean; pending?: boolean }) {
  const label = pending ? "Sending" : read ? "Read" : "Sent";
  const Icon = read ? CheckCheck : Check;
  return (
    <Icon
      aria-label={label}
      className={cn(
        "h-3.5 w-3.5 shrink-0 transition-colors",
        pending ? "text-gold-700/40 dark:text-gold-200/30" : read ? "text-mint-500 dark:text-mint-300" : "text-gold-700/70 dark:text-gold-200/60"
      )}
    />
  );
}

/**
 * What a conversation row says it was about. A photo is sent as a bare media
 * URL, so without this the inbox showed the raw link - a wall of storage URL
 * where every other messenger shows two words.
 */
function inboxPreview(lastBody: string): string {
  if (!lastBody) return "New conversation";
  return chatMediaUrl(lastBody) ? "\u{1F4F7} Photo" : lastBody;
}

/**
 * Do two payloads of the same length render identically?
 *
 * Only the fields that actually reach the screen, and only the ones a refetch
 * can change in place: a delete blanks `body` and sets `deleted`, an edit
 * changes `body` and `editedAt`, a pin flips `pinned`. `createdAt`, `mine` and
 * `forwarded` are fixed at insert, so comparing them would cost time and never
 * differ.
 *
 * Exists so the silent-refetch shortcut can skip an identical payload without
 * also skipping an in-place change - which is what a length check did.
 */
function sameThread(a: Msg[], b: Msg[]): boolean {
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.body !== y.body ||
      !!x.deleted !== !!y.deleted ||
      !!x.pinned !== !!y.pinned ||
      (x.editedAt ?? null) !== (y.editedAt ?? null) ||
      // A reaction changes in place too - without this the other side's
      // reaction would never show until something else in the thread moved.
      (x.reactions?.mine ?? null) !== (y.reactions?.mine ?? null) ||
      (x.reactions?.theirs ?? null) !== (y.reactions?.theirs ?? null)
    ) {
      return false;
    }
  }
  return true;
}

/** Menu width in px. Also fed to `placeMenu`, so the two can never disagree.
 *  Wide enough for the six-reaction row at the top of the menu. */
const MENU_WIDTH = 232;
/** Where a conversation's unsent draft is kept, per device. */
const DRAFT_KEY = (conversationId: string) => `xyz.dm.draft.${conversationId}`;
const DRAFT_EVENT = "xyz-dm-draft";

/**
 * The per-message action trigger and its menu.
 *
 * Two things it does deliberately differently from a naive dropdown:
 *
 * - **It lives outside the bubble.** An overlay button on top of the text
 *   covers the message you are trying to act on, and on a narrow phone that is
 *   most of it. Sitting alongside costs a few pixels of width and nothing else.
 * - **It is always in the DOM, only faded.** Revealing on hover alone means it
 *   does not exist on a touch device, which is where most of these messages are
 *   read. `group-hover` raises the opacity on a mouse; a finger just taps it.
 */
/**
 * The DM composer, as its own component - PR 3.
 *
 * ⚠️ The draft lives HERE, not in `Thread`, and that is the whole point. While
 * it lived in `Thread`, every keystroke re-rendered every message in the
 * conversation: measured at 100ms of main-thread work per key in a
 * 150-message thread on desktop, 400ms+ with the CPU throttled to a mid-range
 * phone. Typing now re-renders only this component.
 *
 * `onSend` resolves whether the server accepted the message. The draft is
 * cleared optimistically and given back on failure - unless the member has
 * already started typing something new, which is never overwritten.
 */
function DmComposer({
  onSend,
  sending,
  touchUi,
  invalid,
  draftKey,
  focusTick,
}: {
  onSend: (body: string) => Promise<boolean>;
  sending: boolean;
  touchUi: boolean;
  invalid: boolean;
  /** The conversation id: an unsent draft survives leaving and coming back. */
  draftKey: string;
  /** Bumped by the thread to put the caret here (swipe-to-reply, Reply). */
  focusTick: number;
}) {
  const [draft, setDraft] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  useAutoGrow(composerRef, DM_COMPOSER_MAX_H, [draft, touchUi]);

  // Drafts, per conversation and per device - what every messenger does, and
  // the inbox marks the row "Draft" so it is findable again. Read AFTER mount,
  // never during render: this component is server-rendered for a `?c=` link,
  // and localStorage on the client's first render would be a hydration
  // mismatch (CLAUDE.md, #418). Deferred a tick so the effect only schedules.
  const loadedKey = useRef<string | null>(null);
  useEffect(() => {
    let live = true;
    void Promise.resolve().then(() => {
      if (!live) return;
      let saved = "";
      try { saved = localStorage.getItem(DRAFT_KEY(draftKey)) ?? ""; } catch { /* storage blocked */ }
      loadedKey.current = draftKey;
      if (saved) setDraft((d) => d || saved);
    });
    return () => { live = false; };
  }, [draftKey]);
  useEffect(() => {
    if (loadedKey.current !== draftKey) return; // do not clobber before the read
    const t = window.setTimeout(() => {
      try {
        if (draft.trim()) localStorage.setItem(DRAFT_KEY(draftKey), draft);
        else localStorage.removeItem(DRAFT_KEY(draftKey));
        window.dispatchEvent(new Event(DRAFT_EVENT));
      } catch { /* storage blocked - drafts are a convenience */ }
    }, 250);
    return () => window.clearTimeout(t);
  }, [draft, draftKey]);

  useEffect(() => {
    if (!focusTick) return;
    const el = composerRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [focusTick]);
  // Mirror of `draft` for the dictation auto-send path - see the MicButton
  // below for why an effect alone is not enough. This effect covers every
  // other way the composer changes; the mic handler writes it synchronously.
  const draftRef = useRef("");
  useEffect(() => { draftRef.current = draft; }, [draft]);

  const send = async (raw: string) => {
    const body = raw.trim();
    if (!body || sending) return;
    setDraft("");
    draftRef.current = "";
    const ok = await onSend(body);
    if (!ok) setDraft((d) => (d.trim() ? d : body));
  };

  return (
    <>
      <div className="relative flex-1">
        <textarea
          ref={composerRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !touchUi) { e.preventDefault(); void send(draft); } }}
          placeholder={touchUi ? "Write a message…" : "Write a message… (Enter to send)"}
          aria-label="Write a message"
          aria-invalid={invalid || undefined}
          rows={1}
          maxLength={2000}
          // Identical to the room's composer. `text-base` below `sm` is
          // load-bearing: iOS zooms the page into any input under 16px.
          className="block min-h-[44px] w-full resize-none rounded-[22px] border border-white/10 bg-ink-950/60 px-4 py-2.5 pr-20 text-base leading-relaxed text-zinc-100 outline-none transition-[border-color,box-shadow] placeholder:text-zinc-600 focus:border-mint-500/50 focus:ring-2 focus:ring-mint-500/20 sm:text-sm"
        />
        <button type="button" onClick={() => setPickerOpen((v) => !v)} className="absolute bottom-0 right-0 grid h-11 w-10 place-items-center text-zinc-500 transition-colors hover:text-gold-200" aria-label="Emoji" aria-expanded={pickerOpen}>
          <Smile className="h-5 w-5" />
        </button>
        {/* Dictation now sends when you stop talking.
            `draftRef` is not optional here. `onEnd` fires from a recognizer
            callback that can run in the SAME task as the last `onresult`,
            before React has committed - so reading `draft` there would send
            the composer's contents from before the transcript landed, i.e.
            an empty string on a single-utterance dictation. The ref is
            written synchronously below and re-synced by an effect for every
            other path into the composer (typing, emoji, a cleared draft).
            Same reasoning, same shape as the XYZ AI panel.

            Tapping the mic again mid-sentence still just stops and leaves
            the text to edit: `toggle()` calls `stop()`, which finalises,
            and `onEnd` then sends what was finalised. Discarding is
            `cancel()`, which suppresses `onEnd` entirely. */}
        <MicButton
          continuous
          size="sm"
          className="absolute bottom-1.5 right-10 !ring-0"
          onText={(t) => {
            const next = (draftRef.current ? `${draftRef.current} ${t}` : t).slice(0, 2000);
            draftRef.current = next;
            setDraft(next);
          }}
          onEnd={() => {
            const text = draftRef.current.trim();
            if (text && !sending) void send(text);
          }}
        />
        <AnimatePresence>{pickerOpen && <EmojiPicker onPick={(e) => setDraft((b) => (b + e).slice(0, 2000))} onClose={() => setPickerOpen(false)} />}</AnimatePresence>
      </div>
      {/* The room's send button, including the press. `whileTap` is a
          constant, not derived from a client-only signal, so it renders
          the same attributes on the server and the client. */}
      <motion.button
        type="button"
        onClick={() => void send(draft)}
        disabled={!draft.trim() || sending}
        whileTap={{ scale: 0.9 }}
        aria-label="Send message"
        className="btn-primary grid h-11 w-11 shrink-0 place-items-center !rounded-full !p-0 disabled:opacity-50"
      >
        {sending ? <Loader2 className="relative z-10 h-[18px] w-[18px] animate-spin !text-white" /> : <SendGlyph className="relative z-10 h-4 w-4" />}
        
      </motion.button>
    </>
  );
}

function MessageActions({
  open,
  onToggle,
  side,
  top,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  side: "left" | "right";
  /** Rendered above the actions - the reaction row. */
  top?: React.ReactNode;
  children: React.ReactNode;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [box, setBox] = useState<MenuBox | null>(null);
  // Portals need a DOM target, so nothing is portalled until after hydration.
  const mounted = useHydrated();

  // Measured in an effect, never during render - the viewport is a client-only
  // signal, and this project's worst bug was a client-only signal reaching the
  // DOM on the first render (see CLAUDE.md).
  useEffect(() => {
    if (!open) {
      setBox(null);
      return;
    }
    const place = () => {
      const el = btnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setBox(placeMenu(r, window.innerWidth, window.innerHeight, { width: MENU_WIDTH, align: side === "left" ? "right" : "left" }));
    };
    place();
    // The trigger moves with the thread, so the menu has to follow it. `true`
    // catches scrolling on the message list itself, not just the window.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, side]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={onToggle}
        aria-label="Message actions"
        aria-expanded={open}
        className={cn(
          // `opacity-40` is a hover affordance and there is no hover on a phone,
          // so touch gets the trigger at full strength - it is the only way in
          // to Reply, and a 40%-opacity dot does not read as a button.
          // 44px on touch - it is the only way in to Reply, Forward and Delete,
          // and a 28px target next to a message bubble is a mis-tap waiting
          // to happen. Expressed as a media query, not a hook: nothing to
          // hydrate, nothing to mismatch.
          "grid h-7 w-7 shrink-0 place-items-center rounded-full text-zinc-500 transition-opacity hover:bg-white/5 hover:text-zinc-200 [@media(hover:none)]:h-11 [@media(hover:none)]:w-11",
          // On touch, long-press on the bubble is the primary way in now, so
          // the dots step back visually - the 44px target stays for anyone
          // who looks for a button (and for screen readers).
          open ? "opacity-100" : "opacity-100 sm:opacity-40 sm:group-hover:opacity-100 [@media(hover:none)]:opacity-30"
        )}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {mounted &&
        open &&
        box &&
        createPortal(
          <>
            {/* A full-screen catcher, so tapping anywhere closes the menu without
                every parent needing an outside-click listener. */}
            <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-[80] cursor-default" onClick={onToggle} />
            {/* Portalled to <body> and positioned from the trigger's viewport
                rect. It used to be `absolute bottom-full` on the message row,
                which is the right look but is clipped by the message list's
                `overflow-y-auto`: on a phone, opening it on a message near the
                top of the thread cut off the menu starting with Reply. `fixed`
                alone would not have been enough either - the panel's
                backdrop-filter re-establishes the containing block - hence the
                portal. `placeMenu` picks the side with room and caps the height,
                so the menu is always fully on screen. */}
            <div
              role="menu"
              style={{ top: box.top, bottom: box.bottom, left: box.left, maxHeight: box.maxHeight, width: MENU_WIDTH }}
              className="app-fade-in fixed z-[81] overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-ink-900 py-1 shadow-elevate"
            >
              {top}
              {children}
            </div>
          </>,
          document.body
        )}
    </>
  );
}

function ActionItem({
  icon: Icon,
  label,
  onClick,
  disabled,
  destructive,
}: {
  icon: typeof Copy;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        // min-h-10 so every row is a comfortable thumb target, not a 34px strip
        // where Reply and Forward are one mis-tap apart.
        "flex min-h-10 w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-35",
        destructive ? "text-red-300 hover:bg-red-500/10" : "text-zinc-300 hover:bg-white/5 hover:text-zinc-100"
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {label}
    </button>
  );
}

/**
 * The reactions under a bubble. Theirs and mine side by side; when both picked
 * the same one it reads as that emoji with a 2. Tapping takes MY reaction off
 * (the only part of it that is mine to change).
 */
function ReactionPill({ reactions, onRemoveMine, mine }: { reactions: DmReactions; onRemoveMine?: () => void; mine: boolean }) {
  const { mine: a, theirs: b } = reactions;
  const same = a && b && a === b;
  const label = [b && `They reacted ${b}`, a && `You reacted ${a}`].filter(Boolean).join(", ");
  return (
    <button
      type="button"
      onClick={onRemoveMine}
      disabled={!onRemoveMine}
      aria-label={onRemoveMine ? `${label}. Tap to remove yours.` : label}
      title={onRemoveMine ? "Tap to remove your reaction" : undefined}
      className={cn(
        "reaction-pop relative z-[2] -mt-2 inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-ink-900 px-1.5 py-0.5 text-[14px] leading-none shadow-md shadow-black/40 disabled:cursor-default",
        mine ? "mr-2" : "ml-2"
      )}
    >
      {same ? (
        <>
          <span>{a}</span>
          <span className="mono text-[10px] text-zinc-400">2</span>
        </>
      ) : (
        <>
          {b && <span>{b}</span>}
          {a && <span className="rounded-full bg-gold-500/15 px-0.5">{a}</span>}
        </>
      )}
    </button>
  );
}

/**
 * A plain confirm step, for actions that are hard to take back by accident.
 * Portalled (the thread is `overflow-hidden`), Escape cancels, focus starts on
 * Cancel - the safe choice is the default one.
 */
function ConfirmDialog({
  title,
  body,
  confirmLabel,
  destructive,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] grid place-items-end sm:place-items-center" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
      <button type="button" aria-label="Cancel" tabIndex={-1} onClick={onCancel} className="app-fade-in absolute inset-0 cursor-default bg-black/60 backdrop-blur-[2px]" />
      <div className="app-fade-in relative m-0 w-full max-w-sm rounded-t-3xl border border-white/10 bg-ink-900 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:m-4 sm:rounded-3xl sm:pb-5">
        <h2 id="confirm-title" className="text-[16px] font-semibold text-zinc-100">{title}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">{body}</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button ref={cancelRef} type="button" onClick={onCancel} className="btn-ghost !py-2.5 text-[14px]">Cancel</button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              "rounded-xl px-4 py-2.5 text-[14px] font-semibold transition-colors",
              destructive ? "bg-red-500/90 text-white hover:bg-red-500" : "btn-primary"
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function OnlineDot({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-mint-500 dark:border-ink-900" aria-label="Online" />;
}

// Telegram-style DM surface: inbox (with people search) on the left, the open
// thread on the right. On mobile it's one pane at a time.
export function MessagesClient({ meId, gifEnabled = false }: { meId: string; gifEnabled?: boolean }) {
  const router = useRouter();
  const search = useSearchParams();
  const activeId = search.get("c");
  const onlineSet = useOnlineSet();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [inboxLoaded, setInboxLoaded] = useState(false);
  const [now, setNow] = useState(0);

  // People search (start a new DM).
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Found[]>([]);
  const [searching, setSearching] = useState(false);
  const [starting, setStarting] = useState(false);
  /** Why starting a conversation failed. The Thread component has its own
   *  `err`; this is the inbox side, which had no way to say anything at all. */
  const [startErr, setStartErr] = useState<string | null>(null);
  const [convMenuId, setConvMenuId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread" | "pinned">("all");
  const searchRef = useRef<HTMLInputElement>(null);

  // Unsent drafts, per conversation, from this device - so a row can say
  // "Draft: ..." the way every messenger does. Read after mount (localStorage
  // is client-only; reading it during render would be a hydration mismatch)
  // and again whenever a composer saves one.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  useEffect(() => {
    let live = true;
    const read = () => {
      const next: Record<string, string> = {};
      try {
        const prefix = DRAFT_KEY("");
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k?.startsWith(prefix)) next[k.slice(prefix.length)] = localStorage.getItem(k) ?? "";
        }
      } catch { /* storage blocked */ }
      if (live) setDrafts(next);
    };
    void Promise.resolve().then(read);
    window.addEventListener(DRAFT_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      live = false;
      window.removeEventListener(DRAFT_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => { if (!document.hidden) setNow(Date.now()); }, 30000);
    return () => clearInterval(t);
  }, []);

  // Failures propagate on purpose. useRealtime retries a rejected load with
  // backoff; swallowing the error here made a failed request look identical to
  // a successful one, so the inbox would sit on stale data - or none at all -
  // until the user reloaded. That is the "DM kabhi kabhi nahi khulta" report.
  const loadInbox = useCallback(async () => {
    try {
      const r = await fetch("/api/dm", { cache: "no-store" });
      if (!r.ok) throw new Error(`inbox ${r.status}`);
      const j = await r.json();
      if (j?.conversations) setConversations(j.conversations);
    } finally {
      setInboxLoaded(true);
    }
  }, []);

  useEffect(() => { loadInbox(); }, [loadInbox]);
  useRealtime({ channel: `user:${meId}`, event: "dm_message", onMessage: loadInbox, pollMs: 10000 });

  // Debounced people search.
  useEffect(() => {
    const term = q.trim();
    if (!term) { setResults([]); setSearching(false); return; }
    setSearching(true);
    // ⚠️ The same race that was fixed in the markets search in #316, in a
    // second place: the cleanup cancelled the TIMER but never the REQUEST, and
    // nothing guarded the response. So of two searches in flight the SLOWER one
    // won - type "ali", pause, type "alice", and the results for "ali" could
    // land last and stay on screen under the newer query.
    //
    // The stale `.finally` was the other half: it flipped `searching` off while
    // the newer request was still running, so the empty state could flash
    // "no one found" mid-typing.
    let active = true;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/dm/search?q=${encodeURIComponent(term)}`, { cache: "no-store", signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (active) setResults(Array.isArray(j?.users) ? j.users : []); })
        .catch(() => { if (active) setResults([]); })
        .finally(() => { if (active) setSearching(false); });
    }, 300);
    return () => { active = false; ctrl.abort(); clearTimeout(t); };
  }, [q]);

  const openConversation = (id: string) => router.replace(`/messages?c=${id}`, { scroll: false });
  const closeThread = () => router.replace("/messages", { scroll: false });

  const startDm = async (username: string) => {
    if (starting) return;
    setStarting(true);
    setStartErr(null);
    try {
      const r = await fetch("/api/dm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username }) });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.conversationId) {
        setQ("");
        setResults([]);
        loadInbox();
        openConversation(j.conversationId);
        return;
      }
      // ⚠️ This used to be `r.ok ? await r.json() : null` followed by
      // `catch { /* ignore */ }`, so EVERY failure was silent: tapping
      // "Message" simply did nothing.
      //
      // And the failures here are the ones a reader most needs explained -
      // `canStartConversation` returns 403 when the other member's DM privacy
      // is "nobody" or "people I follow", or when either side has blocked the
      // other. "Nothing happened" is the worst possible way to say that.
      setStartErr(j?.error ?? "Couldn't start that conversation.");
    } catch {
      setStartErr("Couldn't start that conversation. Check your connection.");
    } finally {
      setStarting(false);
    }
  };

  const pinConversation = async (convId: string, pinned: boolean) => {
    setConvMenuId(null);
    setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, pinned } : c)));
    await fetch(`/api/dm/${convId}/pin`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned }),
    }).catch(() => null);
    void loadInbox();
  };

  const removeConversation = async (convId: string) => {
    setConvMenuId(null);
    setConversations((prev) => prev.filter((c) => c.id !== convId));
    if (activeId === convId) closeThread();
    await fetch(`/api/dm/${convId}/hide`, { method: "DELETE" }).catch(() => null);
  };

  const unreadCount = conversations.filter((c) => c.unread).length;
  const pinnedCount = conversations.filter((c) => c.pinned).length;
  const shown = [...conversations]
    .filter((c) => (filter === "unread" ? c.unread : filter === "pinned" ? c.pinned : true))
    .sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1));

  return (
    // Edge to edge on a phone (the page is the app); a framed two-pane app from
    // `sm` up. The inbox pane widens on large screens so names do not truncate.
    <div className="glass grid min-h-0 flex-1 grid-cols-1 overflow-hidden max-sm:rounded-none max-sm:border-0 sm:rounded-3xl md:grid-cols-[minmax(0,340px)_1fr] xl:grid-cols-[380px_1fr]">
      {/* Inbox */}
      <aside className={cn("min-h-0 flex-col border-hairline md:border-r", activeId ? "hidden md:flex" : "flex")}>
        <header className={cn("flex items-center gap-2 border-b border-hairline px-2 py-2 sm:px-3", CHAT_BAR)}>
          {/* The whole site navigation, now that this page has no site header. */}
          <AppMenu />
          <h1 className="ml-1 flex min-w-0 flex-1 items-center gap-2 font-display text-[19px] font-semibold tracking-tight text-zinc-100">
            Messages
            {unreadCount > 0 && (
              <span className="mono rounded-full bg-gold-500/20 px-2 py-0.5 text-[11px] font-semibold text-gold-200" aria-label={`${unreadCount} unread`}>
                {unreadCount}
              </span>
            )}
          </h1>
          {/* The reason DMs "didn't notify": nothing here ever asked.
              Web Push is per-device and opt-in, and the only two places to
              turn it on were the News page and the community lounge. The
              sending half has always been complete - /api/dm/[id] pushes to
              the recipient's devices and deep-links to this thread - but a
              member who lives in their inbox was never subscribed, so there
              was no device to push to. Same component the lounge uses, so
              one grant covers both. */}
          <NewsAlertsToggle loggedIn compact title="Get a phone notification when someone messages you" />
          <button
            type="button"
            onClick={() => { searchRef.current?.focus(); hapticTap(); }}
            aria-label="New message"
            title="New message"
            className={CHAT_ICON_BTN}
          >
            <PenSquare className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>
        </header>
        {/* Search people */}
        <div className="px-3 pb-2 pt-3">
          <div className="flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-ink-950/50 px-3 transition-colors focus-within:border-gold-500/40">
            <Search className="h-4 w-4 shrink-0 text-zinc-500" />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search people to message…"
              aria-label="Search people to message"
              className="w-full bg-transparent text-base text-zinc-100 outline-none placeholder:text-zinc-600 sm:text-[14px]"
            />
            {q && <button onClick={() => setQ("")} aria-label="Clear" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-zinc-500 hover:text-zinc-200"><X className="h-4 w-4" /></button>}
          </div>
          {/* Why "Message" did nothing. The server's own words when it has them
              - a DM privacy setting or a block is the usual reason, and neither
              is something the reader can guess from silence. */}
          {startErr && <p className="mt-1.5 px-1 text-[11px] text-amber-500">{startErr}</p>}
          {!q.trim() && conversations.length > 0 && (
            <div className="mt-3 flex gap-1.5" role="tablist" aria-label="Filter conversations">
              {([
                ["all", "All", conversations.length],
                ["unread", "Unread", unreadCount],
                ["pinned", "Pinned", pinnedCount],
              ] as const).map(([key, label, n]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={filter === key}
                  onClick={() => setFilter(key)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition-colors",
                    filter === key ? "bg-gold-500/15 text-gold-100 ring-1 ring-gold-500/35" : "bg-white/[0.04] text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  {label}
                  {n > 0 && key !== "all" && <span className="mono text-[10px] opacity-70">{n}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-2">
          {q.trim() ? (
            searching ? (
              <p className="py-8 text-center text-sm text-zinc-500"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Searching…</p>
            ) : results.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">No members found.</p>
            ) : (
              <ul>
                {results.map((u) => (
                  <li key={u.id}>
                    <button onClick={() => u.username && startDm(u.username)} disabled={starting} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05] disabled:opacity-60">
                      <span className="relative shrink-0"><Avatar name={u.name} image={u.image} size="md" /><OnlineDot show={onlineSet.has(u.id)} /></span>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium text-zinc-100">{u.name ?? `@${u.username}`}</span>
                        <span className="mono block truncate text-[11px] text-zinc-500">@{u.username}</span>
                      </div>
                      <MessageSquare className="h-4 w-4 shrink-0 text-gold-400/60" />
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : !inboxLoaded ? (
            <p className="py-10 text-center text-sm text-zinc-500"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Loading…</p>
          ) : conversations.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gold-500/10 ring-1 ring-gold-500/25">
                <MessageSquare className="h-6 w-6 text-gold-300" />
              </span>
              <p className="mt-4 text-[15px] font-semibold text-zinc-200">No conversations yet</p>
              <p className="mt-1 text-[13px] text-zinc-500">Search a member above to start chatting.</p>
            </div>
          ) : shown.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-zinc-500">
              {filter === "unread" ? "You're all caught up." : "No pinned conversations."}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {shown.map((c) => {
                const draft = activeId === c.id ? "" : (drafts[c.id] ?? "").trim();
                return (
                <li key={c.id} className="group relative">
                  <div className={cn("flex items-center rounded-2xl transition-colors hover:bg-white/[0.04]", activeId === c.id && "bg-white/[0.07] ring-1 ring-white/10", convMenuId === c.id && "bg-white/[0.04]")}>
                    <button onClick={() => openConversation(c.id)} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left">
                      <span className="relative shrink-0"><Avatar name={c.other?.name} image={c.other?.image} size="md" /><OnlineDot show={!!c.other?.id && onlineSet.has(c.other.id)} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn("flex min-w-0 items-center gap-1 truncate text-[15px] text-zinc-100", c.unread ? "font-semibold" : "font-medium")}>
                            {c.pinned && <Pin className="h-3 w-3 shrink-0 text-gold-400/70" aria-label="Pinned" />}
                            {c.other?.name ?? "Member"}
                          </span>
                          {now > 0 && <span className={cn("mono ml-auto shrink-0 text-[11px]", c.unread ? "text-gold-300" : "text-zinc-600")}>{timeAgo(new Date(c.lastMessageAt).getTime(), now)}</span>}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          {draft ? (
                            <span className="truncate text-[13px]"><span className="font-semibold text-amber-400">Draft:</span> <span className="text-zinc-400">{draft}</span></span>
                          ) : (
                            <>
                              {c.lastMine && <ReadTicks read={isReadBy(c.lastMessageAt, c.otherReadAt)} />}
                              <span className={cn("truncate text-[13px]", c.unread ? "font-medium text-zinc-200" : "text-zinc-500")}>{inboxPreview(c.lastBody)}</span>
                            </>
                          )}
                          {c.unread && <span className="ml-auto h-2.5 w-2.5 shrink-0 rounded-full bg-gold-400 shadow-[0_0_8px_rgba(233,184,76,0.6)]" aria-label="Unread" />}
                        </div>
                      </div>
                    </button>
                    {/* Per-conversation context menu: pin / remove */}
                    <div className="relative mr-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setConvMenuId((x) => (x === c.id ? null : c.id)); }}
                        // Named per person: every row's button used to share the
                        // thread header's "Conversation options" label, so a
                        // screen reader heard the same name N+1 times.
                        aria-label={`Options for ${c.other?.name ?? "this conversation"}`}
                        aria-expanded={convMenuId === c.id}
                        /* Pin and remove live behind this button, and it used to be
                           `opacity-0` with only a `group-hover:` reveal - so on a
                           phone, where nothing ever hovers, the only way to reach
                           either action was invisible. Always shown below `sm`,
                           revealed on hover above it. */
                        className="grid h-9 w-9 place-items-center rounded-full text-zinc-500 opacity-100 transition-opacity hover:bg-white/5 hover:text-zinc-300 sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {convMenuId === c.id && (
                        <>
                          <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={() => setConvMenuId(null)} />
                          <div className="app-fade-in absolute right-0 top-10 z-50 w-44 overflow-hidden rounded-2xl border border-white/10 bg-ink-900 py-1 shadow-elevate">
                            <ActionItem
                              icon={c.pinned ? PinOff : Pin}
                              label={c.pinned ? "Unpin" : "Pin"}
                              onClick={() => void pinConversation(c.id, !c.pinned)}
                            />
                            <ActionItem
                              icon={Trash2}
                              label="Remove"
                              destructive
                              onClick={() => void removeConversation(c.id)}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Thread */}
      <section className={cn("min-h-0", activeId ? "flex" : "hidden md:flex")}>
        {activeId ? (
          <Thread key={activeId} id={activeId} meId={meId} now={now} gifEnabled={gifEnabled} onlineSet={onlineSet}
              conversations={conversations} onBack={closeThread} onSent={loadInbox} />
        ) : (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div>
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-gold-500/10 ring-1 ring-gold-500/25">
                <MessageSquare className="h-7 w-7 text-gold-300" />
              </span>
              <p className="mt-4 text-[16px] font-semibold text-zinc-200">Your messages</p>
              <p className="mt-1 text-[13px] text-zinc-500">Pick a conversation, or search a member to start one.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Thread({ id, meId, now, gifEnabled, onlineSet, conversations, onBack, onSent }: { id: string; meId: string; now: number; gifEnabled: boolean; onlineSet: Set<string>; conversations: Conversation[]; onBack: () => void; onSent: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [other, setOther] = useState<Other>(null);
  const [loaded, setLoaded] = useState(false);
  // When the other side last opened this thread. Everything I sent before it
  // has been read - that is the whole receipt calculation.
  const [otherReadAt, setOtherReadAt] = useState<string | null>(null);
  const [pinned, setPinned] = useState<Pinned>(null);
  // Whether this thread is closed, and whether it was me who closed it - the
  // two need different words and different buttons.
  const [blocked, setBlocked] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [threadMenu, setThreadMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [actionOpenId, setActionOpenId] = useState<string | null>(null);
  /** The message being replied to, shown above the composer until sent or cleared. */
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  /** The message queued for forwarding; picking a conversation sends it there. */
  const [forwarding, setForwarding] = useState<Msg | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  // Cached per message so tapping Translate again just hides it rather than
  // spending another AI call on an answer we already have.
  const [translations, setTranslations] = useState<Record<string, { text?: string; loading?: boolean; shown?: boolean }>>({});
  // Day separators and clock times must read in the viewer's timezone, but only
  // once hydrated - see chat-time.
  const hydrated = useHydrated();
  /**
   * A phone keyboard has no Shift key. With Enter always sending - which is
   * what this composer did - a member on a phone could not type a line break
   * at all. Touch: Enter is a newline and the send button sends. Desktop keeps
   * Enter-to-send / Shift+Enter, the convention the Community room already
   * uses. `useMediaQuery` carries a server snapshot, so this cannot cause a
   * hydration mismatch.
   */
  const touchUi = useMediaQuery("(hover: none)");

  /**
   * The same appearance as the Community room - one stored choice, so a member
   * who picked a background or their own photo sees it in both places. The
   * wallpaper and the sheet are the room's own components, not copies.
   */
  const appearance = useChatAppearance();
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  // The sheet shows theme-specific numbers (the dim floor, the contrast), so
  // it needs to know the theme. The wallpaper itself does not - it is chosen by
  // CSS. Read in an effect: the `dark` class is invisible to the server render.
  const [themeIsDark, setThemeIsDark] = useState(true);
  useEffect(() => {
    const html = document.documentElement;
    const read = () => setThemeIsDark(html.classList.contains("dark"));
    read();
    const obs = new MutationObserver(read);
    obs.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  const [sending, setSending] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [matchIdx, setMatchIdx] = useState(-1);
  const [confirmBlock, setConfirmBlock] = useState(false);
  // Escape closes the conversation menu - a keyboard user had no way out of it
  // but to tab through every item.
  useEffect(() => {
    if (!threadMenu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setThreadMenu(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [threadMenu]);
  const [focusTick, setFocusTick] = useState(0);
  const [gifOpen, setGifOpen] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const otherOnline = !!other?.id && onlineSet.has(other.id);

  /**
   * Is the reader at (or near) the newest message?
   *
   * ⚠️ Nothing here tracked this, and `useEffect(scrollToEnd, [messages.length])`
   * therefore jumped the thread to the bottom on EVERY new message - including
   * one that arrived from the other side, or off the 5s poll, while you were
   * scrolled up reading older messages. Community chat has had a `stickToBottom`
   * guard for exactly this since it was built; DM never got one.
   *
   * 80px of slack so "as good as at the bottom" counts - a couple of pixels of
   * momentum scroll should not mean the thread stops following the conversation.
   *
   * State rather than a ref, deliberately: the "did this arrive while I was
   * reading history" decision is made during render, and a ref may not be read
   * or written there. It only changes when the reader crosses the boundary, so
   * it does not re-render per scroll event.
   */
  const [stick, setStick] = useState(true);
  const [hasNew, setHasNew] = useState(false);
  const atBottom = () => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  const onScroll = () => {
    const at = atBottom();
    setStick((s) => (s === at ? s : at));
    if (at) setHasNew(false);
  };
  const scrollToEnd = () => requestAnimationFrame(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setStick(true);
    setHasNew(false);
  });

  // Same rule as loadInbox: a failure must reach useRealtime so it can retry.
  const load = useCallback(async (silent: boolean) => {
    try {
      const r = await fetch(`/api/dm/${id}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`thread ${r.status}`);
      const j = await r.json();
      if (j) {
        setOther(j.other ?? null);
        // Never move a receipt backwards. A silent refetch can land after a
        // `dm_read` ping that already told us something newer, and ticks that
        // un-blue themselves look like a bug even when the data is merely late.
        setOtherReadAt((prev) => newestRead(prev, j.otherReadAt ?? null));
        setPinned(j.pinned ?? null);
        setBlocked(!!j.blocked);
        setBlockedByMe(!!j.blockedByMe);
        setMessages((prev) => {
          const next: Msg[] = Array.isArray(j.messages) ? j.messages : [];
          // ⚠️ This used to be `if (silent && next.length === prev.length) return prev`,
          // and that one line silently defeated three features.
          //
          // A DM delete is SOFT - the row stays as a tombstone - so the count
          // does not change. Neither does editing, nor pinning. Every silent
          // refetch (the 5s poll, and every `dm_message` realtime ping) threw
          // the fresh payload away and kept the stale one, so the other side's
          // delete, edit or pin never appeared until the thread was closed and
          // reopened. The very three things the message route broadcasts for.
          //
          // Comparing what actually renders instead of how many rows there are
          // keeps the original intent - don't re-render on an identical payload -
          // without being blind to in-place changes.
          if (silent && next.length === prev.length && sameThread(prev, next)) return prev;
          return next;
        });
      }
    } finally {
      if (!silent) { setLoaded(true); scrollToEnd(); }
    }
  }, [id]);

  useEffect(() => {
    setLoaded(false);
    setMessages([]);
    // Opening a conversation always starts at its newest message. Without
    // these two, scrolling up in one thread and then switching to another
    // carried "not following" across, so the new thread opened part-way up
    // with a "New messages" pill for messages that were simply its contents.
    setStick(true);
    setHasNew(false);
    setOtherReadAt(null);
    setPinned(null);
    setBlocked(false);
    setBlockedByMe(false);
    setThreadMenu(false);
    setReported(false);
    setActionOpenId(null);
    setEditingId(null);
    setTranslations({});
    load(false);
  }, [load]);
  useRealtime({ channel: `user:${meId}`, event: "dm_message", onMessage: () => load(true), pollMs: THREAD_POLL_MS });
  // The receipt half. Carries the timestamp, so the ticks turn without a
  // refetch - a thread GET returns up to 200 messages, which is a lot of
  // payload to move just to learn one date. Guarded by conversation id because
  // the channel is per-user and carries every conversation's pings.
  useRealtime({
    channel: `user:${meId}`,
    event: "dm_read",
    onMessage: (payload) => {
      const p = payload as { conversationId?: string; at?: string } | null;
      if (!p || p.conversationId !== id || !p.at) return;
      setOtherReadAt((prev) => newestRead(prev, p.at ?? null));
    },
    // No pollMs on purpose. With realtime configured this rides the existing
    // per-user channel; without it, `realtimeMode` returns "off" and receipts
    // simply come from `otherReadAt` on the next thread refetch, which the
    // dm_message poll above is already doing. Either way, no new requests.
    pollMs: 0,
  });
  // Follow the conversation only when the reader is already following it.
  //
  // The "did something arrive while I was reading history" decision is adjusted
  // during render (the pattern used by the news reader and the breaking hero)
  // rather than in an effect, so it never lags a frame behind the messages it
  // describes. The scroll itself is a DOM side effect and stays in an effect.
  const [prevLen, setPrevLen] = useState(messages.length);
  if (prevLen !== messages.length) {
    const grew = messages.length > prevLen;
    setPrevLen(messages.length);
    const last = messages[messages.length - 1];
    // Your own message always wins - sending is an explicit "take me there".
    if (grew && last?.mine) setStick(true);
    else if (grew && !stick) setHasNew(true);
  }
  // `stick` is in the deps on purpose: scrolling back down to the bottom
  // re-attaches the thread to the conversation, which is what every chat app
  // does. When it is already at the bottom this call is a no-op.
  useEffect(() => { if (stick) scrollToEnd(); }, [messages.length, stick]);

  /**
   * Forward the queued message into another conversation.
   *
   * Sends straight to that thread's own endpoint, which re-runs its block and
   * privacy gate. Forwarding must not become a way around a block, so the check
   * has to happen on the destination rather than here.
   */
  const doForward = async (targetId: string) => {
    const msg = forwarding;
    if (!msg) return;
    setForwarding(null);
    try {
      const r = await fetch(`/api/dm/${targetId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: msg.body, forwarded: true }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        setErr(j?.error ?? "Couldn't forward that message.");
        return;
      }
      // Forwarded into THIS thread: show it now rather than waiting for a poll.
      if (targetId === id) {
        const j = await r.json().catch(() => null);
        if (j?.message) setMessages((m) => (m.some((x) => x.id === j.message.id) ? m : [...m, j.message]));
      }
      onSent();
    } catch {
      setErr("Couldn't forward that message.");
    }
  };

  // Send any body (text, or a media URL). Optimistic + reconcile. Resolves
  // `true` once the server has it, so the composer - which owns the draft -
  // knows whether to give the text back.
  const postMessage = async (raw: string, opts?: { forwarded?: boolean }): Promise<boolean> => {
    const body = raw.trim();
    if (!body || sending) return false;
    setSending(true);
    setErr(null);
    // Captured before the optimistic row so a reply cleared mid-flight cannot
    // change what was actually sent.
    const parent = replyTo;
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setMessages((m) => [
      ...m,
      {
        id: tempId,
        body,
        createdAt: new Date().toISOString(),
        mine: true,
        forwarded: opts?.forwarded,
        replyTo: parent ? { id: parent.id, body: parent.body, deleted: !!parent.deleted, mine: parent.mine } : null,
      },
    ]);
    setReplyTo(null);
    try {
      const r = await fetch(`/api/dm/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, replyToId: parent?.id, forwarded: opts?.forwarded === true }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.message) {
        setMessages((m) => { const without = m.filter((x) => x.id !== tempId); return without.some((x) => x.id === j.message.id) ? without : [...without, j.message]; });
        onSent();
        return true;
      } else {
        setMessages((m) => m.filter((x) => x.id !== tempId));
        // The rollback was already correct; the silence was not. A send can fail
        // because the recipient blocked you, because their DM privacy changed
        // since the thread was opened, or because you hit the rate limit - and
        // all three looked identical: the message vanishes, the draft comes
        // back, nothing said why. The server has words for each of them.
        setErr(j?.error ?? "Couldn't send that message.");
        return false;
      }
    } catch {
      setMessages((m) => m.filter((x) => x.id !== tempId));
      setErr("Couldn't send that message. Check your connection.");
      return false;
    } finally { setSending(false); }
  };

  // --- Message actions -------------------------------------------------
  //
  // Every one of these reloads the thread rather than patching state by hand.
  // The endpoints already broadcast to the other side, and a silent reload is
  // one request against a conversation that is at most 200 messages - cheaper
  // than a second source of truth that can drift from the first.

  const messageUrl = (messageId: string) => `/api/dm/${id}/message/${messageId}`;

  async function saveEdit(messageId: string) {
    const body = editText.trim();
    if (!body) return;
    setEditingId(null);
    // Optimistic: the edit window is 15 minutes and the request is tiny, but
    // waiting for a round trip to see your own correction feels broken.
    setMessages((m) => m.map((x) => (x.id === messageId ? { ...x, body, editedAt: new Date().toISOString() } : x)));
    const r = await fetch(messageUrl(messageId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    }).catch(() => null);
    if (!r?.ok) {
      setErr("Could not save the edit.");
      void load(true);
    } else {
      onSent();
    }
  }

  /**
   * `scope: "me"` removes the message from my view only - the other side keeps
   * it and is not told. `scope: "everyone"` is the tombstone, and the server
   * only allows it on my own messages.
   */
  async function deleteMessage(messageId: string, scope: "me" | "everyone") {
    setActionOpenId(null);
    setMessages((m) =>
      scope === "me"
        ? // Gone from my thread entirely. A tombstone would be wrong here: for
          // me the message is not "deleted", it is no longer mine to see.
          m.filter((x) => x.id !== messageId)
        : m.map((x) => (x.id === messageId ? { ...x, body: "", deleted: true, pinned: false } : x))
    );
    const r = await fetch(`${messageUrl(messageId)}?scope=${scope}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) {
      setErr("Could not delete the message.");
      void load(true);
    } else {
      // The inbox preview and the pinned banner may both have described it.
      onSent();
      void load(true);
    }
  }

  async function togglePin(messageId: string, next: boolean) {
    setActionOpenId(null);
    const r = await fetch(messageUrl(messageId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: next }),
    }).catch(() => null);
    if (!r?.ok) setErr("Could not update the pin.");
    void load(true);
  }

  async function toggleBlock(next: boolean) {
    setThreadMenu(false);
    if (!other?.id) return;
    const r = await fetch("/api/dm/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: other.id, blocked: next }),
    }).catch(() => null);
    if (!r?.ok) { setErr("Could not update the block."); return; }
    setBlocked(next);
    setBlockedByMe(next);
  }

  async function reportUser(reason: string) {
    setThreadMenu(false);
    if (!other?.id || reporting) return;
    setReporting(true);
    const r = await fetch("/api/dm/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: other.id, reason }),
    }).catch(() => null);
    setReporting(false);
    if (r?.ok) setReported(true);
    else setErr("Could not send the report.");
  }

  async function copyMessage(text: string) {
    setActionOpenId(null);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard blocked - nothing useful to say about it */
    }
  }

  /**
   * Translate English <-> Hinglish, reusing the community chat's endpoint.
   * It takes a bare `{ text }`, so there was nothing DM-specific to build -
   * and a second endpoint would have been a second prompt to keep in step.
   */
  async function translateMessage(messageId: string, text: string) {
    setActionOpenId(null);
    const cur = translations[messageId];
    if (cur?.text) {
      setTranslations((t) => ({ ...t, [messageId]: { ...cur, shown: !cur.shown } }));
      return;
    }
    if (cur?.loading) return;
    setTranslations((t) => ({ ...t, [messageId]: { loading: true, shown: true } }));
    try {
      const r = await fetch("/api/chat/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const j = await r.json().catch(() => null);
      setTranslations((t) => ({
        ...t,
        [messageId]: { text: r.ok && j?.text ? j.text : undefined, loading: false, shown: true },
      }));
    } catch {
      setTranslations((t) => ({ ...t, [messageId]: { loading: false, shown: true } }));
    }
  }

  // --- Jump, react, search ------------------------------------------------

  /**
   * Scroll to a message and flash it, so the eye lands on it.
   *
   * ⚠️ Tapping a reply's quote used to do nothing at all - the quote was a
   * plain `<div>`. This is what makes "tag karke click karo" go to the
   * message it quotes. The thread holds the newest 200, so a quote of
   * something older than that has nowhere to go; that says so instead of
   * silently not moving.
   */
  const jumpTo = (messageId: string) => {
    const row = document.getElementById(`dm-${messageId}`);
    if (!row) {
      setErr("That message is too far back to show here.");
      return;
    }
    // Scroll the LIST, not `scrollIntoView`: that walks every scrollable
    // ancestor, and the room learned the hard way that it can move the page
    // itself (see scrollToMessage in ChatClient). The row's offsetParent is the
    // list, which is `relative`.
    const list = scrollRef.current;
    if (list) {
      const top = row.offsetTop - list.clientHeight / 2 + row.clientHeight / 2;
      list.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
    const bubble = row.querySelector<HTMLElement>("[data-bubble]") ?? row;
    bubble.classList.remove("msg-flash");
    void bubble.offsetWidth; // restart the animation if it is already running
    bubble.classList.add("msg-flash");
    window.setTimeout(() => bubble.classList.remove("msg-flash"), 1700);
  };

  /** Set or clear MY reaction. Optimistic; rolled back if the server says no. */
  async function react(m: Msg, emoji: DmReaction | null) {
    setActionOpenId(null);
    if (m.deleted || m.id.startsWith("temp-")) return;
    const before = m.reactions ?? null;
    hapticToggle();
    setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, reactions: { mine: emoji, theirs: before?.theirs ?? null } } : x)));
    const r = await fetch(`${messageUrl(m.id)}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    }).catch(() => null);
    if (!r?.ok) {
      const j = r ? await r.json().catch(() => null) : null;
      setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, reactions: before } : x)));
      setErr(j?.error ?? "Couldn't add that reaction.");
    }
  }

  /** Reply to a message and put the caret in the composer. */
  const replyToMessage = (m: Msg) => {
    setActionOpenId(null);
    setReplyTo(m);
    setFocusTick((t) => t + 1);
  };

  // In-thread search. Matches are ids, oldest first; the counter reads
  // "3 of 7" from the newest end, which is where people start looking.
  const query = searchQ.trim().toLowerCase();
  const matches = query
    ? messages.filter((m) => !m.deleted && !chatMediaUrl(m.body) && m.body.toLowerCase().includes(query)).map((m) => m.id)
    : [];
  const matchSet = new Set(matches);
  const goToMatch = (dir: -1 | 1) => {
    if (!matches.length) return;
    const cur = matchIdx < 0 || matchIdx >= matches.length ? matches.length : matchIdx;
    const next = (cur + dir + matches.length) % matches.length;
    setMatchIdx(next);
    jumpTo(matches[next]!);
  };
  const closeSearch = () => { setSearchOpen(false); setSearchQ(""); setMatchIdx(-1); };

  const sendGif = (url: string) => { setGifOpen(false); void postMessage(url); };

  const onPickPhoto = async (file: File | undefined) => {
    if (!file || photoUploading) return;
    setErr(null);
    setPhotoUploading(true);
    try {
      const compressed = await compressImage(file, 1280).catch(() => file);
      const fd = new FormData();
      fd.append("file", compressed);
      const r = await fetch("/api/media/upload", { method: "POST", body: fd });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.url) { setErr(j?.error || "Photo upload failed."); return; }
      if (String(j.url).startsWith("data:")) { setErr("Photo sharing needs a public Supabase 'post-covers' bucket."); return; }
      await postMessage(String(j.url));
    } catch { setErr("Photo upload failed. Please try again."); }
    finally { setPhotoUploading(false); }
  };

  const otherName = other?.name ?? "Member";
  // "Seen" goes under the newest message of mine the other side has read -
  // once, not on every bubble.
  let seenId: string | null = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m.mine && !m.deleted && !m.id.startsWith("temp-")) {
      if (isReadBy(m.createdAt, otherReadAt)) seenId = m.id;
      break;
    }
  }

  // Messages grouped by day, so each day's label can stick to the top of the
  // list while you scroll through that day - the way every messenger dates a
  // long thread. A label per message would only stick for one bubble.
  const days: { label: string; items: { m: Msg; i: number }[] }[] = [];
  messages.forEach((m, i) => {
    const label = dayLabel(m.createdAt, hydrated);
    const last = days[days.length - 1];
    if (last && last.label === label) last.items.push({ m, i });
    else days.push({ label, items: [{ m, i }] });
  });

  const renderMessage = (m: Msg, i: number, firstOfDay: boolean) => {
    const media = chatMediaUrl(m.body);
    // Consecutive messages from the same side breathe less, so a burst reads
    // as one turn rather than a stack of separate cards.
    const grouped = !firstOfDay && i > 0 && messages[i - 1]!.mine === m.mine;
    const read = m.mine && isReadBy(m.createdAt, otherReadAt);
    const hit = matchSet.has(m.id);
    const rx = m.reactions;
    const canReact = !m.deleted && !m.id.startsWith("temp-") && !blocked;
    const reactionRow = canReact ? (
      <div className="flex items-center justify-between gap-0.5 border-b border-white/10 px-1.5 pb-1.5 pt-1" role="group" aria-label="React">
        {DM_REACTIONS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => void react(m, rx?.mine === e ? null : e)}
            aria-label={`React ${e}`}
            aria-pressed={rx?.mine === e}
            className={cn(
              "grid h-9 w-9 place-items-center rounded-full text-[20px] transition-transform duration-150 hover:scale-125 active:scale-110",
              rx?.mine === e && "bg-gold-500/20 ring-1 ring-gold-500/40"
            )}
          >
            {e}
          </button>
        ))}
      </div>
    ) : null;
    const actions = (side: "left" | "right") => (
      <MessageActions
        open={actionOpenId === m.id}
        onToggle={() => setActionOpenId((x) => (x === m.id ? null : m.id))}
        side={side}
        top={reactionRow}
      >
        <ActionItem icon={Reply} label="Reply" onClick={() => replyToMessage(m)} />
        <ActionItem icon={Forward} label="Forward" onClick={() => { setActionOpenId(null); setForwarding(m); }} disabled={!!media} />
        <ActionItem icon={Copy} label="Copy" onClick={() => void copyMessage(m.body)} disabled={!!media} />
        <ActionItem icon={Languages} label="Translate" onClick={() => void translateMessage(m.id, m.body)} disabled={!!media} />
        <ActionItem icon={m.pinned ? PinOff : Pin} label={m.pinned ? "Unpin" : "Pin"} onClick={() => void togglePin(m.id, !m.pinned)} />
        {m.mine && (
          <ActionItem
            icon={Pencil}
            label="Edit"
            // Same 15-minute window as the community chat. Shown but
            // disabled once it lapses, so the rule is discoverable
            // rather than a button that silently stops existing.
            disabled={!!media || !canEditMessage(m.createdAt)}
            onClick={() => { setActionOpenId(null); setEditingId(m.id); setEditText(m.body); }}
          />
        )}
        <ActionItem icon={Trash2} label="Delete for me" destructive onClick={() => void deleteMessage(m.id, "me")} />
        {/* Only "for me" on their message. Deleting someone else's words
            for both sides is not a thing a participant gets to do -
            the server refuses it, and offering it here would be a
            button that only ever produces a 403. */}
        {m.mine && <ActionItem icon={Trash2} label="Delete for everyone" destructive onClick={() => void deleteMessage(m.id, "everyone")} />}
      </MessageActions>
    );

    return (
      <div key={m.id} id={`dm-${m.id}`} className={cn(grouped ? "mt-0.5" : "mt-3")}>
        <SwipeBubble
          disabled={m.deleted || editingId === m.id}
          onReply={() => replyToMessage(m)}
          onLongPress={() => setActionOpenId(m.id)}
          onDoubleTap={canReact ? () => void react(m, rx?.mine === "❤️" ? null : "❤️") : undefined}
          className="[-webkit-touch-callout:none] [@media(hover:none)]:select-none"
        >
          <div className={cn("group relative flex items-end gap-1", m.mine ? "justify-end" : "justify-start")}>
            {/* The action trigger sits OUTSIDE the bubble, on the side the
                bubble is not, so it never covers the text and the layout
                does not shift when it appears. */}
            {m.mine && !m.deleted && actions("left")}
            <div className={cn("flex min-w-0 max-w-[82%] flex-col sm:max-w-[68%]", m.mine ? "items-end" : "items-start")}>
              <div
                data-bubble
                className={cn(
                  "relative max-w-full rounded-[20px] text-[15px] leading-relaxed shadow-sm shadow-black/20 sm:text-[14px]",
                  media ? "overflow-hidden p-1" : "px-3.5 py-2",
                  m.deleted
                    ? "bg-black/[0.03] text-zinc-500 ring-1 ring-black/5 dark:bg-white/[0.03] dark:text-zinc-500 dark:ring-white/5"
                    : m.mine
                      ? cn("bg-gradient-to-br from-gold-500/25 to-gold-600/15 text-gold-800 ring-1 ring-gold-500/30 dark:text-gold-50", !grouped && "rounded-br-md")
                      : cn("bg-black/[0.05] text-zinc-800 ring-1 ring-black/10 dark:bg-white/[0.06] dark:text-zinc-100 dark:ring-white/10", !grouped && "rounded-bl-md"),
                  hit && "ring-2 ring-gold-400/70"
                )}
              >
                {m.forwarded && !m.deleted && (
                  <p className="mb-1 flex items-center gap-1 text-[11px] italic opacity-60">
                    <Forward className="h-3 w-3" /> Forwarded
                  </p>
                )}
                {m.replyTo && !m.deleted && (
                  // The quote. Tapping it goes to the message it quotes. A
                  // deleted parent still shows a line, so a reply never looks
                  // like it answers nothing.
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); if (!m.replyTo!.deleted) jumpTo(m.replyTo!.id); }}
                    disabled={m.replyTo.deleted}
                    aria-label="Go to the quoted message"
                    className="mb-1.5 block w-full rounded-lg border-l-[3px] border-gold-400/70 bg-black/[0.06] px-2.5 py-1.5 text-left text-[12px] transition-colors hover:bg-black/[0.1] disabled:cursor-default dark:bg-white/[0.06] dark:hover:bg-white/[0.1]"
                  >
                    <span className="block font-semibold text-gold-700 dark:text-gold-200">{m.replyTo.mine ? "You" : otherName}</span>
                    <span className="line-clamp-2 opacity-75">
                      {/* inboxPreview, not the raw body: a photo is sent as a
                          bare media URL, so quoting one printed a wall of
                          storage URL where the message itself shows a picture. */}
                      {m.replyTo.deleted ? "message deleted" : inboxPreview(m.replyTo.body)}
                    </span>
                  </button>
                )}
                {m.deleted ? (
                  // A tombstone, not a removal: taking the row out would
                  // make the thread jump and would rewrite a conversation
                  // the other person had already read.
                  <p className="italic">This message was deleted</p>
                ) : editingId === m.id ? (
                  <div className="min-w-[220px]">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && !touchUi) { e.preventDefault(); void saveEdit(m.id); }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      rows={2}
                      maxLength={2000}
                      autoFocus
                      className="w-full resize-none rounded-lg border border-white/15 bg-ink-950/50 px-2 py-1.5 text-base text-zinc-100 outline-none focus:border-gold-500/40 sm:text-[14px]"
                    />
                    <div className="mt-1 flex justify-end gap-3 text-[12px]">
                      <button type="button" onClick={() => setEditingId(null)} className="text-zinc-400 hover:text-zinc-200">Cancel</button>
                      <button type="button" onClick={() => void saveEdit(m.id)} className="font-semibold text-gold-200 hover:text-gold-100">Save</button>
                    </div>
                  </div>
                ) : media ? (
                  // Tap to open full-screen - see the note in ChatClient.
                  <ImageLightbox src={media} alt="shared media" className="inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={media} alt="shared media" loading="lazy" className="max-h-72 w-auto max-w-full cursor-zoom-in rounded-2xl" />
                  </ImageLightbox>
                ) : (
                  // Same renderer as the community room, so the two cannot
                  // drift: mentions link, links are links.
                  <MessageText text={m.body} className="whitespace-pre-wrap break-words" />
                )}
                {/* The translation sits under the original rather than
                    replacing it - you almost always want to compare. */}
                {translations[m.id]?.shown && (
                  <p className="mt-1.5 border-t border-white/10 pt-1.5 text-[13px] text-zinc-400">
                    {translations[m.id]?.loading
                      ? "Translating…"
                      : translations[m.id]?.text ?? "Couldn't translate. Try again."}
                  </p>
                )}
                {/* Clock time rather than "3 min ago": on a thread you are
                    reading top to bottom, a relative age on every bubble is
                    noise, and it has to be recomputed forever. */}
                <div className={cn("mt-0.5 flex items-center justify-end gap-1", media && "px-2 pb-0.5")}>
                  {m.editedAt && !m.deleted && (
                    <span className={cn("mono text-[10px] italic", m.mine ? "text-gold-700/60 dark:text-gold-200/45" : "text-zinc-600")}>edited</span>
                  )}
                  {m.pinned && !m.deleted && <Pin className="h-3 w-3 shrink-0 text-gold-300/80" aria-label="Pinned" />}
                  <span className={cn("mono text-[10px]", m.mine ? "text-gold-700/70 dark:text-gold-200/60" : "text-zinc-500")}>
                    {clockTime(m.createdAt, hydrated)}
                  </span>
                  {m.mine && !m.deleted && <ReadTicks read={read} pending={m.id.startsWith("temp-")} />}
                </div>
              </div>
              {(rx?.mine || rx?.theirs) && (
                <ReactionPill reactions={rx} onRemoveMine={canReact && rx.mine ? () => void react(m, null) : undefined} mine={m.mine} />
              )}
              {seenId === m.id && (
                <span className="mono mt-0.5 px-1 text-[10px] text-mint-500 dark:text-mint-300/80">Seen</span>
              )}
            </div>
            {/* Their message: the trigger goes on the right, mirroring. */}
            {!m.mine && !m.deleted && actions("right")}
          </div>
        </SwipeBubble>
      </div>
    );
  };

  return (
    /* `relative` so the "New messages ↓" pill below can anchor to the thread
       pane rather than to whatever ancestor happens to be positioned. */
    <div className="relative flex min-h-0 flex-1 flex-col">
      <ChatWallpaper
        choice={appearance.choice}
        photo={appearance.photo}
        settings={appearance.settings}
        className="absolute inset-0"
      />
      {/* Portalled, and outside the blocked/unblocked branch below, so the
          button works in every state of the thread. */}
      {appearanceOpen && (
        <ChatAppearanceSheet
          appearance={appearance}
          theme={themeIsDark ? "dark" : "light"}
          onClose={() => setAppearanceOpen(false)}
        />
      )}
      {confirmBlock && (
        <ConfirmDialog
          title={`Block ${otherName}?`}
          body="They won't be able to message you or react to your messages, and you won't be able to message them. You can still read this conversation, and you can unblock at any time."
          confirmLabel="Block"
          destructive
          onCancel={() => setConfirmBlock(false)}
          onConfirm={() => { setConfirmBlock(false); void toggleBlock(true); }}
        />
      )}

      {/* ⚠️ `z-20`, not `z-[1]`. The header and the message list used to share
          `z-[1]`, and the list comes later in the document, so it painted OVER
          the header - including the Block / Report menu, which opened
          underneath the day label and the bubbles (the owner's screenshot:
          "YESTERDAY" and a "Hello" bubble drawn on top of the menu). */}
      <header className={cn("relative z-20 flex items-center gap-1.5 border-b border-hairline px-2 py-2 sm:gap-2 sm:px-3", CHAT_BAR)}>
        <button onClick={onBack} aria-label="Back" className={cn(CHAT_ICON_BTN, "md:hidden")}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="relative ml-0.5 shrink-0">
          <Avatar name={other?.name} image={other?.image} size="md" />
          <OnlineDot show={otherOnline} />
        </span>
        <div className="ml-1 min-w-0 flex-1">
          {other?.username ? (
            <Link href={`/u/${other.username}`} className="block truncate text-[15px] font-semibold text-zinc-100 hover:underline">{otherName}</Link>
          ) : (
            <span className="block truncate text-[15px] font-semibold text-zinc-100">{otherName}</span>
          )}
          {/* Online now, else when they were last here, else just the handle.
              `now` ticks every 30s, so "last seen 3 min ago" ages by itself. */}
          {otherOnline ? (
            <p className="flex items-center gap-1 text-[12px] font-medium text-mint-500 dark:text-mint-300">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-mint-500 dark:bg-mint-400" /> online
            </p>
          ) : now > 0 && lastSeenLabel(other?.lastSeenAt, now) ? (
            <p className="truncate text-[12px] text-zinc-500">{lastSeenLabel(other?.lastSeenAt, now)}</p>
          ) : (
            other?.username && <p className="mono truncate text-[11px] text-zinc-500">@{other.username}</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
          aria-label="Search in conversation"
          aria-expanded={searchOpen}
          title="Search in conversation"
          className={CHAT_ICON_BTN}
        >
          <Search className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </button>
        <button
          type="button"
          onClick={() => setAppearanceOpen(true)}
          aria-label="Chat appearance"
          aria-haspopup="dialog"
          title="Chat appearance"
          // Same control as the room's header, so the two read as one feature.
          className={CHAT_ICON_BTN}
        >
          <Palette className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </button>
        {/* Safety lives in the header, not buried per message: blocking and
            reporting are about the person, not about one thing they said. */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setThreadMenu((v) => !v)}
            aria-label="Conversation options"
            aria-expanded={threadMenu}
            className={CHAT_ICON_BTN}
          >
            <MoreVertical className="h-[18px] w-[18px]" />
          </button>
          {threadMenu && (
            <>
              <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={() => setThreadMenu(false)} />
              <div role="menu" className="app-fade-in absolute right-0 top-12 z-50 w-60 overflow-hidden rounded-2xl border border-white/10 bg-ink-900 p-1.5 shadow-elevate">
                {other?.username && (
                  <Link href={`/u/${other.username}`} onClick={() => setThreadMenu(false)} className="flex min-h-10 items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-zinc-300 transition-colors hover:bg-white/5 hover:text-zinc-100">
                    <UserRound className="h-4 w-4" /> View profile
                  </Link>
                )}
                <button type="button" onClick={() => { setThreadMenu(false); setSearchOpen(true); }} className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] text-zinc-300 transition-colors hover:bg-white/5 hover:text-zinc-100">
                  <Search className="h-4 w-4" /> Search in conversation
                </button>
                <div className="my-1 border-t border-white/10" />
                {blockedByMe ? (
                  <ActionItem icon={ShieldOff} label="Unblock" onClick={() => void toggleBlock(false)} />
                ) : (
                  <ActionItem icon={Ban} label={`Block ${otherName}`} destructive onClick={() => { setThreadMenu(false); setConfirmBlock(true); }} />
                )}
                <p className="mono px-3 pb-1 pt-2 text-[10px] uppercase tracking-wider text-zinc-500">Report for</p>
                {(["spam", "harassment", "scam", "other"] as const).map((reason) => (
                  <ActionItem key={reason} icon={Flag} label={reason[0]!.toUpperCase() + reason.slice(1)} onClick={() => void reportUser(reason)} />
                ))}
              </div>
            </>
          )}
        </div>
      </header>

      {searchOpen && (
        <div className={cn("relative z-10 flex items-center gap-1.5 border-b border-hairline px-2 py-1.5 sm:px-3", CHAT_BAR)}>
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-ink-950/60 px-3">
            <Search className="h-4 w-4 shrink-0 text-zinc-500" />
            <input
              autoFocus
              value={searchQ}
              onChange={(e) => { setSearchQ(e.target.value); setMatchIdx(-1); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); goToMatch(e.shiftKey ? 1 : -1); }
                if (e.key === "Escape") closeSearch();
              }}
              placeholder="Search this conversation"
              aria-label="Search this conversation"
              className="h-10 min-w-0 flex-1 bg-transparent text-base text-zinc-100 outline-none placeholder:text-zinc-600 sm:text-sm"
            />
            {query && (
              <span className="mono shrink-0 text-[11px] text-zinc-500" aria-live="polite">
                {matches.length === 0 ? "No matches" : `${matchIdx < 0 ? matches.length : matchIdx + 1} of ${matches.length}`}
              </span>
            )}
          </div>
          <button type="button" onClick={() => goToMatch(-1)} disabled={!matches.length} aria-label="Older match" className={cn(CHAT_ICON_BTN, "disabled:opacity-30")}>
            <ChevronUp className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => goToMatch(1)} disabled={!matches.length} aria-label="Newer match" className={cn(CHAT_ICON_BTN, "disabled:opacity-30")}>
            <ChevronDown className="h-5 w-5" />
          </button>
          <button type="button" onClick={closeSearch} aria-label="Close search" className={CHAT_ICON_BTN}>
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {reported && (
        <p className="relative z-10 border-b border-mint-500/20 bg-mint-500/[0.07] px-4 py-2 text-[12px] text-mint-200">
          Thanks - this has been sent to the team for review.
        </p>
      )}

      {/* One pinned message per conversation - the address, the deadline, the
          thing you keep scrolling back for. Tapping it scrolls to it. */}
      {pinned && (
        <button
          type="button"
          onClick={() => jumpTo(pinned.id)}
          className="relative z-10 flex w-full items-center gap-2 border-b border-gold-500/20 bg-gold-500/[0.08] px-4 py-2 text-left backdrop-blur-md"
        >
          <Pin className="h-3.5 w-3.5 shrink-0 text-gold-300" aria-hidden />
          <span className="mono shrink-0 text-[10px] uppercase tracking-wider text-gold-300/80">Pinned</span>
          <span className="truncate text-[12px] text-zinc-300">{chatMediaUrl(pinned.body) ? "\u{1F4F7} Photo" : pinned.body}</span>
          <span
            role="button"
            tabIndex={0}
            aria-label="Unpin"
            onClick={(e) => { e.stopPropagation(); void togglePin(pinned.id, false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); void togglePin(pinned.id, false); } }}
            className="ml-auto shrink-0 text-zinc-500 hover:text-gold-200"
          >
            <PinOff className="h-3.5 w-3.5" />
          </span>
        </button>
      )}

      {/* ⚠️ Shown whenever the reader is away from the bottom, not only when a
          message arrives - and, when one did arrive while they were reading
          history, it says so. Clears itself the moment the thread is back at
          the bottom by any means. */}
      {(hasNew || !stick) && loaded && messages.length > 0 && (
        <button
          onClick={scrollToEnd}
          aria-label={hasNew ? "Jump to new messages" : "Jump to latest"}
          className="app-fade-in pointer-events-auto absolute bottom-24 right-4 z-20 inline-flex items-center gap-1 rounded-full border border-gold-500/40 bg-ink-900/90 px-3.5 py-2 text-[12px] font-semibold text-gold-100 shadow-lg shadow-black/40 backdrop-blur-md transition-colors hover:bg-gold-500/20"
        >
          {hasNew ? "New messages ↓" : "Latest ↓"}
        </button>
      )}

      {/* No `space-y` here: spacing is decided per message, so that a run from
          the same person tightens up. */}
      <div ref={scrollRef} onScroll={onScroll} className="relative z-[1] min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 pt-2 sm:px-5">
        {!loaded ? (
          <p className="py-10 text-center text-sm text-zinc-500"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Loading…</p>
        ) : messages.length === 0 ? (
          <div className="grid h-full place-items-center py-10 text-center">
            <div>
              <span className="relative mx-auto block w-fit"><Avatar name={other?.name} image={other?.image} size="lg" /></span>
              <p className="mt-3 text-[15px] font-semibold text-zinc-100">{otherName}</p>
              <p className="mt-1 text-[13px] text-zinc-500">No messages yet. Say hello 👋</p>
            </div>
          </div>
        ) : (
          days.map((d) => (
            <section key={`${d.label}-${d.items[0]!.m.id}`} aria-label={d.label}>
              <div className="pointer-events-none sticky top-2 z-10 flex justify-center py-2">
                <span className="mono rounded-full bg-ink-900/95 px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-400 shadow-md shadow-black/30 ring-1 ring-white/10">
                  {d.label}
                </span>
              </div>
              {d.items.map(({ m, i }, k) => renderMessage(m, i, k === 0))}
            </section>
          ))
        )}
      </div>

      {blocked ? (
        // No composer at all rather than a disabled one. A greyed-out box you
        // can still click into invites people to type a message that will never
        // send; the server rejects it either way, so say so plainly here.
        <div className={cn("relative z-[2] border-t border-hairline px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4", CHAT_BAR)}>
          <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-red-500/10 text-red-300 ring-1 ring-red-500/25">
              <Ban className="h-5 w-5" />
            </span>
            <p className="text-[14px] font-semibold text-zinc-100">
              {blockedByMe ? `You blocked ${otherName}` : "You can't reply to this conversation"}
            </p>
            <p className="text-[12px] leading-relaxed text-zinc-500">
              {blockedByMe
                ? "They can't message you or react. You can still read the history."
                : "This member isn't accepting messages from you right now."}
            </p>
            {blockedByMe && (
              <button type="button" onClick={() => void toggleBlock(false)} className="btn-secondary mt-1 !px-5 !py-2 text-[13px]">
                Unblock
              </button>
            )}
          </div>
        </div>
      ) : (
      <>
      {forwarding && (
        // A small sheet rather than a new route: forwarding is a two-tap action
        // and pushing a page for it would lose the thread you are in.
        <div className="absolute inset-0 z-30 flex flex-col bg-ink-950/80 backdrop-blur-sm" role="dialog" aria-label="Forward to">
          <button
            type="button"
            className="flex-1"
            aria-label="Cancel forwarding"
            onClick={() => setForwarding(null)}
          />
          <div className="max-h-[60%] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-ink-900 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[15px] font-semibold text-zinc-100">Forward to…</p>
              <button type="button" onClick={() => setForwarding(null)} aria-label="Close" className={CHAT_ICON_BTN}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 truncate rounded-xl bg-white/5 px-3 py-2 text-[12px] text-zinc-400">{inboxPreview(forwarding.body)}</p>
            {conversations.length === 0 ? (
              <p className="px-1 py-3 text-[13px] text-zinc-500">No other conversations yet.</p>
            ) : (
              <ul className="space-y-1">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => void doForward(c.id)}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/5"
                    >
                      <Avatar image={c.other?.image ?? null} name={c.other?.name ?? "?"} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] text-zinc-100">{c.other?.name ?? "Unknown"}</span>
                        {c.id === id && <span className="text-[11px] text-zinc-500">this conversation</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      <div className={cn("relative z-[2] border-t border-hairline px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-3", CHAT_BAR)}>
        {err && (
          <p className="mb-1.5 flex items-center gap-2 px-1 text-[12px] text-amber-500">
            <span className="min-w-0 flex-1">{err}</span>
            <button type="button" onClick={() => setErr(null)} aria-label="Dismiss" className="shrink-0 text-zinc-500 hover:text-zinc-200"><X className="h-3.5 w-3.5" /></button>
          </p>
        )}
        {replyTo && (
          // Sits above the composer so what you are replying to stays visible
          // while you type - and is dismissible, because changing your mind
          // should not mean deleting your draft.
          <div className="app-fade-in mb-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] py-1.5 pl-3 pr-1.5">
            <Reply className="h-4 w-4 shrink-0 text-gold-300" aria-hidden />
            <button type="button" onClick={() => jumpTo(replyTo.id)} className="min-w-0 flex-1 border-l-2 border-gold-500/50 pl-2 text-left">
              <p className="text-[12px] font-semibold text-gold-200">
                Replying to {replyTo.mine ? "yourself" : otherName}
              </p>
              <p className="truncate text-[12px] text-zinc-400">
                {replyTo.deleted ? "message deleted" : inboxPreview(replyTo.body)}
              </p>
            </button>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              aria-label="Cancel reply"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-white/10 hover:text-zinc-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onPickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
          <AttachTray
            items={[
              { key: "photo", label: "Photo", icon: ImagePlus, busy: photoUploading, onSelect: () => photoInputRef.current?.click() },
              ...(gifEnabled ? [{ key: "gif", label: "GIF", icon: Sticker, onSelect: () => setGifOpen(true) }] : []),
            ]}
          >
            <AnimatePresence>{gifOpen && <GifPicker onPick={sendGif} onClose={() => setGifOpen(false)} />}</AnimatePresence>
          </AttachTray>
          <DmComposer onSend={postMessage} sending={sending} touchUi={touchUi} invalid={!!err} draftKey={id} focusTick={focusTick} />
        </div>
      </div>
      </>
      )}
    </div>
  );
}
