"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useMediaQuery, useHydrated } from "@/lib/useClientFlag";
import { clockTime, dayLabel } from "@/lib/chat-time";
import {
  Flag,
  Palette,
  ArrowDown, BarChart3, Check, Link2, ChevronDown, ChevronUp, Copy, Edit3, Heart, ImagePlus, Languages, Loader2, Pin, PinOff, Plus, Reply, Search, Smile, Sticker, Trash2, X, Volume2, VolumeX,
} from "lucide-react";
import { applyPollVote, canEditMessage, pollShares, reconcilePoll } from "@/lib/chat-view";
import { compressImage } from "@/lib/image";
import { chatAudioUrl, chatMediaUrl, isMediaBody, mediaLabel, splitLeadingMedia } from "@modules/community/lib/chat-media";
import { VoiceNote, VoiceRecorder, uploadVoice, VoiceIcon } from "./Voice";
import { LinkPreviewCard } from "./LinkPreviewCard";
import { ImageLightbox } from "@/components/ImageLightbox";
import { joinSharedChannel } from "@/lib/sharedChannel";
import { SendGlyph } from "@/components/SendGlyph";
import { MessageText } from "@shared/components/MessageText";
import { GifPicker } from "@/components/GifPicker";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/ui/primitives";
import { EmojiPicker } from "@/components/EmojiPicker";
import { MagneticButton } from "@/components/MagneticButton";
import { MessageButton } from "@/components/MessageButton";
import { NewsAlertsToggle } from "@/components/NewsAlertsToggle";
import { cn } from "@/lib/utils";
import { safeHref, cleanBareUrl } from "@/lib/links";
import { MicButton } from "@/shared/components/MicButton";
import { hapticToggle } from "@shared/utils/haptics";
import { hapticTap } from "@shared/utils/haptics";
import { ReportDialog } from "./ReportDialog";
import { useChatAppearance } from "./useChatAppearance";
import { ChatWallpaper } from "./ChatWallpaper";
import { ChatAppearanceSheet } from "./ChatAppearanceSheet";
import { AttachTray } from "./AttachTray";
import { SwipeBubble, fromControl } from "./SwipeBubble";
import { CHAT_BAR, CHAT_ICON_BTN } from "../lib/chat-ui";
import { AppMenu } from "@shared/components/AppMenu";
import { feelAttrs, setFeel, useChatFeel } from "@shared/utils/chat-feel";
import { chatPressFeedback } from "@shared/utils/chat-feedback";
import { playSfx, unlockAudio } from "@shared/utils/sfx";
import { centredScrollTop } from "@shared/utils/scroll-into-list";

const MAX_LENGTH = 500;
const CHANNEL = "community";

/**
 * How tall the composer may grow before it scrolls internally.
 *
 * ~6 lines at the composer's line-height. Tall enough that a real paragraph is
 * visible while writing it, short enough that the message list is never pushed
 * off screen on a small phone - which is the other half of the brief: the
 * composer must not cover the latest messages.
 */
const COMPOSER_MAX_H = 148;
const REACTIONS = ["👍", "❤️", "😂", "🔥", "🚀", "🎉", "👀", "💯"];
const GROUP_WINDOW_MS = 5 * 60 * 1000;

/**
 * Fallback poll for the room when realtime is not carrying messages.
 *
 * Named rather than inlined so `markets-poll-alignment.test.ts` can read it. The
 * anonymous response from `/api/chat/messages` is edge-cached, and that window
 * has to clear this interval: it was `s-maxage=8` against this 10s poll, so the
 * edge entry expired ~2s before every poll arrived and **every anonymous poll
 * reached Postgres**. On a page that gives signed-out visitors a live read-only
 * preview, that is a direct Supabase egress cost for traffic that could have
 * been served from the CDN.
 */
export const CHAT_POLL_MS = 10_000;

type Author = { name: string | null; username: string | null; image: string | null; membership: string; role: string };
type Reaction = { emoji: string; userIds: string[] };
type ReplyRef = { id: string; body: string; authorName: string };
type PollOption = { id: string; text: string; order: number; count: number };
type Poll = { id: string; question: string; options: PollOption[]; total: number; myVote?: string | null };
type Message = {
  id: string;
  body: string;
  kind?: string; // "text" | "poll"
  createdAt: string;
  editedAt?: string | null;
  pinnedAt?: string | null;
  userId: string;
  author: Author;
  replyTo: ReplyRef | null;
  reactions: Reaction[];
  poll?: Poll | null;
  pending?: boolean;
  /** Session-local tombstone: removed by author/moderator while we watched. */
  hidden?: boolean;
};
type Me = { id: string; isAdmin: boolean; name: string; image?: string | null; username?: string | null; membership?: string };
type PresenceMember = { id: string; name: string; image: string | null; username: string | null };

const normalizeReactions = (rs: { emoji: string; userIds: string[] }[]): Reaction[] =>
  rs.map((r) => ({ emoji: r.emoji, userIds: [...r.userIds] }));

/* Plain-text body with safe linkified URLs + @mention highlights (no HTML).
   A lone trusted media URL renders as an inline image/GIF instead. */
function MessageBody({ text }: { text: string }) {
  const voice = chatAudioUrl(text);
  if (voice) return <div className="mt-0.5"><VoiceNote src={voice.src} duration={voice.duration} /></div>;
  // Media followed by text: a row saved before editing media was refused.
  // Show the media, then the text as a caption - never the raw URL.
  const lead = splitLeadingMedia(text);
  if (lead?.caption) {
    return (
      <>
        <MessageBody text={lead.url} />
        <MessageText text={lead.caption} className="mt-1 whitespace-pre-wrap break-words text-[length:var(--chat-fs)] leading-relaxed text-zinc-200" />
      </>
    );
  }
  const media = chatMediaUrl(text);
  if (media) {
    // Tapping a shared photo opens it full-screen, the same wrapper the profile
    // avatar and banner already use. In a message list the thumbnail is capped
    // at 288px tall and 300px wide, so anything with detail in it - a chart, a
    // screenshot - is unreadable until it can be opened.
    return (
      <ImageLightbox src={media} alt="shared media" className="mt-0.5 inline-block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={media}
          alt="shared media"
          loading="lazy"
          className="max-h-72 w-auto max-w-full cursor-zoom-in rounded-xl border border-white/10 object-contain sm:max-w-[300px]"
        />
      </ImageLightbox>
    );
  }
  // The link/mention rendering is shared with DM (see MessageText). It used to
  // live here with its own regex literals, which is how DM ended up with none
  // at all and the two rooms rendered the same message differently.
  return (
    <>
      <MessageText text={text} className="whitespace-pre-wrap break-words text-[length:var(--chat-fs)] leading-relaxed text-zinc-200" />
      <LinkPreviewCard text={text} />
    </>
  );
}

/**
 * Day separator for the message list.
 *
 * Unlike the site's other date stamps this one genuinely means "the reader's
 * day" - "Today" has to follow the reader's midnight, not UTC's - so it cannot
 * simply be pinned to UTC. But the reader's timezone is not knowable while
 * server rendering, and guessing wrong is not free: the server said
 * "Aug 2, 2026" where an IST browser said "Aug 3, 2026", which React treats as
 * a hard hydration failure (#418) and recovers from by throwing away the
 * server-rendered chat.
 *
 * So `local` is false for the server render AND the hydrating client render -
 * both produce the same UTC-based string, nothing to mismatch - and true from
 * the render right after hydration onwards, where the reader's own day is
 * finally both knowable and correct. The two only ever disagree for messages
 * within the timezone offset of midnight.
 */
export function ChatClient({
  initialMessages,
  initialHasMore,
  initialPinned = null,
  me,
  realtime,
  gifEnabled = false,
}: {
  initialMessages: Message[];
  initialHasMore: boolean;
  initialPinned?: Message | null;
  me: Me | null;
  realtime: { url: string; anonKey: string };
  gifEnabled?: boolean;
}) {
  // False on the server and during hydration, true from the next render on.
  // Day separators need the reader's timezone, which is only knowable here -
  // see dayLabel.
  const hydrated = useHydrated();
  const [messages, setMessages] = useState<Message[]>(
    initialMessages.map((m) => ({ ...m, reactions: normalizeReactions(m.reactions) }))
  );
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);
  // Why the realtime channel failed, if it did - shown as a tooltip on the
  // status pill so the cause is one hover away instead of a support thread.
  const [liveError, setLiveError] = useState<string | null>(null);
  // Why the SERVER-backed roster is not answering, when it is not. Without
  // this a missing ChatPresence table looks exactly like an empty room: a
  // confident "1 online" that no amount of refreshing changes.
  const [presenceError, setPresenceError] = useState<string | null>(null);
  // Why the MESSAGE poll is not answering, when it is not. This is the last
  // silent failure in the room: the poll swallowed its own errors, so a room
  // whose /api/chat/messages was returning 503 sat there showing "Synced" and
  // stale messages, and the only thing that ever fixed it was a manual reload
  // (which re-renders on the server, down a different path). That is exactly
  // the "new wala dekhne ke liye refresh karna padta hai" report.
  const [pollError, setPollError] = useState<string | null>(null);
  const [online, setOnline] = useState(0);
  const [members, setMembers] = useState<PresenceMember[]>([]);
  const [typers, setTypers] = useState<Record<string, { name: string; until: number }>>({});
  const [stickToBottom, setStickToBottom] = useState(true);
  const [unread, setUnread] = useState(0);
  const [replyTarget, setReplyTarget] = useState<ReplyRef | null>(null);
  const [reactOpenId, setReactOpenId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Per-message translation (English <-> Hinglish); toggled from the action bar.
  const [translations, setTranslations] = useState<Record<string, { text?: string; loading?: boolean; shown?: boolean; error?: string }>>({});
  // Sounds and haptics follow the member's chat feel settings (chat-feel.ts),
  // shared with DMs. The header speaker toggles sounds off / back on.
  const feel = useChatFeel();
  const soundOn = feel.sound !== "off";
  // Touch UI (no hover): actions open on tap instead of hover, Enter makes a
  // newline instead of sending. Detected client-side to stay hydration-safe.
  // Coarse-pointer devices get the tap-friendly chat UI. Tracked (not read once
  // on mount) so attaching a mouse or rotating a tablet updates it live.
  const touchUi = useMediaQuery("(hover: none)");
  /** Which message the report dialog is open for, and its excerpt. */
  const [reporting, setReporting] = useState<{ id: string; preview: string } | null>(null);
  const appearance = useChatAppearance();
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  /**
   * Which theme the room is painted in, for the background preview.
   *
   * ⚠️ Read from the `dark` CLASS, in an effect, and never during render. This
   * site sets the theme by toggling a class on `<html>` (there is a no-FOUC
   * inline script in the layout), which the server render cannot see - so
   * deriving anything that reaches the DOM from it during render is the
   * client-only-signal mismatch that once threw React #418 on every page here.
   *
   * The starting value matches the server's assumption (dark is this site's
   * default), and the observer - not a media query - is what keeps it current:
   * the reader's OS preference is irrelevant once they have picked a theme.
   */
  const [themeIsDark, setThemeIsDark] = useState(true);
  useEffect(() => {
    const html = document.documentElement;
    const read = () => setThemeIsDark(html.classList.contains("dark"));
    read();
    const obs = new MutationObserver(read);
    obs.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const [actionOpenId, setActionOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [pinned, setPinned] = useState<Message | null>(initialPinned);
  const [pollOpen, setPollOpen] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  // Voice notes: staff only in the room, the same rule as photos (moderating
  // audio in a public room is harder than moderating text). Everyone has them
  // in DMs.
  const [recording, setRecording] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  // Search over the messages already loaded in the room. Matches are ids,
  // oldest first; navigation starts from the newest, where people look first.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [matchIdx, setMatchIdx] = useState(-1);
  // Bumped to put the caret in the composer (swipe-to-reply, Reply).
  const [composerFocus, setComposerFocus] = useState(0);
  const scrollToMessageRef = useRef<((id: string) => Promise<void>) | null>(null);

  // A shared message link (/community?m=<id>) opens the room scrolled to that
  // message - loading older pages if it is further back. Runs once, after the
  // first paint; the id is validated before it is used.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("m");
    if (!id || !/^[a-z0-9]{10,40}$/i.test(id)) return;
    const t = window.setTimeout(() => void scrollToMessageRef.current?.(id), 400);
    return () => window.clearTimeout(t);
  }, []);
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);
  const firstUnreadRef = useRef<string | null>(null);


  const realtimeConfigured = Boolean(realtime.url && realtime.anonKey);

  // Toggling sounds on is a user gesture, so it also unlocks audio - and the
  // confirming note proves it works.
  const toggleSound = () => {
    const next = soundOn ? "off" : "messages";
    setFeel({ sound: next });
    if (next !== "off") {
      unlockAudio();
      playSfx("receive", { force: true });
    }
  };

  const listRef = useRef<HTMLDivElement>(null);
  const scrollRaf = useRef(0);
  const channelRef = useRef<any>(null);
  const lastTyping = useRef(0);
  const stickRef = useRef(true);
  // Mirrors `live` for the poll loop to read. The poll runs on a plain interval
  // that closes over the effect's first render, so it cannot see `live` as
  // state - and it needs the *current* value on every tick to decide whether
  // realtime is carrying the room or it has to.
  const liveRef = useRef(false);
  // Profile fields ride in a ref so a name/avatar edit doesn't tear down and
  // re-subscribe the realtime socket (only an identity change should).
  const meRef = useRef(me);
  // Both are written after commit rather than during render (a render-phase ref
  // write isn't safe under concurrent rendering) - same pattern messagesRef
  // below already uses. Both are only read from async scroll/realtime handlers.
  useEffect(() => {
    stickRef.current = stickToBottom;
    meRef.current = me;
  });
  // Mirror of messages for async flows (loadOlder loops) that outlive a render.
  const messagesRef = useRef<Message[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const appendMessage = useCallback((m: Message) => {
    // ⚠️ Same fix as the poll's `tick`, and this is the hotter path - every
    // realtime message goes through here. `setUnread`, the `firstUnreadRef`
    // write and the divider anchor all used to sit INSIDE the updater below. An
    // updater must be pure and React may invoke it more than once for a single
    // update, which counted one arriving message as two on the badge.
    //
    // The mirror ref is written synchronously here as well as by its effect, so
    // two messages arriving in the same tick cannot both be treated as new.
    if (messagesRef.current.some((x) => x.id === m.id)) return;
    const next = { ...m, reactions: normalizeReactions(m.reactions) };
    messagesRef.current = [...messagesRef.current, next];

    if (!stickRef.current) {
      setUnread((u) => u + 1);
      // First message that arrived while scrolled up ⇒ anchor for the
      // in-stream "New messages" divider.
      if (!firstUnreadRef.current) {
        firstUnreadRef.current = m.id;
        setFirstUnreadId(m.id);
      }
    }

    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, next]));
  }, []);
  // In-place tombstone (this session only) - keeps conversation context
  // instead of messages silently vanishing mid-read. Gone after reload.
  const hideMessage = useCallback((id: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, hidden: true, body: "" } : m)));
    setPinned((p) => (p?.id === id ? null : p));
  }, []);
  const applyEdit = useCallback((id: string, body: string, editedAt: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, body, editedAt } : m)));
  }, []);

  // Live poll results: swap in fresh anonymous counts (myVote is local-only).
  const applyPollCounts = useCallback(
    (messageId: string, counts: { optionId: string; count: number }[], total: number) => {
      const patch = (m: Message): Message => {
        if (m.id !== messageId || !m.poll) return m;
        const byId = new Map(counts.map((c) => [c.optionId, c.count]));
        return {
          ...m,
          poll: {
            ...m.poll,
            total,
            options: m.poll.options.map((o) => ({ ...o, count: byId.get(o.id) ?? o.count })),
          },
        };
      };
      setMessages((prev) => prev.map(patch));
      setPinned((p) => (p ? patch(p) : p));
    },
    []
  );

  const applyPinned = useCallback((id: string, isPinned: boolean) => {
    setMessages((prev) => {
      const target = prev.find((m) => m.id === id);
      if (isPinned) {
        // The pinned message is usually loaded; fall back to a refetch if not.
        if (target) setPinned({ ...target, pinnedAt: new Date().toISOString() });
        else {
          fetch("/api/chat/messages", { cache: "no-store" })
            .then((r) => r.json())
            .then((d) => d?.pinned && setPinned(d.pinned as Message))
            .catch(() => {});
        }
      } else {
        setPinned((p) => (p?.id === id ? null : p));
      }
      return prev.map((m) => (m.id === id ? { ...m, pinnedAt: isPinned ? new Date().toISOString() : null } : m));
    });
  }, []);

  // Idempotent reaction delta - safe to apply for both optimistic + echoed events.
  const applyReaction = useCallback(
    (messageId: string, emoji: string, userId: string, op: "add" | "remove") => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          let reactions = m.reactions.map((r) => ({ emoji: r.emoji, userIds: [...r.userIds] }));
          const idx = reactions.findIndex((r) => r.emoji === emoji);
          if (op === "add") {
            if (idx === -1) reactions.push({ emoji, userIds: [userId] });
            else if (!reactions[idx].userIds.includes(userId)) reactions[idx].userIds.push(userId);
          } else if (idx !== -1) {
            reactions[idx].userIds = reactions[idx].userIds.filter((u) => u !== userId);
            reactions = reactions.filter((r) => r.userIds.length > 0);
          }
          return { ...m, reactions };
        })
      );
    },
    []
  );

  // --- Live updates: Supabase Realtime (+ presence + typing) AND polling. ---
  //
  // "AND", not "else". This used to `return` as soon as realtime was configured,
  // so the 10s poll below was never armed on a configured deployment - and the
  // subscribe callback only ever recorded SUBSCRIBED, never acted on
  // CHANNEL_ERROR / TIMED_OUT / CLOSED. Between them that meant a single failed
  // or dropped subscription left the room with no live channel, no retry, and no
  // fallback: messages stopped arriving, the presence count sat at 0, and the
  // header showed "Reconnecting..." forever while nothing was reconnecting. The
  // label was the only part of it doing any work.
  //
  // Now the poll is always armed and cheap - it early-returns on every tick
  // while the channel is healthy, so a working room still makes zero extra
  // requests - and a broken channel is retried with backoff. Whichever recovers
  // first wins, and the room keeps working either way.
  useEffect(() => {
    let teardownRef: (() => void) | undefined;
    let cancelled = false;
    let retries = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    // `tick` and `beat` are defined below but needed inside the subscribe
    // callback above them; these hold the live references without hoisting the
    // whole poll body above the channel setup.
    // `force` skips the 60s safety-reconcile throttle - needed by the bulk
    // restore handler, which has no message payload to apply directly.
    const tickRef: { current?: (force?: boolean) => Promise<void> } = {};
    const beatRef: { current?: () => Promise<void> } = {};

    // Channel only. Retried on its own; must NOT arm the poll, or every retry
    // would leave another interval running.
    async function connect() {
      if (!realtime.url || !realtime.anonKey) return;
      if (cancelled) return;

      // Joined through the shared registry, not `client.channel()` directly.
      // NavActivity also listens on `community`, and because supabase-js reuses
      // a channel by topic, whichever mounted second was adding listeners to an
      // already-subscribed channel - which throws, and silently dropped one
      // side's handlers. In production that threw twice per load and is why the
      // online count did not update, and why a refresh sometimes "fixed" it:
      // the reload changed which component won the race.
      const channel = joinSharedChannel(
        realtime.url,
        realtime.anonKey,
        CHANNEL,
        me?.id || `guest-${Math.random().toString(36).slice(2)}`
      );

      const offs: Array<() => void> = [];
      offs.push(channel.onBroadcast("new_message", (payload) => {
        const msg = payload as Message;
        appendMessage(msg);
        if (msg.userId !== me?.id) playSfx("receive");
      }));
      offs.push(channel.onBroadcast("message_hidden", (payload) => hideMessage((payload as { id: string }).id)));
      // A bulk restore carries no messages - it means "history changed under
      // you". `tick(true)` bypasses the 60s safety-reconcile throttle, which is
      // the whole point: without it a restore was invisible for up to a minute.
      offs.push(channel.onBroadcast("messages_restored", () => { void tickRef.current?.(true); }));
      offs.push(channel.onBroadcast("message_edited", (payload) => {
        const p = payload as { id: string; body: string; editedAt: string };
        applyEdit(p.id, p.body, p.editedAt);
      }));
      offs.push(channel.onBroadcast("message_pinned", (payload) => {
        const p = payload as { id: string; pinned: boolean };
        applyPinned(p.id, p.pinned);
      }));
      offs.push(channel.onBroadcast("poll_vote", (payload) => {
        const p = payload as { messageId: string; counts: { optionId: string; count: number }[]; total: number };
        applyPollCounts(p.messageId, p.counts, p.total);
      }));
      offs.push(channel.onBroadcast("reaction", (payload) => {
        const p = payload as { messageId: string; emoji: string; userId: string; op: "add" | "remove" };
        applyReaction(p.messageId, p.emoji, p.userId, p.op);
        // Blip when ANOTHER member reacts - same opt-in rule as new messages.
        if (p.op === "add" && p.userId !== me?.id) playSfx("reaction");
      }));
      offs.push(channel.onBroadcast("typing", (payload) => {
        const p = payload as { userId: string; name: string };
        if (p.userId === me?.id) return;
        setTypers((t) => ({ ...t, [p.userId]: { name: p.name, until: Date.now() + 4000 } }));
      }));

      offs.push(channel.onPresence((state) => {
        // Build the live "who's online" list, de-duped by user id (a member
        // open in two tabs counts once). Entries without a user id fall back to
        // their presence key - stable per client, so guests are counted once.
        const seen = new Map<string, PresenceMember>();
        for (const [presenceKey, list] of Object.entries(state)) {
          for (const e of list) {
            const id = (e.id as string) || presenceKey;
            if (!seen.has(id)) {
              seen.set(id, {
                id,
                name: (e.name as string) ?? "Guest",
                image: (e.image as string | null) ?? null,
                username: (e.username as string | null) ?? null,
              });
            }
          }
        }
        const arr = [...seen.values()];
        setMembers(arr);
        setOnline(arr.length);
      }));

      offs.push(channel.onStatus((status, err) => {
        if (cancelled) return;
        const ok = status === "SUBSCRIBED";
        setLive(ok);
        liveRef.current = ok;
        if (ok) {
          retries = 0;
          setLiveError(null);
          const self = meRef.current;
          channel.track({
            at: Date.now(),
            id: self?.id,
            name: self?.name ?? "Guest",
            image: self?.image ?? null,
            username: self?.username ?? null,
          });
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          // Record WHY, not just that it failed - "Reconnecting..." on its own
          // looks identical whether the anon key is wrong, the project is
          // paused, the connection cap is hit, or the network blinked.
          const reason = err instanceof Error ? err.message : err ? String(err) : status;
          setLiveError(reason);
          console.error(
            `[chat] realtime channel "${CHANNEL}" -> ${status}${reason && reason !== status ? `: ${reason}` : ""}. ` +
              `Falling back to polling; messages arrive within ~10s and the online ` +
              `count switches to the server heartbeat.`
          );
          // Do NOT blank the roster - keep the last known list and ask the
          // server for the truth immediately.
          void beatRef.current?.();
          void tickRef.current?.();
          retries += 1;
        }
      }));

      channelRef.current = channel;
      teardownRef = () => {
        offs.forEach((off) => off());
        channel.release();
        channelRef.current = null;
        setLive(false);
        liveRef.current = false;
      };
    }

    // Polling. Always armed - see the note on this effect. While the
    // realtime channel is healthy every tick costs nothing but a boolean read,
    // so a working room issues zero extra requests; the moment the channel is
    // not SUBSCRIBED this is what keeps messages flowing.
    // `force` is used by the wake path below. A socket that survived a frozen
    // tab can come back apparently healthy while having silently dropped
    // everything broadcast in between - broadcast has no replay - so trusting
    // `liveRef` on the way back in is how a room quietly stays a few messages
    // behind. One reconcile on return settles it.
    // A socket that is SUBSCRIBED is not proof that broadcasts are arriving -
    // and when they silently are not, `liveRef` skipping the poll means the
    // room never catches up at all. So the poll is skipped only for a bounded
    // stretch: once a minute it reconciles even on a healthy channel. That is
    // one extra request per minute per open room, which is the cheapest
    // insurance available against the room being confidently wrong.
    let lastReconcile = 0;
    const SAFETY_RECONCILE_MS = 60_000;

    const tick = async (force = false) => {
      if (document.hidden) return;
      const now = Date.now();
      if (liveRef.current && !force && now - lastReconcile < SAFETY_RECONCILE_MS) return;
      lastReconcile = now;
      try {
        const res = await fetch("/api/chat/messages", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.messages) {
          // Say so. A 503 here means the server cannot read the room - the
          // messages on screen are frozen, and pretending otherwise is what
          // turned a server problem into "the chat is broken and refreshing
          // is the only thing that works".
          setPollError(res.ok ? "malformed response" : `HTTP ${res.status}`);
          return;
        }
        setPollError(null);
        const fresh = (data.messages as Message[]).map((m) => ({
          ...m,
          reactions: normalizeReactions(m.reactions),
        }));

        // ⚠️ These side effects used to run INSIDE the `setMessages` updater
        // below. An updater must be pure - React is free to invoke it more than
        // once for a single update - and this one bumped the unread counter,
        // wrote a ref, and played a sound. Two invocations meant the badge
        // counted every new message twice and the blip played twice.
        //
        // `reconcilePoll` is pure and cheap, so the honest fix is to run it
        // again here, where side effects are legal. The mirror ref is the same
        // base `loadOlder` already trusts for exactly this reason.
        const { incoming } = reconcilePoll(messagesRef.current, fresh);
        if (incoming.length && !stickRef.current) {
          setUnread((u) => u + incoming.length);
          if (!firstUnreadRef.current && incoming[0]) {
            firstUnreadRef.current = incoming[0].id;
            setFirstUnreadId(incoming[0].id);
          }
        }
        // Blip for messages from others, same as the realtime path.
        if (incoming.some((m) => m.userId !== meRef.current?.id)) playSfx("receive");

        setMessages((prev) => {
          // Pure reconcile (unit-tested in chat-view): refresh edits/reactions
          // on known messages, infer deletions inside the fetched window, and
          // split out genuinely new messages. Against `prev`, so the merge
          // itself cannot miss a message that landed over realtime since the
          // ref was last synced.
          const r = reconcilePoll(prev, fresh);
          return r.incoming.length ? [...r.merged, ...r.incoming] : r.merged;
        });
      } catch (e) {
        setPollError(e instanceof Error ? e.message : "network");
      }
    };
    tickRef.current = tick;
    const pollTimer = setInterval(tick, CHAT_POLL_MS);

    // Server-backed presence. Realtime presence is the nice path; this is the
    // dependable one. It runs on its own interval regardless of the channel
    // state, because the online count reading 0 in a room full of people is
    // precisely what happens when the WebSocket does not connect - and that is
    // the failure the owner reported.
    //
    // When realtime IS live its presence sync is authoritative and overwrites
    // this on every join/leave, so the two do not fight: this only fills the
    // gap. Signed-in only - the endpoint requires a session, and anonymous
    // visitors get the read-only preview anyway.
    const beat = async () => {
      if (document.hidden || !meRef.current) return;
      // Skip the REQUEST, not just the result. The first version of this checked
      // `liveRef` after the fetch had already happened, so every open room paid
      // a round trip every 45s purely to throw the answer away - on a project
      // that is over its Supabase egress quota. Realtime presence is exact when
      // the channel is up; this only needs to run when it is not.
      if (liveRef.current) return;
      try {
        const res = await fetch("/api/chat/presence", { method: "POST", cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        const payload = data?.data ?? data;
        const list = payload?.members;
        setPresenceError(typeof payload?.degraded === "string" ? payload.degraded : null);
        if (!Array.isArray(list)) return;
        if (liveRef.current) return; // recovered while in flight
        setMembers(list as PresenceMember[]);
        setOnline(list.length);
      } catch {
        /* transient - keep the last known list */
      }
    };
    beatRef.current = beat;
    void beat();
    // 15s, down from 25s (and 45s before that). This is the roster's refresh
    // rate whenever realtime is down, and 25s meant someone joining took up to
    // 25 seconds to appear - long enough to read as "the online count is not
    // live", which is what was reported. It costs nothing on a healthy
    // deployment: `beat` returns before the fetch while the channel is up, so
    // this interval only spends requests on the broken path. The server window
    // is 60s, so four missed beats absorb a blip without leaving a ghost.
    const beatTimer = setInterval(beat, 15_000);

    // Say goodbye. Without this the ONLY way to stop being listed was for the
    // server window to expire, so closing the tab left you "online" for up to
    // a minute and a half - which is what made the count look fake.
    //
    // sendBeacon, not fetch: the browser is tearing the page down and will
    // cancel an ordinary request. A beacon is queued by the browser and sent
    // regardless, and it carries cookies so the session still resolves.
    const leave = () => {
      if (!meRef.current) return;
      try {
        navigator.sendBeacon?.(
          "/api/chat/presence",
          new Blob([JSON.stringify({ leave: true })], { type: "application/json" })
        );
      } catch {
        /* nothing useful to do while unloading */
      }
    };
    // Coming back. This is the half that was missing, and it is what made the
    // room feel like it needed a manual refresh: both loops above skip while the
    // tab is hidden, and the leave beacon has just taken you OUT of the presence
    // table - so returning to the tab left you invisible and the room stale for
    // up to a full poll interval (10s for messages, 25s for the roster), with a
    // dead socket on top if the device had slept. Nothing was scheduled to fix
    // any of that any sooner.
    //
    // Now: reappear, catch up, and rebuild the channel immediately. Throttled so
    // the three events that can fire together (visibilitychange + focus +
    // online) cost one round trip, not three.
    let lastWake = 0;
    const wake = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastWake < 3_000) return;
      lastWake = now;
      void beat();      // re-register presence + refresh the roster
      void tick(true);  // catch up on messages missed while away
      if (!liveRef.current) {
        // Do not sit out the backoff after a sleep/network drop - the socket is
        // dead and the user is looking at the room right now.
        clearTimeout(retryTimer);
        retries = 0;
        void connect();
      }
    };

    // `pagehide` rather than `beforeunload`: it is the one that actually fires
    // on mobile Safari, where a tab is frozen rather than unloaded. Hiding the
    // tab counts as leaving too, since the heartbeat pauses while hidden and
    // the person would otherwise linger in the list.
    const onVisibility = () => {
      if (document.visibilityState === "hidden") leave();
      else wake();
    };
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);

    void connect();
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      clearInterval(pollTimer);
      clearInterval(beatTimer);
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
      // Navigating away inside the SPA never fires pagehide, so leave here too.
      leave();
      teardownRef?.();
    };
    // Re-subscribe only when the connection target or the signed-in identity
    // changes; profile fields (name/image/username) ride in meRef.
     
  }, [realtime.url, realtime.anonKey, me?.id, appendMessage, hideMessage, applyReaction, applyEdit, applyPinned, applyPollCounts]);

  // Close the reaction popover on any press outside it (its toggle + panel are
  // tagged data-react-ui); mirrors EmojiPicker's outside-click behaviour.
  useEffect(() => {
    if (!reactOpenId) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest?.("[data-react-ui]")) setReactOpenId(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [reactOpenId]);

  // Expire stale typing indicators (single steady interval; no-op when empty).
  useEffect(() => {
    const t = setInterval(() => {
      setTypers((prev) => {
        if (Object.keys(prev).length === 0) return prev;
        const now = Date.now();
        const next = Object.fromEntries(Object.entries(prev).filter(([, v]) => v.until > now));
        return Object.keys(next).length === Object.keys(prev).length ? prev : next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Stick to bottom unless the user scrolled up.
  useEffect(() => {
    const el = listRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, typers]);

  useEffect(() => () => { if (scrollRaf.current) cancelAnimationFrame(scrollRaf.current); }, []);

  function clearUnread() {
    setUnread(0);
    firstUnreadRef.current = null;
    setFirstUnreadId(null);
  }

  // rAF-throttled - a plain handler would setState on every native scroll
  // event while chatting (mirrors the fix already applied in ReadingProgress.tsx).
  function onScroll() {
    if (scrollRaf.current) return;
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = 0;
      const el = listRef.current;
      if (!el) return;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      setStickToBottom(nearBottom);
      if (nearBottom) clearUnread();
    });
  }

  function jumpToLatest() {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setStickToBottom(true);
    clearUnread();
  }

  function startEdit(m: Message) {
    setActionOpenId(null);
    setEditingId(m.id);
    setEditText(m.body);
  }

  async function saveEdit(id: string) {
    const text = editText.trim();
    const original = messages.find((m) => m.id === id);
    if (!text || !original || savingEdit) return;
    if (text === original.body) {
      setEditingId(null);
      return;
    }
    setSavingEdit(true);
    const prevBody = original.body;
    const prevEditedAt = original.editedAt ?? null;
    applyEdit(id, text, new Date().toISOString()); // optimistic
    setEditingId(null);
    try {
      const res = await fetch(`/api/chat/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        applyEdit(id, prevBody, prevEditedAt ?? ""); // rollback
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, editedAt: prevEditedAt } : m)));
        setError(data.error || "Could not edit the message.");
      } else {
        applyEdit(id, data.body ?? text, data.editedAt ?? new Date().toISOString());
      }
    } catch {
      applyEdit(id, prevBody, prevEditedAt ?? "");
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, editedAt: prevEditedAt } : m)));
      setError("Network error. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  }

  function sendTyping() {
    const ch = channelRef.current;
    if (!ch || !me) return;
    const now = Date.now();
    if (now - lastTyping.current < 2000) return;
    lastTyping.current = now;
    // Goes through the shared handle now - the raw channel object is owned by
    // the registry and must not be reached into from here.
    ch.send("typing", { userId: me.id, name: me.name });
  }

  // Loads one older page. Returns true when new rows were actually added (used
  // by scrollToMessage's bounded search). Reads the oldest cursor from
  // messagesRef so repeated awaited calls see fresh state, and only restores
  // scroll when something was prepended (avoids a jump on all-deduped pages).
  async function loadOlder(): Promise<boolean> {
    const current = messagesRef.current;
    if (!current.length || loadingOlder) return false;
    setLoadingOlder(true);
    const el = listRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    try {
      const res = await fetch(`/api/chat/messages?cursor=${current[0]!.id}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.messages) {
        const known = new Set(current.map((m) => m.id));
        const older = (data.messages as Message[])
          .filter((m) => !known.has(m.id))
          .map((m) => ({ ...m, reactions: normalizeReactions(m.reactions) }));
        if (older.length) {
          setMessages((prev) => [...older.filter((o) => !prev.some((p) => p.id === o.id)), ...prev]);
          requestAnimationFrame(() => {
            if (el) el.scrollTop = el.scrollHeight - prevHeight;
          });
        }
        // ⚠️ `older.length === 0` means the cursor cannot advance.
        //
        // This used to keep `hasMore` true whenever the SERVER said so and the
        // page was non-empty, even if every row in it was already on screen. A
        // page that comes back fully de-duped means the next request will use
        // the same cursor and return the same rows - so "Load older" stayed on
        // screen, and every press re-fetched the identical page forever. A
        // button that cannot ever finish its own job is worse than no button.
        //
        // Nothing new arrived, so there is no reachable history: say so.
        setHasMore(Boolean(data.hasMore) && older.length > 0);
        return older.length > 0;
      }
      return false;
    } finally {
      setLoadingOlder(false);
    }
  }

  // Send a picked GIF as its own message (body = GIF url -> rendered inline).
  async function sendGif(url: string) {
    setGifOpen(false);
    await doSend(url, true);
  }

  // Admin-only: upload a photo to storage, then send its URL as a message.
  async function onPickPhoto(file: File | undefined) {
    if (!file || photoUploading) return;
    setError("");
    setPhotoUploading(true);
    try {
      const compressed = await compressImage(file, 1280).catch(() => file);
      const fd = new FormData();
      fd.append("file", compressed);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.url) {
        setError(j?.error || "Photo upload failed.");
        return;
      }
      if (String(j.url).startsWith("data:")) {
        // Inline data URLs are too large for a chat message - needs real Storage.
        setError("Photo sharing needs a public Supabase Storage bucket named 'post-covers'. Create it in Supabase → Storage, then try again.");
        return;
      }
      await doSend(String(j.url), true);
    } catch {
      setError("Photo upload failed. Please try again.");
    } finally {
      setPhotoUploading(false);
    }
  }

  // `isMedia` sends a GIF/photo URL without touching the text the member may be
  // composing. Text comes from `RoomComposer`, which owns the draft; resolving
  // `false` tells it to give the text back.
  async function doSend(raw: string, isMedia = false): Promise<boolean> {
    const text = raw.trim();
    if (!text || sending || !me) return false;
    hapticTap(); // message committed
    // Sending is a user gesture - unlock audio here too so incoming-message
    // sounds work from the first send.
    unlockAudio();
    setError("");
    setSending(true);
    const reply = isMedia ? null : replyTarget;
    if (!isMedia) setReplyTarget(null);

    // Optimistic UI: render the message instantly with a temporary id, then
    // reconcile with the server's copy (dedup against the realtime echo).
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: Message = {
      id: tempId,
      body: text,
      createdAt: new Date().toISOString(),
      userId: me.id,
      // The sender's own details, not placeholders. `membership: "Free"` and
      // `username: null` were hardcoded here, so a Premium member's own message
      // appeared without its badge and with an unlinked avatar for the ~200ms
      // until the server copy replaced it - then both popped in. Small, but it
      // is the one message on screen whose author the client already knows.
      author: {
        name: me.name,
        username: me.username ?? null,
        image: me.image ?? null,
        membership: me.membership ?? "Free",
        role: me.isAdmin ? "ADMIN" : "USER",
      },
      replyTo: reply ? { id: reply.id, body: reply.body, authorName: reply.authorName } : null,
      reactions: [],
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    jumpToLatest();

    const rollback = () => {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      // Restore the failed reply only if the member hasn't picked another one
      // in the meantime. The TEXT is restored by RoomComposer, on `false`.
      // (Media sends never touch the composer, so nothing to restore.)
      if (!isMedia) setReplyTarget((r) => r ?? reply);
    };

    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text, replyToId: reply?.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        rollback();
        setError(data.error || "Could not send. Try again.");
        return false;
      }
      const server = data.message as Message;
      // Swap the temp message for the server copy; if the realtime echo already
      // delivered it, just drop the temp one (no duplicate).
      setMessages((prev) => {
        const without = prev.filter((m) => m.id !== tempId);
        if (without.some((m) => m.id === server.id)) return without;
        return [...without, { ...server, reactions: normalizeReactions(server.reactions) }];
      });
      jumpToLatest();
      return true;
    } catch {
      rollback();
      setError("Network error. Please try again.");
      return false;
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string) {
    // ⚠️ The snapshot is taken INSIDE the updater, not from `messages` in this
    // closure. It used to be `const snapshot = messages`, captured at the moment
    // of the click - so in a busy room, every message that arrived over realtime
    // while the DELETE was in flight was wiped by the rollback. A failed delete
    // silently rewound the room.
    let snapshot: Message[] = [];
    let pinnedSnapshot: Message | null = null;
    // No-op updaters, used only to READ the current values. `hideMessage` does
    // the actual hiding a line below - inlining its body here instead would
    // have quietly dropped the two other things it does (blanking `body`, and
    // clearing a pinned banner that points at the message being removed).
    setMessages((prev) => {
      snapshot = prev;
      return prev;
    });
    setPinned((p) => {
      pinnedSnapshot = p;
      return p;
    });
    hideMessage(id);
    const res = await fetch(`/api/chat/messages/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res || !res.ok) {
      setMessages(snapshot);
      // The banner too: `hideMessage` clears it when it pointed at this message,
      // so restoring only the list would leave a pin silently dropped.
      setPinned(pinnedSnapshot);
      // Every other mutation here (saveEdit, togglePin, vote, doSend) reports a
      // failure. This one put the message back and said nothing, so it read as
      // the delete having been undone by someone else.
      setError("Couldn't delete that message.");
    }
  }

  async function toggleReaction(messageId: string, emoji: string) {
    if (!me) return;
    hapticToggle(); // reaction lands optimistically; the buzz goes with the visual flip
    playSfx("reaction");
    setReactOpenId(null);
    const msg = messages.find((m) => m.id === messageId);
    const mine = msg?.reactions.find((r) => r.emoji === emoji)?.userIds.includes(me.id) ?? false;
    const op = mine ? "remove" : "add";
    applyReaction(messageId, emoji, me.id, op); // optimistic
    const res = await fetch(`/api/chat/messages/${messageId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    }).catch(() => null);
    if (!res || !res.ok) applyReaction(messageId, emoji, me.id, mine ? "add" : "remove"); // rollback
  }

  // Vote / retract / move (Telegram semantics), optimistic with rollback.
  async function vote(m: Message, optionId: string) {
    if (!me || !m.poll || m.pending) return;
    hapticToggle(); // poll vote
    const prevPoll = m.poll;
    const from = m.poll.myVote ?? null;
    const to = from === optionId ? null : optionId; // same option again = retract
    const nextCounts = applyPollVote(
      m.poll.options.map((o) => ({ optionId: o.id, count: o.count })),
      from,
      to
    );
    const byId = new Map(nextCounts.map((c) => [c.optionId, c.count]));
    const optimistic: Poll = {
      ...m.poll,
      myVote: to,
      total: nextCounts.reduce((s, c) => s + c.count, 0),
      options: m.poll.options.map((o) => ({ ...o, count: byId.get(o.id) ?? o.count })),
    };
    const patch = (msg: Message) => (msg.id === m.id ? { ...msg, poll: optimistic } : msg);
    setMessages((prev) => prev.map(patch));
    setPinned((p) => (p ? patch(p) : p));

    const res = await fetch(`/api/chat/polls/${m.poll.id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    if (!res || !res.ok || !data) {
      const rollback = (msg: Message) => (msg.id === m.id ? { ...msg, poll: prevPoll } : msg);
      setMessages((prev) => prev.map(rollback));
      setPinned((p) => (p ? rollback(p) : p));
      setError(data?.error || "Could not record your vote.");
      return;
    }
    // Settle with server truth (counts + myVote).
    applyPollCounts(m.id, data.counts ?? [], data.total ?? optimistic.total);
    const settle = (msg: Message) =>
      msg.id === m.id && msg.poll ? { ...msg, poll: { ...msg.poll, myVote: data.myVote ?? null } } : msg;
    setMessages((prev) => prev.map(settle));
    setPinned((p) => (p ? settle(p) : p));
  }

  async function togglePin(m: Message) {
    setActionOpenId(null);
    const action = m.pinnedAt ? "unpin" : "pin";
    const res = await fetch("/api/chat/messages/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id, action }),
    }).catch(() => null);
    if (res?.ok) applyPinned(m.id, action === "pin");
    else setError("Could not update the pin.");
  }

  // Jump to a message; if it isn't loaded (reply to an older message), page
  // backwards a bounded number of times until it appears, then highlight.
  // Ref so the one-shot deep-link effect can call the latest version. Written
  // in an effect - a ref write during render is a side effect React may drop.
  useEffect(() => {
    scrollToMessageRef.current = (id: string) => scrollToMessage(id);
  });
  async function scrollToMessage(id: string) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const el = document.getElementById(`msg-${id}`);
      if (el) {
        // ⚠️ NOT `el.scrollIntoView({ block: "center" })`.
        //
        // `scrollIntoView` walks the whole ancestor chain and scrolls every
        // scrollable box it finds on the way up, and `center` means it always
        // scrolls rather than doing the minimum. The room is meant to be a
        // fixed frame - `main` is `h-[100svh] overflow-hidden` and only this
        // list scrolls - but "overflow-hidden ancestors" is not the same as
        // "nothing above can move", and the reported symptom is the page
        // jumping upward when you tap a reply quote or the pinned banner.
        //
        // Scrolling the list directly cannot move anything outside it. The
        // maths centres the message in the list the way `center` intended.
        const list = listRef.current;
        if (list) list.scrollTo({ top: centredScrollTop(list, el), behavior: "smooth" });
        // A brief gold wash so the eye lands on it (globals.css `.msg-flash`).
        el.classList.remove("msg-flash");
        void el.offsetWidth; // restart the animation if it is already running
        el.classList.add("msg-flash");
        setTimeout(() => el.classList.remove("msg-flash"), 1700);
        return;
      }
      const added = await loadOlder();
      if (!added) return; // history exhausted or request failed
      await new Promise((r) => requestAnimationFrame(() => r(null))); // let rows render
    }
  }

  /** A link that opens the room scrolled to this message (see the `?m=` effect). */
  async function copyMessageLink(id: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/community?m=${id}`);
      setCopiedId(`link-${id}`);
      setTimeout(() => setCopiedId((c) => (c === `link-${id}` ? null : c)), 1200);
    } catch {
      /* clipboard blocked */
    }
  }

  async function copyMessage(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1200);
    } catch {
      /* clipboard blocked */
    }
  }

  // Translate a message English <-> Hinglish. Tapping again just hides/re-shows
  // the cached translation (no repeat AI call).
  async function translateMessage(id: string, text: string) {
    setActionOpenId(null);
    const cur = translations[id];
    if (cur?.text) {
      setTranslations((t) => ({ ...t, [id]: { ...cur, shown: !cur.shown } }));
      return;
    }
    if (cur?.loading) return;
    setTranslations((t) => ({ ...t, [id]: { loading: true, shown: true } }));
    try {
      const r = await fetch("/api/chat/translate", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.text) {
        setTranslations((t) => ({ ...t, [id]: { text: j.text, loading: false, shown: true } }));
      } else {
        // Keep the server's reason. It was being thrown away and replaced with
        // "Couldn't translate. Try again." - which is advice that can never
        // work when the actual answer is a 503 "Translation is not available
        // right now" because AI is switched off. Retrying forever was the only
        // thing the reader could do with the old message.
        setTranslations((t) => ({
          ...t,
          [id]: { loading: false, shown: true, text: undefined, error: j?.error || undefined },
        }));
      }
    } catch {
      setTranslations((t) => ({ ...t, [id]: { loading: false, shown: true, text: undefined } }));
    }
  }

  const typingNames = Object.values(typers).map((t) => t.name);
  const typingLabel =
    typingNames.length === 0
      ? ""
      : typingNames.length === 1
        ? `${typingNames[0]} is typing…`
        : typingNames.length === 2
          ? `${typingNames[0]} and ${typingNames[1]} are typing…`
          : `${typingNames.length} people are typing…`;

  let lastDay = "";

  // dvh (where supported) tracks the *visible* viewport, so the composer
  // stays above the mobile keyboard instead of being pushed off-screen.
  // Messages that @mention me stand out in a busy room.
  const myHandle = me?.username?.toLowerCase() ?? "";
  const mentionsMe = (body: string) =>
    !!myHandle && new RegExp(`(^|[^\\w])@${myHandle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w])`, "i").test(body);

  // Search over what is loaded. Polls and photos have no searchable text.
  const searchQuery = searchQ.trim().toLowerCase();
  const searchMatches = searchQuery
    ? messages
        .filter((m) => !m.hidden && m.kind !== "poll" && !mediaLabel(m.body) && m.body.toLowerCase().includes(searchQuery))
        .map((m) => m.id)
    : [];
  const searchMatchSet = new Set(searchMatches);
  const goToMatch = (dir: -1 | 1) => {
    if (!searchMatches.length) return;
    const cur = matchIdx < 0 || matchIdx >= searchMatches.length ? searchMatches.length : matchIdx;
    const next = (cur + dir + searchMatches.length) % searchMatches.length;
    setMatchIdx(next);
    void scrollToMessage(searchMatches[next]!);
  };
  const closeSearch = () => { setSearchOpen(false); setSearchQ(""); setMatchIdx(-1); };

  /** Reply to a message and put the caret in the composer. */
  const replyTo = (m: Message) => {
    setActionOpenId(null);
    setReplyTarget({ id: m.id, body: mediaLabel(m.body) ?? m.body.slice(0, 80), authorName: m.author.name ?? (m.author.username ? `@${m.author.username}` : "Member") });
    setComposerFocus((t) => t + 1);
  };

  return (
    // Edge to edge on a phone - the page is the app - and a framed room from `sm` up.
    <div
      data-chat-surface="room"
      {...feelAttrs(feel)}
      onPointerDownCapture={chatPressFeedback}
      className="glass relative flex h-full min-h-[420px] flex-col overflow-hidden max-sm:rounded-none max-sm:border-0 sm:rounded-3xl"
    >
      {/* Ambient futuristic glow behind the room. */}
      <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[130%] -translate-x-1/2 rounded-full bg-mint-500/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-28 right-0 h-56 w-72 rounded-full bg-gold-500/10 blur-3xl" />

      {/* ── The chosen background ──────────────────────────────────────────
          A preset, or the member's own photo under a COMPUTED scrim - see
          `ChatWallpaper` and `chat-wallpaper.ts`. Static: it sits behind a
          scrolling list, and anything animated here would repaint on every
          frame of every scroll. The same component draws the live preview in
          the appearance sheet, so the two can never disagree. */}
      <ChatWallpaper
        choice={appearance.choice}
        photo={appearance.photo}
        settings={appearance.settings}
        className="absolute inset-0"
      />

      {/* ── Header ─────────────────────────────────────────────────────────
          The room's name and a "LIVE" label used to lead this row. Neither
          told a member anything - they know which room they are in - and on a
          phone the title wrapped onto two lines and the label ran into the
          next button (the owner's screenshot). The row now leads with the
          site menu (this page has no site header any more) and who is here,
          and every tool is the same 40px control (CHAT_ICON_BTN) instead of
          three different button styles side by side.

          Connection state is not gone, it moved: it is the dot on the
          presence pill, with the full explanation in its tooltip, and the one
          state that must never be dressed up - "Stale", when the poll is
          failing and the messages on screen are frozen - still prints in
          amber words. */}
      <div className={cn("relative z-20 flex items-center gap-1.5 border-b border-hairline px-2 py-2 sm:gap-2 sm:px-3", CHAT_BAR)}>
        <AppMenu />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {members.length > 0 && (
            <div className="hidden -space-x-2 sm:flex">
              {members.slice(0, 3).map((m) =>
                m.username ? (
                  <Link
                    key={m.id}
                    href={`/u/${m.username}`}
                    title={m.name}
                    className="transition-transform duration-200 hover:z-10 hover:-translate-y-0.5 active:-translate-y-0.5"
                  >
                    <Avatar name={m.name} image={m.image} size="sm" className="ring-2 ring-ink-900" />
                  </Link>
                ) : (
                  <span key={m.id} title={m.name}>
                    <Avatar name={m.name} image={m.image} size="sm" className="ring-2 ring-ink-900" />
                  </span>
                )
              )}
              {members.length > 3 && (
                <button
                  onClick={() => setMembersOpen(true)}
                  title="See everyone online"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink-700 text-[10px] font-semibold text-zinc-300 ring-2 ring-ink-900 transition-colors hover:bg-ink-600 hover:text-zinc-100"
                >
                  +{members.length - 3}
                </button>
              )}
            </div>
          )}
          <div className="relative min-w-0">
            <button
              onClick={() => members.length && setMembersOpen((v) => !v)}
              aria-expanded={membersOpen}
              disabled={!members.length}
              // The reason rides along as a tooltip - a hover (or a
              // long-press) answers "why?" instead of a dead-end label.
              title={
                pollError
                  ? `The server is not returning messages (${pollError}). What you see is frozen at the last successful load - new messages are NOT arriving. Retrying every 10s.`
                  : live
                    ? "Live via Supabase Realtime"
                    : realtimeConfigured
                      ? `Realtime unavailable${liveError ? `: ${liveError}` : ""}. Messages arrive on the 10s poll and the online count comes from the server heartbeat every 15s.${presenceError ? ` PRESENCE PROBLEM: ${presenceError}` : ""}`
                      : "Realtime is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY). Messages refresh by polling."
              }
              className="inline-flex h-9 max-w-full items-center gap-2 rounded-full bg-mint-500/10 px-3 text-[13px] font-semibold text-mint-200 ring-1 ring-mint-500/25 transition-colors hover:bg-mint-500/20 disabled:cursor-default"
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className={cn("absolute inline-flex h-full w-full rounded-full", pollError ? "bg-amber-400" : live ? "animate-pulse-dot bg-mint-400" : "bg-zinc-500")} />
                <span className={cn("relative inline-flex h-2 w-2 rounded-full", pollError ? "bg-amber-400" : live ? "bg-mint-400" : "bg-zinc-500")} />
              </span>
              <span className="truncate">{online} online</span>
              <span className="sr-only">{pollError ? "Stale" : live ? "Live" : "Synced"}</span>
            </button>
            {membersOpen && members.length > 0 && (
              <>
                <button className="fixed inset-0 z-40 cursor-default" aria-label="Close" onClick={() => setMembersOpen(false)} />
                <div className="app-fade-in absolute left-0 top-full z-50 mt-2 max-h-80 w-64 overflow-y-auto rounded-2xl border border-white/10 bg-ink-900 p-2 shadow-elevate">
                  <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Online now · {members.length}</p>
                  {members.map((m) => {
                    const inner = (
                      <>
                        <Avatar name={m.name} image={m.image} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">{m.name}</span>
                        {m.id === me?.id && <span className="shrink-0 text-[10px] text-zinc-500">you</span>}
                      </>
                    );
                    return m.username ? (
                      <Link key={m.id} href={`/u/${m.username}`} onClick={() => setMembersOpen(false)} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/5">
                        {inner}
                      </Link>
                    ) : (
                      <div key={m.id} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">{inner}</div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          {pollError && <span className="mono shrink-0 text-[10px] uppercase tracking-wider text-amber-300/90">Stale</span>}
        </div>

        <button
          type="button"
          onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
          aria-label="Search messages"
          aria-expanded={searchOpen}
          title="Search messages"
          className={CHAT_ICON_BTN}
        >
          <Search className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </button>
        {/* A per-device display preference, so there is nothing to gate:
            any member in the room can use it. */}
        <button
          type="button"
          onClick={() => setAppearanceOpen(true)}
          aria-label="Chat appearance"
          aria-haspopup="dialog"
          title="Chat appearance"
          className={CHAT_ICON_BTN}
        >
          <Palette className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </button>
        {/* Phone push alerts for the lounge (reuses the Web Push infra). */}
        {me && <NewsAlertsToggle loggedIn compact title="Get a phone notification when the lounge is active" />}
        <button
          type="button"
          onClick={toggleSound}
          aria-label={soundOn ? "Mute message sounds" : "Enable message sounds"}
          aria-pressed={soundOn}
          title={soundOn ? "Sounds on" : "Sounds off"}
          className={cn(CHAT_ICON_BTN, "max-[359px]:hidden")}
        >
          {soundOn ? <Volume2 className="h-[18px] w-[18px]" /> : <VolumeX className="h-[18px] w-[18px]" />}
        </button>
      </div>

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
              placeholder="Search loaded messages"
              aria-label="Search loaded messages"
              className="h-10 min-w-0 flex-1 bg-transparent text-base text-zinc-100 outline-none placeholder:text-zinc-600 sm:text-sm"
            />
            {searchQuery && (
              <span className="mono shrink-0 text-[11px] text-zinc-500" aria-live="polite">
                {searchMatches.length === 0 ? "No matches" : `${matchIdx < 0 ? searchMatches.length : matchIdx + 1} of ${searchMatches.length}`}
              </span>
            )}
          </div>
          <button type="button" onClick={() => goToMatch(-1)} disabled={!searchMatches.length} aria-label="Older match" className={cn(CHAT_ICON_BTN, "disabled:opacity-30")}>
            <ChevronUp className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => goToMatch(1)} disabled={!searchMatches.length} aria-label="Newer match" className={cn(CHAT_ICON_BTN, "disabled:opacity-30")}>
            <ChevronDown className="h-5 w-5" />
          </button>
          <button type="button" onClick={closeSearch} aria-label="Close search" className={CHAT_ICON_BTN}>
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Pinned message banner (latest pin; tap to jump) */}
      {pinned && !pinned.hidden && (
        <div className="relative z-[1] flex items-center gap-2 border-b border-gold-500/20 bg-gold-500/[0.06] px-3 py-2 sm:px-4">
          <Pin className="h-3.5 w-3.5 shrink-0 text-gold-300" />
          <button
            onClick={() => scrollToMessage(pinned.id)}
            className="min-w-0 flex-1 truncate text-left text-[12px] text-zinc-300 hover:text-gold-100"
            title="Jump to pinned message"
          >
            <span className="font-medium text-gold-200">{pinned.author.name ?? "Member"}:</span>{" "}
            {pinned.kind === "poll" ? `📊 ${pinned.poll?.question ?? pinned.body}` : pinned.body}
          </button>
          {me?.isAdmin && (
            <button
              onClick={() => togglePin(pinned)}
              className="shrink-0 rounded p-1 text-zinc-500 hover:text-zinc-200"
              aria-label="Unpin"
              title="Unpin"
            >
              <PinOff className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* messages */}
      <div ref={listRef} onScroll={onScroll} className="relative z-[1] flex-1 overflow-y-auto px-3 py-4 sm:px-4">
        {hasMore && (
          <div className="mb-4 text-center">
            <button onClick={loadOlder} disabled={loadingOlder} className="btn-ghost !px-4 !py-1.5 text-xs disabled:opacity-60">
              {loadingOlder ? "Loading…" : "Load older messages"}
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <div className="py-16 text-center">
            <div className="mb-3 text-3xl">👋</div>
            <p className="text-sm text-zinc-400">No messages yet - be the first to say gm.</p>
            <p className="mt-1 text-xs text-zinc-600">Markets, alpha &amp; Web3 - keep it friendly.</p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const day = dayLabel(m.createdAt, hydrated);
            const showDay = day !== lastDay;
            lastDay = day;
            const grouped =
              !showDay &&
              prev &&
              prev.userId === m.userId &&
              !m.replyTo &&
              new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < GROUP_WINDOW_MS;
            const isPremium = m.author.membership === "Premium";
            const isTeam = m.author.role === "ADMIN";
            const canDelete = !!me && (me.isAdmin || me.id === m.userId);
            const canEdit =
              !!me && me.id === m.userId && !m.pending && !m.hidden && m.kind !== "poll" && !isMediaBody(m.body) && canEditMessage(m.createdAt);
            const actionsOpen = actionOpenId === m.id;

            // Session-local tombstone for a removed message (keeps context).
            if (m.hidden) {
              return (
                <div key={m.id} id={`msg-${m.id}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                  <div className="w-9 shrink-0" />
                  <p className="text-[13px] italic text-zinc-600">Message removed.</p>
                </div>
              );
            }

            return (
              <div key={m.id}>
                {showDay && (
                  <div className="my-4 flex justify-center">
                    <span className="mono rounded-full bg-ink-900/95 px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-400 shadow-md shadow-black/30 ring-1 ring-white/10">
                      {day}
                    </span>
                  </div>
                )}
                {firstUnreadId === m.id && (
                  <div className="my-3 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wider text-gold-300">
                    <span className="h-px flex-1 bg-gold-500/30" />
                    New messages
                    <span className="h-px flex-1 bg-gold-500/30" />
                  </div>
                )}
                {/* Swipe right to reply and double-tap for ❤️, on touch - the
                    gestures every messenger has taught people. Desktop keeps
                    double-click for ❤️ and the hover bar; both have buttons. */}
                <SwipeBubble
                  disabled={!me || m.pending || editingId === m.id}
                  onReply={() => replyTo(m)}
                  onDoubleTap={touchUi ? () => toggleReaction(m.id, "❤️") : undefined}
                >
                <motion.div
                  id={`msg-${m.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  onDoubleClick={(e) => {
                    // Desktop-only shortcut: on touch, dblclick fights the
                    // browser's double-tap zoom - ❤️ lives in the tap menu there.
                    // Never from a control inside the message (play, speed,
                    // a link): double-clicking THAT is not a reaction.
                    if (fromControl(e.target)) return;
                    if (!touchUi && me && !m.pending) toggleReaction(m.id, "❤️");
                  }}
                  onClick={(e) => {
                    // A tap on a control inside the message (play, speed, a
                    // link, a poll option) is that control's, not "open the
                    // actions" - it used to do both.
                    if (fromControl(e.target)) return;
                    if (touchUi && me && !m.pending) setActionOpenId((id) => (id === m.id ? null : m.id));
                  }}
                  className={cn(
                    "group relative flex items-start gap-3 rounded-xl px-2.5 transition-colors hover:bg-white/[0.035]",
                    grouped ? "py-[var(--chat-row-tight)]" : "py-[var(--chat-row)]",
                    m.userId === me?.id && "chat-own",
                    m.userId !== me?.id && mentionsMe(m.body) && "chat-mention",
                    m.pending && "opacity-85",
                    searchMatchSet.has(m.id) && "ring-2 ring-inset ring-gold-400/60"
                  )}
                >
                  <div className="w-9 shrink-0">
                    {!grouped ? (
                      m.author.username ? (
                        <Link href={`/u/${m.author.username}`}>
                          <Avatar name={m.author.name} image={m.author.image} size="sm" />
                        </Link>
                      ) : (
                        <Avatar name={m.author.name} image={m.author.image} size="sm" />
                      )
                    ) : (
                      // Grouped rows reveal their timestamp in the gutter on
                      // hover (desktop) or while the tap menu is open (touch).
                      <span
                        className={cn(
                          "mt-0.5 hidden text-[9px] leading-4 text-zinc-600 group-hover:inline",
                          actionsOpen && "inline"
                        )}
                      >
                        {clockTime(m.createdAt, hydrated).replace(" ", "")}
                      </span>
                    )}
                  </div>

                  {/* Capped at a reading measure: on a wide desktop a message used
                      to run ~1000px across, far past a comfortable line length. */}
                  <div className="min-w-0 max-w-[46rem] flex-1">
                    {!grouped && (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {m.author.username ? (
                          <Link href={`/u/${m.author.username}`} className="text-[13px] font-semibold text-zinc-100 hover:text-gold-200">
                            {m.author.name ?? `@${m.author.username}`}
                          </Link>
                        ) : (
                          <span className="text-[13px] font-semibold text-zinc-100">{m.author.name ?? "Member"}</span>
                        )}
                        {isTeam && <Badge tone="mint" className="!px-1.5 !py-0">Team</Badge>}
                        {isPremium && !isTeam && <Badge tone="gold" className="!px-1.5 !py-0">★</Badge>}
                        <span
                          className="text-[11px] text-zinc-600"
                          // The full date on hover / long-press. Only after
                          // hydration: the reader's zone is client-only.
                          title={hydrated && !m.pending ? new Date(m.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : undefined}
                        >
                          {m.pending
                            ? "sending…"
                            : clockTime(m.createdAt, hydrated)}
                        </span>
                      </div>
                    )}

                    {/* reply quote */}
                    {m.replyTo && (
                      <button
                        onClick={() => scrollToMessage(m.replyTo!.id)}
                        className="mb-1 flex max-w-full items-center gap-1.5 rounded-lg border-l-2 border-gold-500/40 bg-white/[0.03] px-2 py-1 text-left"
                      >
                        <Reply className="h-3 w-3 shrink-0 text-gold-400" />
                        <span className="truncate text-[11px] text-zinc-500">
                          <span className="text-gold-200">{m.replyTo.authorName}</span> · {mediaLabel(m.replyTo.body) ?? m.replyTo.body}
                        </span>
                      </button>
                    )}

                    {m.kind === "poll" && m.poll ? (
                      <PollBlock poll={m.poll} canVote={!!me && !m.pending} onVote={(optionId) => vote(m, optionId)} />
                    ) : editingId === m.id ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value.slice(0, MAX_LENGTH))}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setEditingId(null);
                            if (e.key === "Enter" && !e.shiftKey && !touchUi) {
                              e.preventDefault();
                              saveEdit(m.id);
                            }
                          }}
                          rows={2}
                          autoFocus
                          className="w-full resize-none rounded-lg border border-gold-500/40 bg-ink-700/60 px-3 py-2 text-base text-zinc-100 outline-none focus:ring-2 focus:ring-gold-500/20 sm:text-sm"
                        />
                        <div className="mt-1 flex items-center gap-3 text-[11px]">
                          <button onClick={() => saveEdit(m.id)} disabled={savingEdit} className="font-medium text-gold-200 hover:text-gold-100 disabled:opacity-50">
                            {savingEdit ? "Saving…" : "Save"}
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-zinc-500 hover:text-zinc-300">
                            Cancel
                          </button>
                          <span className="ml-auto text-zinc-600">esc to cancel · enter to save</span>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <MessageBody text={m.body} />
                        {m.editedAt && (
                          <span className="mono text-[10px] text-zinc-600" title={new Date(m.editedAt).toLocaleString("en-US")}>
                            (edited)
                          </span>
                        )}
                        {translations[m.id]?.shown && (
                          <div className="mt-1.5 rounded-lg border-l-2 border-mint-500/40 bg-mint-500/[0.06] px-2.5 py-1.5 text-[13px] leading-relaxed text-zinc-200">
                            {translations[m.id]?.loading ? (
                              <span className="inline-flex items-center gap-1.5 text-zinc-400"><Loader2 className="h-3 w-3 animate-spin" /> Translating…</span>
                            ) : translations[m.id]?.text ? (
                              <>
                                <span className="mono mr-1.5 text-[10px] uppercase tracking-wide text-mint-300/80">Translation</span>
                                {translations[m.id]!.text}
                              </>
                            ) : (
                              <span className="text-zinc-500">
                                {translations[m.id]?.error ?? "Couldn't translate. Try again."}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* reactions */}
                    {m.reactions.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {REACTIONS.filter((e) => m.reactions.some((r) => r.emoji === e)).map((emoji) => {
                          const r = m.reactions.find((x) => x.emoji === emoji)!;
                          const mine = !!me && r.userIds.includes(me.id);
                          return (
                            <motion.button
                              key={emoji}
                              initial={{ scale: 0.6, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              onClick={() => toggleReaction(m.id, emoji)}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[12px] transition-colors",
                                mine ? "border-gold-500/40 bg-gold-500/15 text-gold-100" : "border-line bg-white/5 text-zinc-300 hover:bg-white/10"
                              )}
                            >
                              <span>{emoji}</span>
                              <span className="mono text-[11px]">{r.userIds.length}</span>
                            </motion.button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Action bar: hover-revealed on pointer devices; on touch it
                      opens by tapping the message (no hover exists, and an
                      always-on bar overlapped message text). */}
                  {me && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        "absolute -top-3 right-2 flex items-center gap-0.5 rounded-lg border border-line bg-ink-800/95 p-0.5 shadow-elevate backdrop-blur transition-opacity",
                        touchUi
                          ? actionsOpen
                            ? "pointer-events-auto opacity-100"
                            : "pointer-events-none opacity-0"
                          : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100"
                      )}
                    >
                      <div className="relative" data-react-ui>
                        <button
                          onClick={() => setReactOpenId((id) => (id === m.id ? null : m.id))}
                          className={cn("rounded text-zinc-400 transition-colors hover:bg-white/10 hover:text-gold-200", touchUi ? "grid h-11 w-11 place-items-center" : "p-1.5")}
                          aria-label="React"
                        >
                          <Smile className="h-3.5 w-3.5" />
                        </button>
                        <AnimatePresence>
                          {reactOpenId === m.id && (
                            <motion.div
                              initial={{ opacity: 0, y: 6, scale: 0.9 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 6, scale: 0.9 }}
                              transition={{ duration: 0.14 }}
                              className="absolute bottom-full right-0 z-20 mb-1 flex max-w-[88vw] flex-wrap gap-0.5 rounded-2xl border border-line bg-ink-900 px-1.5 py-1 shadow-elevate"
                            >
                              {REACTIONS.map((e) => (
                                <button key={e} onClick={() => toggleReaction(m.id, e)}
                                  className="text-base transition-transform hover:scale-125">
                                  {e}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      {touchUi && (
                        <button
                          onClick={() => {
                            setActionOpenId(null);
                            toggleReaction(m.id, "❤️");
                          }}
                          className={cn("rounded text-zinc-400 transition-colors hover:bg-white/10 hover:text-red-300", touchUi ? "grid h-11 w-11 place-items-center" : "p-1.5")}
                          aria-label="Love"
                        >
                          <Heart className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => replyTo(m)}
                        className={cn("rounded text-zinc-400 transition-colors hover:bg-white/10 hover:text-gold-200", touchUi ? "grid h-11 w-11 place-items-center" : "p-1.5")}
                        aria-label="Reply"
                      >
                        <Reply className="h-3.5 w-3.5" />
                      </button>
                      {m.author.username && m.userId !== me?.id && (
                        <MessageButton username={m.author.username} compact className="rounded text-zinc-400 hover:bg-white/10 hover:text-gold-200" />
                      )}
                      {/* ⚠️ Report is shown only to a signed-in member, and
                          never on your own message - the server enforces both
                          independently, this only hides a control that would
                          be refused. It is NOT destructive and does not hide
                          anything: a self-service hide would let any member
                          silence any other. */}
                      {me && m.userId !== me.id && !m.pending && (
                        <button
                          onClick={() => {
                            setActionOpenId(null);
                            setReporting({
                              id: m.id,
                              preview: mediaLabel(m.body) ?? m.body.slice(0, 120),
                            });
                          }}
                          className={cn(
                            "rounded text-zinc-400 transition-colors hover:bg-white/10 hover:text-amber-300",
                            // ⚠️ 44px on touch. The whole action row was
                            // `p-1.5` around a 14px icon - a ~26px target,
                            // well under the 44px minimum, sitting next to
                            // Delete on some rows. On a phone that is a
                            // mis-tap waiting to happen.
                            touchUi ? "grid h-11 w-11 place-items-center" : "p-1.5"
                          )}
                          aria-label="Report this message"
                          title="Report"
                        >
                          <Flag className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canEdit && (
                        <button
                          onClick={() => startEdit(m)}
                          className={cn("rounded text-zinc-400 transition-colors hover:bg-white/10 hover:text-gold-200", touchUi ? "grid h-11 w-11 place-items-center" : "p-1.5")}
                          aria-label="Edit"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {me?.isAdmin && !m.pending && (
                        <button
                          onClick={() => togglePin(m)}
                          className="rounded p-1.5 text-zinc-400 hover:bg-white/10 hover:text-gold-200"
                          aria-label={m.pinnedAt ? "Unpin" : "Pin"}
                          title={m.pinnedAt ? "Unpin" : "Pin"}
                        >
                          {m.pinnedAt ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                        </button>
                      )}
                      {!m.pending && !mediaLabel(m.body) && (
                        <button
                          onClick={() => translateMessage(m.id, m.body)}
                          className={cn(
                            "rounded p-1.5 hover:bg-white/10 hover:text-mint-200",
                            translations[m.id]?.shown ? "text-mint-300" : "text-zinc-400"
                          )}
                          aria-label="Translate"
                          title="Translate (English ⇄ Hinglish)"
                        >
                          <Languages className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => copyMessage(m.id, m.body)} className="rounded p-1.5 text-zinc-400 hover:bg-white/10 hover:text-gold-200" aria-label="Copy">
                        {copiedId === m.id ? <Check className="h-3.5 w-3.5 text-mint-300" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                      {!m.pending && (
                        <button onClick={() => void copyMessageLink(m.id)} className="rounded p-1.5 text-zinc-400 hover:bg-white/10 hover:text-gold-200" aria-label="Copy link to message" title="Copy link to message">
                          {copiedId === `link-${m.id}` ? <Check className="h-3.5 w-3.5 text-mint-300" /> : <Link2 className="h-3.5 w-3.5" />}
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => remove(m.id)} className="rounded p-1.5 text-zinc-400 hover:bg-white/10 hover:text-red-300" aria-label="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
                </SwipeBubble>
              </div>
            );
          })}
        </AnimatePresence>

        {/* typing indicator */}
        <AnimatePresence>
          {typingLabel && (
            <motion.div
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-1 flex items-center gap-2 px-2 py-1 text-[12px] text-zinc-500"
            >
              <span className="flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-mint-400"
                    animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
                ))}
              </span>
              {typingLabel}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* jump to latest */}
      <AnimatePresence>
        {!stickToBottom && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
            onClick={jumpToLatest}
            className="absolute bottom-[5.5rem] right-4 z-20 inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/95 px-3.5 py-2 text-xs font-semibold text-zinc-800 shadow-elevate backdrop-blur transition-colors hover:text-mint-600 dark:border-white/10 dark:bg-ink-800 dark:text-zinc-100 dark:hover:text-gold-200"
          >
            <ArrowDown className="h-4 w-4" />
            {unread > 0 ? `${unread} new` : "Latest"}
          </motion.button>
        )}
      </AnimatePresence>

      {appearanceOpen && (
        <ChatAppearanceSheet
          appearance={appearance}
          theme={themeIsDark ? "dark" : "light"}
          onClose={() => setAppearanceOpen(false)}
        />
      )}

      {reporting && (
        <ReportDialog
          messageId={reporting.id}
          preview={reporting.preview}
          onClose={() => setReporting(null)}
        />
      )}

      {/* composer */}
      {/* pb: keep the composer clear of the iPhone home indicator. */}
      <div className={cn("relative z-[2] border-t border-hairline px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-3", CHAT_BAR)}>
        {me ? (
          <>
            {replyTarget && (
              <div className="app-fade-in mb-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] py-1.5 pl-3 pr-1.5">
                <Reply className="h-4 w-4 shrink-0 text-gold-300" aria-hidden />
                <button type="button" onClick={() => void scrollToMessage(replyTarget.id)} className="min-w-0 flex-1 border-l-2 border-gold-500/50 pl-2 text-left">
                  <p className="text-[12px] font-semibold text-gold-200">Replying to {replyTarget.authorName}</p>
                  <p className="truncate text-[12px] text-zinc-400">{replyTarget.body}</p>
                </button>
                <button onClick={() => setReplyTarget(null)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-white/10 hover:text-zinc-200" aria-label="Cancel reply">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {recording && (
              <div className="flex items-end gap-2">
                <VoiceRecorder
                  onCancel={() => setRecording(false)}
                  onSend={async (blob, secs) => {
                    setRecording(false);
                    setVoiceBusy(true);
                    const r = await uploadVoice(blob, secs);
                    setVoiceBusy(false);
                    if (r.body) await doSend(r.body, true);
                    else setError(r.error ?? "Couldn't send the voice message.");
                  }}
                />
              </div>
            )}
            <div className={cn(recording && "hidden")}>
            <RoomComposer
              members={members}
              meId={me.id}
              sending={sending}
              touchUi={touchUi}
              error={error}
              onSend={(text) => doSend(text)}
              onTyping={sendTyping}
              focusTick={composerFocus}
              onEditLast={() => {
                const mine = [...messages].reverse().find(
                  (x) => x.userId === me.id && !x.pending && !x.hidden && x.kind !== "poll" && !isMediaBody(x.body) && canEditMessage(x.createdAt)
                );
                if (mine) startEdit(mine);
              }}
              onCancelReply={replyTarget ? () => setReplyTarget(null) : undefined}
              leading={
                <>
                  {/* One "+" for everything you can attach (see AttachTray for
                      why a row of three buttons had to go). Photo stays
                      admin-only; GIF only when a provider is configured. */}
                  {me.isAdmin && (
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { void onPickPhoto(e.target.files?.[0]); e.target.value = ""; }}
                    />
                  )}
                  <AttachTray
                    items={[
                      { key: "poll", label: "Poll", icon: BarChart3, onSelect: () => setPollOpen(true) },
                      ...(gifEnabled ? [{ key: "gif", label: "GIF", icon: Sticker, onSelect: () => setGifOpen(true) }] : []),
                      ...(me.isAdmin ? [{ key: "photo", label: "Photo", icon: ImagePlus, busy: photoUploading, onSelect: () => photoInputRef.current?.click() }] : []),
                      ...(me.isAdmin ? [{ key: "voice", label: "Voice message", icon: VoiceIcon, busy: voiceBusy, onSelect: () => setRecording(true) }] : []),
                    ]}
                  >
                    <AnimatePresence>
                      {gifOpen && <GifPicker onPick={(url) => void sendGif(url)} onClose={() => setGifOpen(false)} />}
                    </AnimatePresence>
                  </AttachTray>
                </>
              }
            />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-between gap-2 py-1 sm:flex-row">
            <p className="text-sm text-zinc-400">Join the conversation - it&apos;s free.</p>
            <MagneticButton>
              <Link href="/login?callbackUrl=/community" className="btn-gold !py-2 text-[13px]">
                Log in to chat
              </Link>
            </MagneticButton>
          </div>
        )}
      </div>

      {/* Poll composer modal */}
      <AnimatePresence>
        {pollOpen && me && (
          <PollComposer
            onClose={() => setPollOpen(false)}
            onCreated={(msg) => {
              setPollOpen(false);
              appendMessage(msg);
              jumpToLatest();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ----------------------------- Poll UI ----------------------------- */

/**
 * The room's composer, as its own component - PR 3.
 *
 * ⚠️ The draft lives HERE, not in `ChatClient`, and that is the whole point.
 * While `body` lived in the 2,000-line room component, every keystroke
 * re-rendered every message in the room - measured at 58ms of main-thread work
 * per key with 150 messages on desktop, 230ms with the CPU throttled to a
 * mid-range phone. Typing now re-renders only this component.
 *
 * `onSend` resolves whether the server accepted the message. The draft is
 * cleared optimistically and given back on failure - unless the member has
 * already started typing something new, which is never clobbered.
 */
function RoomComposer({
  members,
  meId,
  sending,
  touchUi,
  error,
  onSend,
  onTyping,
  leading,
  focusTick,
  onEditLast,
  onCancelReply,
}: {
  /** ↑ in an empty composer: edit my newest editable message. */
  onEditLast?: () => void;
  /** Esc in the composer: drop the reply being composed. */
  onCancelReply?: () => void;
  members: PresenceMember[];
  meId: string;
  sending: boolean;
  touchUi: boolean;
  error: string;
  onSend: (text: string) => Promise<boolean>;
  onTyping: () => void;
  leading: React.ReactNode;
  /** Bumped by the room to put the caret here (swipe-to-reply, Reply). */
  focusTick: number;
}) {
  const [body, setBody] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  async function submit() {
    const text = body.trim();
    if (!text || sending) return;
    setBody("");
    const ok = await onSend(text);
    if (!ok) setBody((b) => (b.trim() ? b : text));
  }

  function send(e: { preventDefault: () => void }) {
    e.preventDefault();
    void submit();
  }

  // @mention autocomplete: when the composer ends in `@partial`, suggest online
  // members (with a public handle) to insert. Selecting replaces the token.
  const mentionMatch = body.match(/@([a-zA-Z0-9_]*)$/);
  const mentionQuery = mentionMatch ? mentionMatch[1].toLowerCase() : null;
  const mentionSuggestions =
    mentionQuery !== null
      ? members
          .filter(
            (u) =>
              u.username &&
              u.id !== meId &&
              (u.username.toLowerCase().includes(mentionQuery) || u.name.toLowerCase().includes(mentionQuery))
          )
          .slice(0, 6)
      : [];
  const composerRef = useRef<HTMLTextAreaElement>(null);

  /**
   * The composer grows with what you type.
   *
   * ⚠️ It did not. The textarea was `rows={1}` with `resize-none` and a
   * `min-h-[44px]`, and NOTHING anywhere adjusted its height - so a long
   * message scrolled inside a single 44px line. `max-h-28` was there, but a box
   * that never grows never reaches its maximum. That is the whole "long-message
   * experience is uncomfortable" report: you could type a paragraph and see one
   * line of it.
   *
   * The measurement has to happen with the height released first (`auto`),
   * because `scrollHeight` of an element with a fixed height is that height -
   * measuring without resetting reads back what you already set and the box
   * never grows a second time.
   *
   * Capped at `COMPOSER_MAX_H`: past that it scrolls internally, so a very long
   * message can never eat the message list. The cap is applied here rather than
   * in CSS so `overflowY` can be toggled with it - a `max-h` alone leaves the
   * scrollbar present at every size on some engines.
   */
  const measureComposer = useCallback(() => {
    const el = composerRef.current;
    if (!el) return;
    // ⚠️ Empty means ONE line. An empty textarea's scrollHeight includes its
    // placeholder, and on a phone the placeholder wrapped - so the empty
    // composer grew to two lines and stopped lining up with the buttons
    // beside it (the owner's screenshot). Same rule as useAutoGrow.
    if (!el.value) {
      el.style.height = "";
      el.style.overflowY = "hidden";
      return;
    }
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, COMPOSER_MAX_H);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > COMPOSER_MAX_H ? "auto" : "hidden";
  }, []);

  /**
   * ⚠️ Not only when `body` changes. A browser probe caught the EMPTY composer
   * on a phone at 76px - two lines tall - because it was measured once at
   * hydration against the server-snapshot placeholder, which is the longer
   * desktop one ("Say something… (Enter to send)") and wraps on a narrow
   * screen. `touchUi` then swapped in the short placeholder, and nothing
   * measured again until the member typed. `scrollHeight` of an empty
   * textarea includes its placeholder, so the placeholder IS a measurement
   * input and has to be a dependency.
   */
  useEffect(() => {
    measureComposer();
  }, [body, touchUi, measureComposer]);

  // Width changes re-wrap the text (rotation, window resize), so they change
  // the height the text needs. Guarded on WIDTH only: setting the height
  // changes the element's size too, and reacting to that would loop.
  useEffect(() => {
    const el = composerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let lastWidth = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== lastWidth) {
        lastWidth = el.clientWidth;
        measureComposer();
      }
    });
    ro.observe(el);
    // Web fonts change line metrics once they arrive.
    void document.fonts?.ready.then(measureComposer);
    return () => ro.disconnect();
  }, [measureComposer]);
  useEffect(() => {
    if (!focusTick) return;
    const el = composerRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [focusTick]);

  const insertMention = (username: string) => {
    setBody((b) => b.replace(/@[a-zA-Z0-9_]*$/, `@${username} `).slice(0, MAX_LENGTH));
    // Focus goes back to the composer, caret at the end. Without this the
    // focus stayed on the suggestion button - so on a phone the keyboard
    // closed the moment you picked someone, and the next thing you typed had
    // nowhere to go. In a rAF because the value has to be committed first, or
    // the caret lands at the old length.
    requestAnimationFrame(() => {
      const el = composerRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  };

  return (
    <>
      <form onSubmit={send} className="flex items-end gap-2">
        {leading}
      <div className="relative flex-1">
        <textarea
          ref={composerRef}
          value={body}
          onChange={(e) => {
            setBody(e.target.value.slice(0, MAX_LENGTH));
            onTyping();
          }}
          onKeyDown={(e) => {
            // Touch keyboards have no Shift: Enter inserts a newline
            // there and the send button submits. Desktop keeps
            // Enter-to-send / Shift+Enter for newline.
            if (e.key === "Enter" && !e.shiftKey && !touchUi) {
              e.preventDefault();
              send(e);
            }
            // Desktop shortcuts, the ones every chat app has: ↑ in an empty
            // box edits your last message, Esc drops a reply you started.
            if (e.key === "ArrowUp" && !body && onEditLast) {
              e.preventDefault();
              onEditLast();
            }
            if (e.key === "Escape" && onCancelReply) onCancelReply();
          }}
          rows={1}
          placeholder={touchUi ? "Say something…" : "Say something… (Enter to send)"}
          aria-label="Write a message"
          aria-invalid={error ? true : undefined}
          // ⚠️ No `max-h-*` here any more: the height is driven by the
          // effect above, and a CSS max-height fighting an inline
          // height is how this kind of control ends up stuck. The
          // `min-h` stays as the one-line floor.
          className="block min-h-[44px] w-full resize-none rounded-[22px] border border-white/10 bg-ink-950/60 px-4 py-2.5 pr-20 text-base leading-relaxed text-zinc-100 outline-none transition-[border-color,box-shadow] placeholder:text-zinc-600 focus:border-mint-500/50 focus:ring-2 focus:ring-mint-500/20 sm:text-sm"
        />
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className="absolute bottom-0 right-0 grid h-11 w-10 place-items-center text-zinc-500 transition-colors hover:text-gold-200"
          aria-label="Emoji"
        >
          <Smile className="h-5 w-5" />
        </button>
        <MicButton
          continuous
          size="sm"
          className="absolute bottom-1.5 right-10 !ring-0"
          onText={(t) => setBody((b) => (b ? `${b} ${t}` : t).slice(0, MAX_LENGTH))}
        />
        <AnimatePresence>
          {pickerOpen && (
            <EmojiPicker
              onPick={(emoji) => setBody((b) => (b + emoji).slice(0, MAX_LENGTH))}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </AnimatePresence>
        {mentionSuggestions.length > 0 && (
          <div className="absolute bottom-full left-0 z-30 mb-2 w-60 max-w-[80vw] overflow-hidden rounded-xl border border-line bg-ink-900 p-1 shadow-elevate">
            <p className="px-2 py-1 mono text-[10px] uppercase tracking-wider text-zinc-600">Mention</p>
            {mentionSuggestions.map((u) => (
              <button
                key={u.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (u.username) insertMention(u.username);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/10"
              >
                <Avatar name={u.name} image={u.image} size="sm" className="h-6 w-6" />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-zinc-100">{u.name}</span>
                  <span className="mono text-[10px] text-zinc-500">@{u.username}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <motion.button
        type="submit"
        disabled={sending || !body.trim()}
        whileTap={{ scale: 0.9 }}
        className="btn-primary grid h-11 w-11 shrink-0 place-items-center !rounded-full !p-0 disabled:opacity-50"
        aria-label="Send message"
      >
        {sending ? <Loader2 className="relative z-10 h-[18px] w-[18px] animate-spin !text-white" /> : <SendGlyph className="relative z-10 h-4 w-4" />}
        
      </motion.button>
    </form>
    {/* Error and character count, only when there is something to say.
        A permanent "0/500" row under the composer was a second line of
        chrome on every screen for a limit almost nobody reaches - it now
        appears in the last 100 characters, which is when it is useful. */}
    {(error || body.length > MAX_LENGTH - 100) && (
      <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-[11px]">
        <span className="text-red-300">{error}</span>
        {body.length > MAX_LENGTH - 100 && (
          <span className={cn("mono text-zinc-500", body.length > MAX_LENGTH - 50 && "text-amber-300")}>
            {body.length}/{MAX_LENGTH}
          </span>
        )}
      </div>
    )}
    </>
  );
}

function PollBlock({
  poll,
  canVote,
  onVote,
}: {
  poll: Poll;
  canVote: boolean;
  onVote: (optionId: string) => void;
}) {
  const shares = pollShares(poll.options.map((o) => ({ optionId: o.id, count: o.count })));
  return (
    <div className="mt-0.5 max-w-md rounded-xl border border-line bg-white/[0.02] p-3" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2">
        <BarChart3 className="h-3.5 w-3.5 shrink-0 text-gold-300" />
        <p className="text-[14px] font-semibold leading-snug text-zinc-100">{poll.question}</p>
      </div>
      <div className="mt-2.5 space-y-1.5">
        {poll.options.map((o) => {
          const mine = poll.myVote === o.id;
          const share = shares.get(o.id) ?? 0;
          return (
            <button
              key={o.id}
              type="button"
              disabled={!canVote}
              onClick={() => onVote(o.id)}
              title={mine ? "Tap to retract your vote" : "Vote"}
              className={cn(
                "relative block w-full overflow-hidden rounded-lg border px-3 py-2 text-left transition-colors",
                mine ? "border-gold-500/50 bg-gold-500/10" : "border-line bg-white/[0.03]",
                canVote ? "hover:border-gold-500/40" : "cursor-default"
              )}
            >
              {/* share bar behind the label */}
              <span
                aria-hidden
                className={cn("absolute inset-y-0 left-0 transition-all duration-500", mine ? "bg-gold-500/20" : "bg-white/[0.06]")}
                style={{ width: `${share}%` }}
              />
              <span className="relative flex items-center justify-between gap-2 text-[13px]">
                <span className={cn("min-w-0 truncate", mine ? "font-medium text-gold-100" : "text-zinc-200")}>
                  {mine && <Check className="mr-1 inline h-3.5 w-3.5 text-gold-300" />}
                  {o.text}
                </span>
                <span className="mono shrink-0 text-[11px] text-zinc-500">
                  {share}% · {o.count.toLocaleString("en-US")}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 mono text-[10px] text-zinc-600">
        {poll.total === 0 ? "No votes yet" : `${poll.total.toLocaleString("en-US")} vote${poll.total === 1 ? "" : "s"}`}
        {canVote ? " · tap an option to vote" : " · log in to vote"}
      </p>
    </div>
  );
}

function PollComposer({ onClose, onCreated }: { onClose: () => void; onCreated: (msg: Message) => void }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setOption = (i: number, v: string) =>
    setOptions((prev) => prev.map((o, idx) => (idx === i ? v.slice(0, 80) : o)));
  const filled = options.filter((o) => o.trim().length > 0);
  const canCreate = question.trim().length >= 3 && filled.length >= 2 && !saving;

  async function create() {
    if (!canCreate) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/chat/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim(), options: filled.map((o) => o.trim()) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not create the poll.");
        return;
      }
      onCreated(data.message as Message);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 flex items-center justify-center bg-ink-950/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.97 }}
        transition={{ duration: 0.16 }}
        className="w-full max-w-md rounded-2xl border border-line bg-ink-900/95 p-5 shadow-elevate"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-base font-semibold text-zinc-100">
            <BarChart3 className="h-4 w-4 text-gold-300" />
            Create a poll
          </h3>
          <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:text-zinc-200" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value.slice(0, 200))}
          placeholder="Ask the community…"
          autoFocus
          className="mt-4 w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-2.5 text-base text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-gold-500/50 sm:text-sm"
        />

        <div className="mt-3 space-y-2">
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={o}
                onChange={(e) => setOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                className="w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-2 text-base text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-gold-500/50 sm:text-sm"
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}
                  className="shrink-0 rounded p-1.5 text-zinc-500 hover:text-red-300"
                  aria-label={`Remove option ${i + 1}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {options.length < 8 && (
          <button
            type="button"
            onClick={() => setOptions((prev) => [...prev, ""])}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-gold-200 hover:text-gold-100"
          >
            <Plus className="h-3.5 w-3.5" /> Add option
          </button>
        )}

        {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/20">{error}</p>}

        <div className="mt-5 flex items-center justify-end gap-3">
          <button onClick={onClose} className="text-sm text-zinc-500 hover:text-zinc-300">
            Cancel
          </button>
          <button onClick={create} disabled={!canCreate} className="btn-gold !px-5 !py-2 text-[13px] disabled:opacity-50">
            {saving ? "Creating…" : "Create poll"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
