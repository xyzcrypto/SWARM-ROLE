"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createPortal } from "react-dom";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, Ban, Check, CheckCheck, Copy, CornerUpLeft as Reply, Flag, Forward, Languages, Loader2, MessageSquare, MoreVertical, Pencil, Pin, PinOff, Search, ShieldOff, Trash2, X, ImagePlus, Smile } from "lucide-react";
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
import { useHydrated } from "@/lib/useClientFlag";
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
      (x.editedAt ?? null) !== (y.editedAt ?? null)
    ) {
      return false;
    }
  }
  return true;
}

/** Menu width in px. Also fed to `placeMenu`, so the two can never disagree. */
const MENU_WIDTH = 176;

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
function MessageActions({
  open,
  onToggle,
  side,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  side: "left" | "right";
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
          "grid h-7 w-7 shrink-0 place-items-center rounded-full text-zinc-500 transition-opacity hover:bg-white/5 hover:text-zinc-200",
          open ? "opacity-100" : "opacity-100 sm:opacity-40 sm:group-hover:opacity-100"
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
              className="fixed z-[81] overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-ink-900 py-1 shadow-elevate"
            >
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

  return (
    <div className="glass grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-3xl md:grid-cols-[minmax(0,320px)_1fr]">
      {/* Inbox */}
      <aside className={cn("flex min-h-0 flex-col border-white/10 md:border-r", activeId ? "hidden md:flex" : "flex")}>
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <h1 className="font-display text-lg font-semibold text-zinc-100">Messages</h1>
          <div className="flex shrink-0 items-center gap-2.5">
            {/* The reason DMs "didn't notify": nothing here ever asked.
                Web Push is per-device and opt-in, and the only two places to
                turn it on were the News page and the community lounge. The
                sending half has always been complete - /api/dm/[id] pushes to
                the recipient's devices and deep-links to this thread - but a
                member who lives in their inbox was never subscribed, so there
                was no device to push to. Same component the lounge uses, so
                one grant covers both. */}
            <NewsAlertsToggle loggedIn compact title="Get a phone notification when someone messages you" />
            <MessageSquare className="h-4 w-4 text-gold-400/70" />
          </div>
        </header>
        {/* Search people */}
        <div className="border-b border-white/10 px-3 py-2.5">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-ink-950/50 px-3 py-1.5">
            <Search className="h-4 w-4 shrink-0 text-zinc-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search people to message…"
              className="w-full bg-transparent text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600"
            />
            {q && <button onClick={() => setQ("")} aria-label="Clear" className="shrink-0 text-zinc-500 hover:text-zinc-200"><X className="h-3.5 w-3.5" /></button>}
          </div>
          {/* Why "Message" did nothing. The server's own words when it has them
              - a DM privacy setting or a block is the usual reason, and neither
              is something the reader can guess from silence. */}
          {startErr && <p className="mt-1.5 px-1 text-[11px] text-amber-500">{startErr}</p>}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {q.trim() ? (
            searching ? (
              <p className="py-8 text-center text-sm text-zinc-500"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Searching…</p>
            ) : results.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">No members found.</p>
            ) : (
              <ul>
                {results.map((u) => (
                  <li key={u.id}>
                    <button onClick={() => u.username && startDm(u.username)} disabled={starting} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.04] disabled:opacity-60">
                      <span className="relative shrink-0"><Avatar name={u.name} image={u.image} size="md" /><OnlineDot show={onlineSet.has(u.id)} /></span>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-zinc-100">{u.name ?? `@${u.username}`}</span>
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
              <MessageSquare className="mx-auto h-6 w-6 text-zinc-600" />
              <p className="mt-3 text-sm text-zinc-400">No conversations yet.</p>
              <p className="mt-1 text-xs text-zinc-600">Search a member above to start chatting.</p>
            </div>
          ) : (
            <ul>
              {[...conversations]
                .sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1))
                .map((c) => (
                <li key={c.id} className="group relative">
                  <div className={cn("flex items-center transition-colors hover:bg-white/[0.04]", activeId === c.id && "bg-white/[0.06]", convMenuId === c.id && "bg-white/[0.04]")}>
                    <button onClick={() => openConversation(c.id)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left">
                      <span className="relative shrink-0"><Avatar name={c.other?.name} image={c.other?.image} size="md" /><OnlineDot show={!!c.other?.id && onlineSet.has(c.other.id)} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="flex min-w-0 items-center gap-1 truncate text-sm font-medium text-zinc-100">
                            {c.pinned && <Pin className="h-3 w-3 shrink-0 text-gold-400/70" aria-label="Pinned" />}
                            {c.other?.name ?? "Member"}
                          </span>
                          {now > 0 && <span className="mono ml-auto shrink-0 text-[11px] text-zinc-600">{timeAgo(new Date(c.lastMessageAt).getTime(), now)}</span>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {c.lastMine && <ReadTicks read={isReadBy(c.lastMessageAt, c.otherReadAt)} />}
                          <span className={cn("truncate text-[13px]", c.unread ? "font-medium text-zinc-200" : "text-zinc-500")}>{inboxPreview(c.lastBody)}</span>
                          {c.unread && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-gold-400" />}
                        </div>
                      </div>
                    </button>
                    {/* Per-conversation context menu: pin / remove */}
                    <div className="relative mr-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setConvMenuId((x) => (x === c.id ? null : c.id)); }}
                        aria-label="Conversation options"
                        /* Pin and remove live behind this button, and it used to be
                           `opacity-0` with only a `group-hover:` reveal - so on a
                           phone, where nothing ever hovers, the only way to reach
                           either action was invisible. The feature effectively did
                           not exist on touch. Always shown below `sm`, revealed on
                           hover above it: the same idiom as the thread header
                           further up this file. */
                        className="grid h-7 w-7 place-items-center rounded-full text-zinc-600 opacity-100 transition-opacity hover:bg-white/5 hover:text-zinc-300 sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                      {convMenuId === c.id && (
                        <>
                          <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={() => setConvMenuId(null)} />
                          <div className="absolute right-0 top-8 z-50 w-44 overflow-hidden rounded-xl border border-white/10 bg-ink-900 py-1 shadow-elevate">
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
              ))}
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
              <MessageSquare className="mx-auto h-8 w-8 text-zinc-700" />
              <p className="mt-3 text-sm text-zinc-500">Select a conversation, or search a member to start.</p>
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
  const [draft, setDraft] = useState("");
  // Mirror of `draft` for the dictation auto-send path - see the MicButton
  // below for why an effect alone is not enough. This effect covers every
  // other way the composer changes; the mic handler writes it synchronously.
  const draftRef = useRef("");
  useEffect(() => { draftRef.current = draft; }, [draft]);
  const [sending, setSending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
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

  // Send any body (text, or a media URL). Optimistic + reconcile.
  const postMessage = async (raw: string, fromDraft = false, opts?: { forwarded?: boolean }) => {
    const body = raw.trim();
    if (!body || sending) return;
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
    if (fromDraft) setDraft("");
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
      } else {
        setMessages((m) => m.filter((x) => x.id !== tempId));
        if (fromDraft) setDraft((d) => (d.trim() ? d : body));
        // The rollback was already correct; the silence was not. A send can fail
        // because the recipient blocked you, because their DM privacy changed
        // since the thread was opened, or because you hit the rate limit - and
        // all three looked identical: the message vanishes, the draft comes
        // back, nothing said why. The server has words for each of them.
        setErr(j?.error ?? "Couldn't send that message.");
      }
    } catch {
      setMessages((m) => m.filter((x) => x.id !== tempId));
      if (fromDraft) setDraft((d) => (d.trim() ? d : body));
      setErr("Couldn't send that message. Check your connection.");
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

  return (
    /* `relative` so the "New messages ↓" pill below can anchor to the thread
       pane rather than to whatever ancestor happens to be positioned. */
    <div className="relative flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <button onClick={onBack} aria-label="Back" className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 hover:bg-white/5 hover:text-zinc-100 md:hidden">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="relative shrink-0">
          <Avatar name={other?.name} image={other?.image} size="sm" />
          <OnlineDot show={otherOnline} />
        </span>
        <div className="min-w-0">
          {other?.username ? (
            <Link href={`/u/${other.username}`} className="truncate text-sm font-semibold text-zinc-100 hover:underline">{other?.name ?? "Member"}</Link>
          ) : (
            <span className="truncate text-sm font-semibold text-zinc-100">{other?.name ?? "Member"}</span>
          )}
          {/* Online now, else when they were last here, else just the handle.
              `now` ticks every 30s, so "last seen 3 min ago" ages by itself. */}
          {otherOnline ? (
            <p className="flex items-center gap-1 text-[11px] font-medium text-mint-500 dark:text-mint-300">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-mint-500 dark:bg-mint-400" /> online
            </p>
          ) : now > 0 && lastSeenLabel(other?.lastSeenAt, now) ? (
            <p className="truncate text-[11px] text-zinc-500">{lastSeenLabel(other?.lastSeenAt, now)}</p>
          ) : (
            other?.username && <p className="mono truncate text-[11px] text-zinc-500">@{other.username}</p>
          )}
        </div>

        {/* Safety lives in the header, not buried per message: blocking and
            reporting are about the person, not about one thing they said. */}
        <div className="relative ml-auto shrink-0">
          <button
            type="button"
            onClick={() => setThreadMenu((v) => !v)}
            aria-label="Conversation options"
            aria-expanded={threadMenu}
            className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {threadMenu && (
            <>
              <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={() => setThreadMenu(false)} />
              <div className="absolute right-0 top-9 z-50 w-52 overflow-hidden rounded-xl border border-white/10 bg-ink-900 py-1 shadow-elevate">
                {blockedByMe ? (
                  <ActionItem icon={ShieldOff} label="Unblock" onClick={() => void toggleBlock(false)} />
                ) : (
                  <ActionItem icon={Ban} label="Block" destructive onClick={() => void toggleBlock(true)} />
                )}
                <div className="my-1 border-t border-white/10" />
                <p className="mono px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-600">Report for</p>
                {(["spam", "harassment", "scam", "other"] as const).map((reason) => (
                  <ActionItem key={reason} icon={Flag} label={reason[0]!.toUpperCase() + reason.slice(1)} onClick={() => void reportUser(reason)} />
                ))}
              </div>
            </>
          )}
        </div>
      </header>

      {reported && (
        <p className="border-b border-mint-500/20 bg-mint-500/[0.07] px-4 py-2 text-[12px] text-mint-200">
          Thanks - this has been sent to the team for review.
        </p>
      )}

      {/* No `space-y` here: spacing is decided per message below, so that a run
          from the same person tightens up. A blanket gap would override it and
          the grouping would silently do nothing. */}
      {/* One pinned message per conversation - the address, the deadline, the
          thing you keep scrolling back for. Tapping it scrolls to it. */}
      {pinned && (
        <button
          type="button"
          onClick={() => document.getElementById(`dm-${pinned.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
          className="flex w-full items-center gap-2 border-b border-gold-500/20 bg-gold-500/[0.07] px-4 py-2 text-left"
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

      {/* Not yanking the reader to the bottom is only half the fix - without
          this, a message that arrives while they are reading history is
          completely silent. Sits above the composer, clears itself the moment
          the thread is back at the bottom by any means. */}
      {hasNew && (
        <button
          onClick={scrollToEnd}
          className="pointer-events-auto absolute inset-x-0 bottom-20 z-20 mx-auto w-fit rounded-full border border-gold-500/40 bg-gold-500/15 px-3.5 py-1.5 text-[12px] font-semibold text-gold-100 shadow-lg shadow-black/30 backdrop-blur transition-colors hover:bg-gold-500/25"
        >
          New messages ↓
        </button>
      )}

      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {!loaded ? (
          <p className="py-10 text-center text-sm text-zinc-500"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Loading…</p>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-zinc-500">No messages yet. Say hello 👋</p>
        ) : (
          messages.map((m, i) => {
            const media = chatMediaUrl(m.body);
            // A separator whenever the day changes, and above the first message.
            const day = dayLabel(m.createdAt, hydrated);
            const showDay = i === 0 || day !== dayLabel(messages[i - 1]!.createdAt, hydrated);
            // Consecutive messages from the same side breathe less, so a burst
            // reads as one turn rather than a stack of separate cards.
            const grouped = !showDay && i > 0 && messages[i - 1]!.mine === m.mine;
            const read = m.mine && isReadBy(m.createdAt, otherReadAt);
            return (
              <div key={m.id}>
                {showDay && (
                  <div className="flex justify-center py-3">
                    <span className="mono rounded-full bg-black/[0.06] px-2.5 py-1 text-[10px] uppercase tracking-wider text-zinc-500 ring-1 ring-black/5 dark:bg-white/[0.05] dark:ring-white/10">
                      {day}
                    </span>
                  </div>
                )}
                <div id={`dm-${m.id}`} className={cn("group relative flex items-end gap-1", grouped ? "mt-0.5" : "mt-2", m.mine ? "justify-end" : "justify-start")}>
                  {/* The action trigger sits OUTSIDE the bubble, on the side the
                      bubble is not, so it never covers the text and the layout
                      does not shift when it appears. Always rendered on touch
                      (where there is no hover to reveal it). */}
                  {m.mine && !m.deleted && (
                    <MessageActions
                      open={actionOpenId === m.id}
                      onToggle={() => setActionOpenId((x) => (x === m.id ? null : m.id))}
                      side="left"
                    >
                      <ActionItem icon={Reply} label="Reply" onClick={() => { setActionOpenId(null); setReplyTo(m); }} />
                      <ActionItem icon={Forward} label="Forward" onClick={() => { setActionOpenId(null); setForwarding(m); }} disabled={!!media} />
                      <ActionItem icon={Copy} label="Copy" onClick={() => void copyMessage(m.body)} disabled={!!media} />
                      <ActionItem icon={Languages} label="Translate" onClick={() => void translateMessage(m.id, m.body)} disabled={!!media} />
                      <ActionItem icon={m.pinned ? PinOff : Pin} label={m.pinned ? "Unpin" : "Pin"} onClick={() => void togglePin(m.id, !m.pinned)} />
                      <ActionItem
                        icon={Pencil}
                        label="Edit"
                        // Same 15-minute window as the community chat. Shown but
                        // disabled once it lapses, so the rule is discoverable
                        // rather than a button that silently stops existing.
                        disabled={!!media || !canEditMessage(m.createdAt)}
                        onClick={() => { setActionOpenId(null); setEditingId(m.id); setEditText(m.body); }}
                      />
                      <ActionItem icon={Trash2} label="Delete for me" destructive onClick={() => void deleteMessage(m.id, "me")} />
                      <ActionItem icon={Trash2} label="Delete for everyone" destructive onClick={() => void deleteMessage(m.id, "everyone")} />
                    </MessageActions>
                  )}
                  <div className={cn("max-w-[78%] rounded-2xl text-[14px] leading-relaxed", media ? "overflow-hidden p-1" : "px-3.5 py-2", m.deleted ? "bg-black/[0.03] text-zinc-500 ring-1 ring-black/5 dark:bg-white/[0.03] dark:text-zinc-500 dark:ring-white/5" : m.mine ? "rounded-br-md bg-gold-500/20 text-gold-950 ring-1 ring-gold-500/30 dark:bg-gold-500/15 dark:text-gold-50" : "rounded-bl-md bg-black/[0.05] text-zinc-800 ring-1 ring-black/10 dark:bg-white/[0.05] dark:text-zinc-100 dark:ring-white/10")}>
                    {m.forwarded && !m.deleted && (
                      <p className="mb-1 flex items-center gap-1 text-[11px] italic opacity-60">
                        <Forward className="h-3 w-3" /> Forwarded
                      </p>
                    )}
                    {m.replyTo && !m.deleted && (
                      // The quote. A deleted parent still shows a line, so a
                      // reply never looks like it answers nothing.
                      <div className="mb-1.5 border-l-2 border-current/30 pl-2 text-[12px] opacity-70">
                        <span className="block font-medium">{m.replyTo.mine ? "You" : "Them"}</span>
                        <span className="line-clamp-2 italic">
                          {/* inboxPreview, not the raw body: a photo is sent as a
                              bare media URL, so quoting one printed a wall of
                              storage URL where the message itself shows a picture. */}
                          {m.replyTo.deleted ? "message deleted" : inboxPreview(m.replyTo.body)}
                        </span>
                      </div>
                    )}
                    {m.deleted ? (
                      // A tombstone, not a removal: taking the row out would
                      // make the thread jump and would rewrite a conversation
                      // the other person had already read.
                      <p className="italic">This message was deleted</p>
                    ) : editingId === m.id ? (
                      <div className="min-w-[200px]">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void saveEdit(m.id); }
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          rows={2}
                          maxLength={2000}
                          autoFocus
                          className="w-full resize-none rounded-lg border border-white/15 bg-ink-950/50 px-2 py-1.5 text-[14px] text-zinc-100 outline-none focus:border-gold-500/40"
                        />
                        <div className="mt-1 flex justify-end gap-2 text-[11px]">
                          <button type="button" onClick={() => setEditingId(null)} className="text-zinc-400 hover:text-zinc-200">Cancel</button>
                          <button type="button" onClick={() => void saveEdit(m.id)} className="font-semibold text-gold-200 hover:text-gold-100">Save</button>
                        </div>
                      </div>
                    ) : media ? (
                      // Tap to open full-screen - see the note in ChatClient.
                      <ImageLightbox src={media} alt="shared media" className="inline-block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={media} alt="shared media" loading="lazy" className="max-h-72 w-auto max-w-full cursor-zoom-in rounded-xl" />
                      </ImageLightbox>
                    ) : (
                      // Was a raw `{m.body}` in a <p>: a mention was grey text
                      // and a pasted link was not a link. Same renderer as the
                      // community room, so the two cannot drift again.
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
                    <div className={cn("mt-1 flex items-center justify-end gap-1", media && "px-2 pb-0.5")}>
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
                  {/* Their message: the trigger goes on the right, mirroring. */}
                  {!m.mine && !m.deleted && (
                    <MessageActions
                      open={actionOpenId === m.id}
                      onToggle={() => setActionOpenId((x) => (x === m.id ? null : m.id))}
                      side="right"
                    >
                      <ActionItem icon={Reply} label="Reply" onClick={() => { setActionOpenId(null); setReplyTo(m); }} />
                      <ActionItem icon={Forward} label="Forward" onClick={() => { setActionOpenId(null); setForwarding(m); }} disabled={!!media} />
                      <ActionItem icon={Copy} label="Copy" onClick={() => void copyMessage(m.body)} disabled={!!media} />
                      <ActionItem icon={Languages} label="Translate" onClick={() => void translateMessage(m.id, m.body)} disabled={!!media} />
                      <ActionItem icon={m.pinned ? PinOff : Pin} label={m.pinned ? "Unpin" : "Pin"} onClick={() => void togglePin(m.id, !m.pinned)} />
                      {/* Only "for me" on their message. Deleting someone else's words
                          for both sides is not a thing a participant gets to do -
                          the server refuses it, and offering it here would be a
                          button that only ever produces a 403. */}
                      <ActionItem icon={Trash2} label="Delete for me" destructive onClick={() => void deleteMessage(m.id, "me")} />
                    </MessageActions>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {blocked ? (
        // No composer at all rather than a disabled one. A greyed-out box you
        // can still click into invites people to type a message that will never
        // send; the server rejects it either way, so say so plainly here.
        <div className="border-t border-white/10 px-4 py-4 text-center">
          <p className="text-[13px] text-zinc-400">
            {blockedByMe ? "You blocked this member." : "You can't reply to this conversation."}
          </p>
          {blockedByMe && (
            <button type="button" onClick={() => void toggleBlock(false)} className="btn-ghost mt-2 !px-4 !py-1.5 text-xs">
              Unblock
            </button>
          )}
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
          <div className="max-h-[60%] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-ink-900 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-100">Forward to…</p>
              <button type="button" onClick={() => setForwarding(null)} aria-label="Close" className="rounded-lg p-1 text-zinc-500 hover:text-zinc-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-2 truncate rounded-lg bg-white/5 px-3 py-2 text-[12px] text-zinc-400">{inboxPreview(forwarding.body)}</p>
            {conversations.length === 0 ? (
              <p className="px-1 py-3 text-[13px] text-zinc-500">No other conversations yet.</p>
            ) : (
              <ul className="space-y-1">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => void doForward(c.id)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-white/5"
                    >
                      <Avatar image={c.other?.image ?? null} name={c.other?.name ?? "?"} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-zinc-100">{c.other?.name ?? "Unknown"}</span>
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
      <div className="border-t border-white/10 p-3">
        {err && <p className="mb-1.5 px-1 text-[11px] text-amber-500">{err}</p>}
        {replyTo && (
          // Sits above the composer so what you are replying to stays visible
          // while you type - and is dismissible, because changing your mind
          // should not mean deleting your draft.
          <div className="mb-2 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
            <div className="min-w-0 flex-1 border-l-2 border-gold-500/40 pl-2">
              <p className="text-[11px] font-medium text-gold-200">
                Replying to {replyTo.mine ? "yourself" : "them"}
              </p>
              <p className="truncate text-[12px] text-zinc-400">
                {replyTo.deleted ? "message deleted" : inboxPreview(replyTo.body)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              aria-label="Cancel reply"
              className="shrink-0 rounded-lg p-1 text-zinc-500 hover:bg-white/10 hover:text-zinc-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-1.5">
          {gifEnabled && (
            <div className="relative">
              <button type="button" onClick={() => setGifOpen((v) => !v)} className={cn("grid h-11 w-9 shrink-0 place-items-center rounded-2xl border border-black/10 bg-black/[0.04] text-[10px] font-bold hover:border-gold-500/40 hover:text-gold-200 dark:border-white/10 dark:bg-ink-800/60", gifOpen ? "text-gold-200" : "text-zinc-400")} aria-label="Send a GIF">GIF</button>
              <AnimatePresence>{gifOpen && <GifPicker onPick={sendGif} onClose={() => setGifOpen(false)} />}</AnimatePresence>
            </div>
          )}
          <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onPickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
          <button type="button" onClick={() => photoInputRef.current?.click()} disabled={photoUploading} className="grid h-11 w-9 shrink-0 place-items-center rounded-2xl border border-black/10 bg-black/[0.04] text-zinc-400 hover:border-gold-500/40 hover:text-gold-200 disabled:opacity-50 dark:border-white/10 dark:bg-ink-800/60" aria-label="Share a photo">
            {photoUploading ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <ImagePlus className="h-[18px] w-[18px]" />}
          </button>
          <div className="relative flex-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void postMessage(draft, true); } }}
              placeholder="Write a message…"
              rows={1}
              maxLength={2000}
              className="block max-h-32 min-h-[44px] w-full resize-none rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 pr-20 text-[14px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-gold-500/40 focus:ring-1 focus:ring-gold-500/20"
            />
            <button type="button" onClick={() => setPickerOpen((v) => !v)} className="absolute bottom-0 right-0 grid h-11 w-10 place-items-center text-zinc-500 hover:text-gold-200" aria-label="Emoji">
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
                if (text && !sending) void postMessage(text, true);
              }}
            />
            <AnimatePresence>{pickerOpen && <EmojiPicker onPick={(e) => setDraft((b) => (b + e).slice(0, 2000))} onClose={() => setPickerOpen(false)} />}</AnimatePresence>
          </div>
          <button onClick={() => void postMessage(draft, true)} disabled={!draft.trim() || sending} aria-label="Send message" className="btn-primary relative inline-flex h-11 shrink-0 items-center gap-1 rounded-2xl !px-2.5 disabled:opacity-50">
            {sending ? <Loader2 className="relative z-10 h-4 w-4 animate-spin !text-white" /> : <SendGlyph className="relative z-10 h-4 w-4" />}
            <span className="relative z-10 hidden text-[13px] font-semibold !text-white sm:inline">Send</span>
          </button>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
