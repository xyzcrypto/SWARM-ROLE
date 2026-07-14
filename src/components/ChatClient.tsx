"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown, BarChart3, Check, Copy, Edit3, Heart, ImagePlus, Languages, Loader2, Pin, PinOff, Plus, Reply, Smile, Trash2, X, Volume2, VolumeX,
} from "lucide-react";
import { applyPollVote, canEditMessage, pollShares, reconcilePoll } from "@/lib/chat-view";
import { compressImage } from "@/lib/image";
import { chatMediaUrl } from "@/lib/chat-media";
import { SendGlyph } from "./SendGlyph";
import { GifPicker } from "./GifPicker";
import { Avatar } from "./Avatar";
import { Badge } from "./ui/primitives";
import { EmojiPicker } from "./EmojiPicker";
import { MagneticButton } from "./MagneticButton";
import { MessageButton } from "./MessageButton";
import { NewsAlertsToggle } from "./NewsAlertsToggle";
import { cn } from "@/lib/utils";
import { safeHref, cleanBareUrl } from "@/lib/links";

const MAX_LENGTH = 500;
const CHANNEL = "community";
const REACTIONS = ["👍", "❤️", "😂", "🔥", "🚀", "🎉", "👀", "💯"];
const GROUP_WINDOW_MS = 5 * 60 * 1000;

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
type Me = { id: string; isAdmin: boolean; name: string; image?: string | null; username?: string | null };
type PresenceMember = { id: string; name: string; image: string | null; username: string | null };

const normalizeReactions = (rs: { emoji: string; userIds: string[] }[]): Reaction[] =>
  rs.map((r) => ({ emoji: r.emoji, userIds: [...r.userIds] }));

/* Plain-text body with safe linkified URLs + @mention highlights (no HTML).
   A lone trusted media URL renders as an inline image/GIF instead. */
function MessageBody({ text }: { text: string }) {
  const media = chatMediaUrl(text);
  const parts = useMemo(() => text.split(/(https?:\/\/\S+|@[a-zA-Z0-9_]{3,20})/g), [text]);
  if (media) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={media}
        alt="shared media"
        loading="lazy"
        className="mt-0.5 max-h-72 w-auto max-w-full rounded-xl border border-white/10 object-contain sm:max-w-[300px]"
      />
    );
  }
  return (
    <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-zinc-200">
      {parts.map((part, i) => {
        if (/^https?:\/\//.test(part)) {
          const url = cleanBareUrl(part);
          const href = safeHref(url);
          if (href) {
            return (
              <a key={i} href={href} target="_blank" rel="noopener noreferrer nofollow"
                className="text-gold-200 underline decoration-gold-500/40 underline-offset-2 hover:text-gold-100">
                {url}
              </a>
            );
          }
        }
        if (/^@[a-zA-Z0-9_]{3,20}$/.test(part)) {
          return (
            <Link key={i} href={`/u/${part.slice(1).toLowerCase()}`} className="font-medium text-mint-300 hover:underline">
              {part}
            </Link>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 864e5);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Today";
  if (same(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Soft, asset-free "blip" for incoming messages (Web Audio). Best-effort.
// Reuses a single shared AudioContext that must be unlocked inside a user
// gesture (see ensureAudio): a context created/resumed outside a gesture stays
// "suspended" under browser autoplay policy and would play nothing.
function playBlip(ctx: AudioContext | null) {
  try {
    if (!ctx || ctx.state !== "running") return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 680;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.start(t);
    osc.stop(t + 0.24);
  } catch {
    /* audio not available / blocked */
  }
}

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
  const [messages, setMessages] = useState<Message[]>(
    initialMessages.map((m) => ({ ...m, reactions: normalizeReactions(m.reactions) }))
  );
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);
  const [online, setOnline] = useState(0);
  const [members, setMembers] = useState<PresenceMember[]>([]);
  const [typers, setTypers] = useState<Record<string, { name: string; until: number }>>({});
  const [stickToBottom, setStickToBottom] = useState(true);
  const [unread, setUnread] = useState(0);
  const [replyTarget, setReplyTarget] = useState<ReplyRef | null>(null);
  const [reactOpenId, setReactOpenId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Per-message translation (English <-> Hinglish); toggled from the action bar.
  const [translations, setTranslations] = useState<Record<string, { text?: string; loading?: boolean; shown?: boolean }>>({});
  const [soundOn, setSoundOn] = useState(false);
  // Touch UI (no hover): actions open on tap instead of hover, Enter makes a
  // newline instead of sending. Detected client-side to stay hydration-safe.
  const [touchUi, setTouchUi] = useState(false);
  const [actionOpenId, setActionOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [pinned, setPinned] = useState<Message | null>(initialPinned);
  const [pollOpen, setPollOpen] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);
  const firstUnreadRef = useRef<string | null>(null);
  const soundOnRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setTouchUi(window.matchMedia("(hover: none)").matches);
  }, []);

  const realtimeConfigured = Boolean(realtime.url && realtime.anonKey);

  // Lazily create + resume a single AudioContext. MUST be called from inside a
  // user gesture (click/keypress) - browsers keep a context "suspended" unless
  // it's unlocked by a gesture, so without this the blip is silent.
  const ensureAudio = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        audioCtxRef.current = new Ctx();
      }
      if (audioCtxRef.current.state === "suspended") void audioCtxRef.current.resume();
    } catch {
      /* audio not available / blocked */
    }
  }, []);

  // Sound preference: opt-in, persisted per device. A subtle blip plays on
  // incoming messages (never your own) when enabled.
  useEffect(() => {
    setSoundOn(localStorage.getItem("xyz:chatSound") === "1");
    return () => {
      // Release the audio device across mount/unmount cycles (client-side nav).
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
    };
  }, []);
  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);
  const toggleSound = () =>
    setSoundOn((v) => {
      const next = !v;
      localStorage.setItem("xyz:chatSound", next ? "1" : "0");
      // Unlock audio on the enabling click (a user gesture) so the very next
      // incoming message can play, and give immediate feedback that it works.
      if (next) {
        ensureAudio();
        playBlip(audioCtxRef.current);
      }
      return next;
    });

  const listRef = useRef<HTMLDivElement>(null);
  const scrollRaf = useRef(0);
  const channelRef = useRef<any>(null);
  const lastTyping = useRef(0);
  const stickRef = useRef(true);
  stickRef.current = stickToBottom;
  // Profile fields ride in a ref so a name/avatar edit doesn't tear down and
  // re-subscribe the realtime socket (only an identity change should).
  const meRef = useRef(me);
  meRef.current = me;
  // Mirror of messages for async flows (loadOlder loops) that outlive a render.
  const messagesRef = useRef<Message[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const appendMessage = useCallback((m: Message) => {
    setMessages((prev) => {
      if (prev.some((x) => x.id === m.id)) return prev;
      if (!stickRef.current) {
        setUnread((u) => u + 1);
        // First message that arrived while scrolled up ⇒ anchor for the
        // in-stream "New messages" divider.
        if (!firstUnreadRef.current) {
          firstUnreadRef.current = m.id;
          setFirstUnreadId(m.id);
        }
      }
      return [...prev, { ...m, reactions: normalizeReactions(m.reactions) }];
    });
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

  // --- Live updates: Supabase Realtime (+ presence + typing), else polling. ---
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    async function start() {
      if (realtime.url && realtime.anonKey) {
        const { createClient } = await import("@supabase/supabase-js");
        if (cancelled) return;
        const client = createClient(realtime.url, realtime.anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const channel = client.channel(CHANNEL, { config: { presence: { key: me?.id || `guest-${Math.random().toString(36).slice(2)}` } } });
        channel
          .on("broadcast", { event: "new_message" }, ({ payload }) => {
            const msg = payload as Message;
            appendMessage(msg);
            if (soundOnRef.current && msg.userId !== me?.id) playBlip(audioCtxRef.current);
          })
          .on("broadcast", { event: "message_hidden" }, ({ payload }) => hideMessage((payload as { id: string }).id))
          .on("broadcast", { event: "message_edited" }, ({ payload }) => {
            const p = payload as { id: string; body: string; editedAt: string };
            applyEdit(p.id, p.body, p.editedAt);
          })
          .on("broadcast", { event: "message_pinned" }, ({ payload }) => {
            const p = payload as { id: string; pinned: boolean };
            applyPinned(p.id, p.pinned);
          })
          .on("broadcast", { event: "poll_vote" }, ({ payload }) => {
            const p = payload as { messageId: string; counts: { optionId: string; count: number }[]; total: number };
            applyPollCounts(p.messageId, p.counts, p.total);
          })
          .on("broadcast", { event: "reaction" }, ({ payload }) => {
            const p = payload as { messageId: string; emoji: string; userId: string; op: "add" | "remove" };
            applyReaction(p.messageId, p.emoji, p.userId, p.op);
            // Blip when ANOTHER member reacts (adds an emoji) - same opt-in rule
            // as new messages; never your own reactions. "remove" is silent.
            if (soundOnRef.current && p.op === "add" && p.userId !== me?.id) playBlip(audioCtxRef.current);
          })
          .on("broadcast", { event: "typing" }, ({ payload }) => {
            const p = payload as { userId: string; name: string };
            if (p.userId === me?.id) return;
            setTypers((t) => ({ ...t, [p.userId]: { name: p.name, until: Date.now() + 4000 } }));
          })
          .on("presence", { event: "sync" }, () => {
            // Build the live "who's online" list, de-duped by user id (a member
            // open in two tabs counts once). Entries without a user id fall back
            // to their presence key - stable per client, so guests are counted
            // once instead of re-counted on every sync.
            const state = channel.presenceState() as Record<string, Array<Record<string, unknown>>>;
            const seen = new Map<string, PresenceMember>();
            for (const [presenceKey, entries] of Object.entries(state)) {
              for (const e of entries) {
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
            const list = [...seen.values()];
            setMembers(list);
            setOnline(list.length);
          })
          .subscribe((status) => {
            setLive(status === "SUBSCRIBED");
            if (status === "SUBSCRIBED") {
              const self = meRef.current;
              channel.track({
                at: Date.now(),
                id: self?.id,
                name: self?.name ?? "Guest",
                image: self?.image ?? null,
                username: self?.username ?? null,
              });
            }
          });
        channelRef.current = channel;
        cleanup = () => {
          // Fully tear down the subscription (socket) before dropping the channel
          // so repeated mounts don't accumulate connections.
          channel.unsubscribe();
          client.removeChannel(channel);
          channelRef.current = null;
          setLive(false);
          setOnline(0);
          setMembers([]);
        };
        return;
      }

      // Polling fallback (10s, paused when hidden).
      const tick = async () => {
        if (document.hidden) return;
        try {
          const res = await fetch("/api/chat/messages", { cache: "no-store" });
          const data = await res.json().catch(() => null);
          if (!res.ok || !data?.messages) return;
          setMessages((prev) => {
            // Pure reconcile (unit-tested in chat-view): refresh edits/reactions
            // on known messages, infer deletions inside the fetched window, and
            // split out genuinely new messages.
            const fresh = (data.messages as Message[]).map((m) => ({
              ...m,
              reactions: normalizeReactions(m.reactions),
            }));
            const { merged, incoming } = reconcilePoll(prev, fresh);
            if (incoming.length && !stickRef.current) {
              setUnread((u) => u + incoming.length);
              if (!firstUnreadRef.current && incoming[0]) {
                firstUnreadRef.current = incoming[0].id;
                setFirstUnreadId(incoming[0].id);
              }
            }
            // Blip for messages from others, same as the realtime path.
            if (soundOnRef.current && incoming.some((m) => m.userId !== meRef.current?.id)) {
              playBlip(audioCtxRef.current);
            }
            return incoming.length ? [...merged, ...incoming] : merged;
          });
        } catch {
          /* transient */
        }
      };
      const t = setInterval(tick, 10_000);
      cleanup = () => clearInterval(t);
    }

    start();
    return () => {
      cancelled = true;
      cleanup?.();
    };
    // Re-subscribe only when the connection target or the signed-in identity
    // changes; profile fields (name/image/username) ride in meRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    ch.send({ type: "broadcast", event: "typing", payload: { userId: me.id, name: me.name } });
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
        setHasMore(Boolean(data.hasMore) && (older.length > 0 || (data.messages as Message[]).length > 0));
        return older.length > 0;
      }
      return false;
    } finally {
      setLoadingOlder(false);
    }
  }

  function send(e: { preventDefault: () => void }) {
    e.preventDefault();
    void doSend();
  }

  // Send a picked GIF as its own message (body = GIF url -> rendered inline).
  async function sendGif(url: string) {
    setGifOpen(false);
    await doSend(url);
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
      await doSend(String(j.url));
    } catch {
      setError("Photo upload failed. Please try again.");
    } finally {
      setPhotoUploading(false);
    }
  }

  // overrideText is used to send media (a GIF/photo URL) without touching the
  // text the user may be composing; normal text sends read the composer body.
  async function doSend(overrideText?: string) {
    const isMedia = overrideText != null;
    const text = (overrideText ?? body).trim();
    if (!text || sending || !me) return;
    // Sending is a user gesture - unlock audio here too so incoming-message
    // blips work even if the toggle was already on at page load.
    if (soundOnRef.current) ensureAudio();
    setError("");
    setSending(true);
    if (!isMedia) setBody("");
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
      author: { name: me.name, username: null, image: null, membership: "Free", role: me.isAdmin ? "ADMIN" : "USER" },
      replyTo: reply ? { id: reply.id, body: reply.body, authorName: reply.authorName } : null,
      reactions: [],
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    jumpToLatest();

    const rollback = () => {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      // Restore the failed text/reply only if the user hasn't started composing
      // a new message in the meantime - never clobber fresh input. (Media sends
      // never touch the composer, so nothing to restore.)
      if (!isMedia) {
        setBody((b) => (b.trim() ? b : text));
        setReplyTarget((r) => r ?? reply);
      }
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
        return;
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
    } catch {
      rollback();
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string) {
    const snapshot = messages;
    hideMessage(id);
    const res = await fetch(`/api/chat/messages/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res || !res.ok) setMessages(snapshot);
  }

  async function toggleReaction(messageId: string, emoji: string) {
    if (!me) return;
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
  async function scrollToMessage(id: string) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const el = document.getElementById(`msg-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-1", "ring-gold-500/50");
        setTimeout(() => el.classList.remove("ring-1", "ring-gold-500/50"), 1200);
        return;
      }
      const added = await loadOlder();
      if (!added) return; // history exhausted or request failed
      await new Promise((r) => requestAnimationFrame(() => r(null))); // let rows render
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
      if (r.ok && j?.text) setTranslations((t) => ({ ...t, [id]: { text: j.text, loading: false, shown: true } }));
      else setTranslations((t) => ({ ...t, [id]: { loading: false, shown: true, text: undefined } }));
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
              u.id !== me?.id &&
              (u.username.toLowerCase().includes(mentionQuery) || u.name.toLowerCase().includes(mentionQuery))
          )
          .slice(0, 6)
      : [];
  const insertMention = (username: string) =>
    setBody((b) => b.replace(/@[a-zA-Z0-9_]*$/, `@${username} `).slice(0, MAX_LENGTH));

  // dvh (where supported) tracks the *visible* viewport, so the composer
  // stays above the mobile keyboard instead of being pushed off-screen.
  return (
    <div className="glass relative flex h-full min-h-[420px] flex-col overflow-hidden rounded-3xl">
      {/* Ambient futuristic glow behind the room. */}
      <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[130%] -translate-x-1/2 rounded-full bg-mint-500/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-28 right-0 h-56 w-72 rounded-full bg-gold-500/10 blur-3xl" />

      {/* Header: room identity + live "who's online" presence strip */}
      <div className="relative flex items-center justify-between gap-3 border-b border-white/10 bg-ink-900 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={cn("absolute inline-flex h-full w-full rounded-full", live ? "animate-pulse-dot bg-mint-400" : "bg-zinc-600")} />
              <span className={cn("relative inline-flex h-2 w-2 rounded-full", live ? "bg-mint-400" : "bg-zinc-600")} />
            </span>
            <span className="font-display text-sm font-semibold text-zinc-100">XYZ Lounge</span>
            {/* Honest connection state: live socket, reconnecting, or the
                polling fallback (never a forever-"Connecting…"). */}
            <span
              className={cn(
                "mono text-[10px] uppercase tracking-wider",
                live ? "text-mint-300/80" : realtimeConfigured ? "text-amber-300/80" : "text-zinc-500"
              )}
            >
              {live ? "Live" : realtimeConfigured ? "Reconnecting…" : "Auto-refresh"}
            </span>
          </div>
          <p className="mt-0.5 hidden mono text-[11px] text-zinc-500 sm:block">#general · markets, alpha &amp; Web3</p>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          {/* Enable phone push alerts for the lounge (reuses the Web Push infra). */}
          {me && <NewsAlertsToggle loggedIn compact title="Get a phone notification when the lounge is active" />}
          <button
            type="button"
            onClick={toggleSound}
            aria-label={soundOn ? "Mute message sounds" : "Enable message sounds"}
            title={soundOn ? "Sounds on" : "Sounds off"}
            className={cn("rounded-lg p-1.5 transition-colors", soundOn ? "text-mint-300 hover:text-mint-200" : "text-zinc-500 hover:text-zinc-300")}
          >
            {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          {members.length > 0 && (
            <div className="flex -space-x-2">
              {members.slice(0, 3).map((m) =>
                m.username ? (
                  <Link
                    key={m.id}
                    href={`/u/${m.username}`}
                    title={m.name}
                    className="transition-transform duration-200 hover:z-10 hover:-translate-y-0.5"
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
          <div className="relative">
            <button
              onClick={() => members.length && setMembersOpen((v) => !v)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-mint-500/10 px-2.5 py-1 text-[11px] font-medium text-mint-200 ring-1 ring-mint-500/25 transition-colors hover:bg-mint-500/20 disabled:cursor-default"
              disabled={!members.length}
            >
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-mint-400" />
              {online} online
            </button>
            {membersOpen && members.length > 0 && (
              <>
                <button className="fixed inset-0 z-40 cursor-default" aria-label="Close" onClick={() => setMembersOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-2 max-h-72 w-60 overflow-y-auto rounded-xl border border-white/10 bg-ink-900 p-2 shadow-elevate">
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
                      <Link key={m.id} href={`/u/${m.username}`} onClick={() => setMembersOpen(false)} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5">
                        {inner}
                      </Link>
                    ) : (
                      <div key={m.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">{inner}</div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

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
            const day = dayLabel(m.createdAt);
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
              !!me && me.id === m.userId && !m.pending && !m.hidden && m.kind !== "poll" && canEditMessage(m.createdAt);
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
                  <div className="my-4 flex items-center gap-3 text-[11px] text-zinc-600">
                    <span className="h-px flex-1 bg-white/5" />
                    {day}
                    <span className="h-px flex-1 bg-white/5" />
                  </div>
                )}
                {firstUnreadId === m.id && (
                  <div className="my-3 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wider text-gold-300">
                    <span className="h-px flex-1 bg-gold-500/30" />
                    New messages
                    <span className="h-px flex-1 bg-gold-500/30" />
                  </div>
                )}
                <motion.div
                  id={`msg-${m.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  onDoubleClick={() => {
                    // Desktop-only shortcut: on touch, dblclick fights the
                    // browser's double-tap zoom - ❤️ lives in the tap menu there.
                    if (!touchUi && me && !m.pending) toggleReaction(m.id, "❤️");
                  }}
                  onClick={() => {
                    if (touchUi && me && !m.pending) setActionOpenId((id) => (id === m.id ? null : m.id));
                  }}
                  className={cn(
                    "group relative flex items-start gap-3 rounded-xl px-2.5 transition-colors hover:bg-white/[0.035]",
                    grouped ? "py-0.5" : "py-2",
                    m.userId === me?.id && "bg-mint-500/[0.06] ring-1 ring-inset ring-mint-500/15 hover:bg-mint-500/[0.09]",
                    m.pending && "opacity-85"
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
                        {new Date(m.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(" ", "")}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
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
                        <span className="text-[11px] text-zinc-600">
                          {m.pending
                            ? "sending…"
                            : new Date(m.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
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
                          <span className="text-gold-200">{m.replyTo.authorName}</span> · {m.replyTo.body}
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
                              <span className="text-zinc-500">Couldn&apos;t translate. Try again.</span>
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
                          className="rounded p-1.5 text-zinc-400 hover:bg-white/10 hover:text-gold-200"
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
                              className="absolute bottom-full right-0 z-20 mb-1 flex max-w-[88vw] flex-wrap gap-0.5 rounded-2xl border border-line bg-ink-900/95 px-1.5 py-1 shadow-elevate backdrop-blur-xl"
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
                          className="rounded p-1.5 text-zinc-400 hover:bg-white/10 hover:text-red-300"
                          aria-label="Love"
                        >
                          <Heart className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setActionOpenId(null);
                          setReplyTarget({ id: m.id, body: chatMediaUrl(m.body) ? "📷 media" : m.body.slice(0, 80), authorName: m.author.name ?? (m.author.username ? `@${m.author.username}` : "Member") });
                        }}
                        className="rounded p-1.5 text-zinc-400 hover:bg-white/10 hover:text-gold-200"
                        aria-label="Reply"
                      >
                        <Reply className="h-3.5 w-3.5" />
                      </button>
                      {m.author.username && m.userId !== me?.id && (
                        <MessageButton username={m.author.username} compact className="rounded text-zinc-400 hover:bg-white/10 hover:text-gold-200" />
                      )}
                      {canEdit && (
                        <button
                          onClick={() => startEdit(m)}
                          className="rounded p-1.5 text-zinc-400 hover:bg-white/10 hover:text-gold-200"
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
                      {!m.pending && !chatMediaUrl(m.body) && (
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
                      {canDelete && (
                        <button onClick={() => remove(m.id)} className="rounded p-1.5 text-zinc-400 hover:bg-white/10 hover:text-red-300" aria-label="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
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

      {/* composer */}
      {/* pb: keep the composer clear of the iPhone home indicator. */}
      <div className="relative z-[1] border-t border-white/10 bg-ink-900/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4">
        {me ? (
          <>
            {replyTarget && (
              <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border-l-2 border-gold-500/40 bg-white/[0.03] px-3 py-1.5">
                <span className="truncate text-[12px] text-zinc-400">
                  Replying to <span className="text-gold-200">{replyTarget.authorName}</span> · {replyTarget.body}
                </span>
                <button onClick={() => setReplyTarget(null)} className="shrink-0 text-zinc-500 hover:text-zinc-200" aria-label="Cancel reply">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <form onSubmit={send} className="flex items-end gap-1.5">
              {/* attach row: poll, GIF (everyone, if configured), photo (admin) */}
              <button
                type="button"
                onClick={() => setPollOpen(true)}
                className="grid h-11 w-9 shrink-0 place-items-center rounded-2xl border border-black/10 bg-black/[0.04] dark:border-white/10 dark:bg-ink-800/60 text-zinc-400 transition-colors hover:border-gold-500/40 hover:text-gold-200"
                aria-label="Create a poll"
                title="Create a poll"
              >
                <BarChart3 className="h-[18px] w-[18px]" />
              </button>
              {gifEnabled && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setGifOpen((v) => !v)}
                    className={cn(
                      "grid h-11 w-9 shrink-0 place-items-center rounded-2xl border border-black/10 bg-black/[0.04] dark:border-white/10 dark:bg-ink-800/60 text-[10px] font-bold transition-colors hover:border-gold-500/40 hover:text-gold-200",
                      gifOpen ? "text-gold-200" : "text-zinc-400"
                    )}
                    aria-label="Send a GIF"
                    title="Send a GIF"
                  >
                    GIF
                  </button>
                  <AnimatePresence>
                    {gifOpen && <GifPicker onPick={(url) => void sendGif(url)} onClose={() => setGifOpen(false)} />}
                  </AnimatePresence>
                </div>
              )}
              {me.isAdmin && (
                <>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { void onPickPhoto(e.target.files?.[0]); e.target.value = ""; }}
                  />
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={photoUploading}
                    className="grid h-11 w-9 shrink-0 place-items-center rounded-2xl border border-black/10 bg-black/[0.04] dark:border-white/10 dark:bg-ink-800/60 text-zinc-400 transition-colors hover:border-gold-500/40 hover:text-gold-200 disabled:opacity-50"
                    aria-label="Share a photo"
                    title="Share a photo (admin)"
                  >
                    {photoUploading ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <ImagePlus className="h-[18px] w-[18px]" />}
                  </button>
                </>
              )}
              <div className="relative flex-1">
                <textarea
                  value={body}
                  onChange={(e) => {
                    setBody(e.target.value.slice(0, MAX_LENGTH));
                    sendTyping();
                  }}
                  onKeyDown={(e) => {
                    // Touch keyboards have no Shift: Enter inserts a newline
                    // there and the send button submits. Desktop keeps
                    // Enter-to-send / Shift+Enter for newline.
                    if (e.key === "Enter" && !e.shiftKey && !touchUi) {
                      e.preventDefault();
                      send(e);
                    }
                  }}
                  rows={1}
                  placeholder={touchUi ? "Say something…" : "Say something… (Enter to send)"}
                  className="block max-h-28 min-h-[44px] w-full resize-none rounded-2xl border border-white/10 bg-ink-950/50 px-4 py-3 pr-11 text-base leading-tight text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-mint-500/50 focus:ring-2 focus:ring-mint-500/20 sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setPickerOpen((v) => !v)}
                  className="absolute bottom-0 right-0 grid h-11 w-10 place-items-center text-zinc-500 transition-colors hover:text-gold-200"
                  aria-label="Emoji"
                >
                  <Smile className="h-5 w-5" />
                </button>
                <AnimatePresence>
                  {pickerOpen && (
                    <EmojiPicker
                      onPick={(emoji) => setBody((b) => (b + emoji).slice(0, MAX_LENGTH))}
                      onClose={() => setPickerOpen(false)}
                    />
                  )}
                </AnimatePresence>
                {mentionSuggestions.length > 0 && (
                  <div className="absolute bottom-full left-0 z-30 mb-2 w-60 max-w-[80vw] overflow-hidden rounded-xl border border-line bg-ink-900/95 p-1 shadow-elevate backdrop-blur-xl">
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
                className="btn-primary inline-flex h-11 shrink-0 items-center gap-1 !rounded-2xl !px-2.5 disabled:opacity-50"
                aria-label="Send message"
              >
                {sending ? <Loader2 className="relative z-10 h-[18px] w-[18px] animate-spin !text-white" /> : <SendGlyph className="relative z-10 h-4 w-4" />}
                <span className="relative z-10 hidden text-[13px] font-semibold !text-white sm:inline">Send</span>
              </motion.button>
            </form>
            {/* error + character count - aligned below the row, full width */}
            <div className="mt-1.5 flex min-h-[16px] items-center justify-between px-1 text-[11px]">
              <span className="text-red-300">{error}</span>
              <span className={cn("mono text-zinc-600", body.length > MAX_LENGTH - 50 && "text-amber-300")}>
                {body.length}/{MAX_LENGTH}
              </span>
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
