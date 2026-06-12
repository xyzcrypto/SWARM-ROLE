"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown, Check, Copy, Loader2, Reply, SendHorizonal, Smile, Trash2, X,
} from "lucide-react";
import { Avatar } from "./Avatar";
import { Badge } from "./ui/primitives";
import { EmojiPicker } from "./EmojiPicker";
import { cn } from "@/lib/utils";
import { safeHref, cleanBareUrl } from "@/lib/links";

const MAX_LENGTH = 500;
const CHANNEL = "community";
const REACTIONS = ["👍", "❤️", "😂", "🔥", "🚀", "🎉", "👀", "💯"];
const GROUP_WINDOW_MS = 5 * 60 * 1000;

type Author = { name: string | null; username: string | null; image: string | null; membership: string; role: string };
type Reaction = { emoji: string; userIds: string[] };
type ReplyRef = { id: string; body: string; authorName: string };
type Message = {
  id: string;
  body: string;
  createdAt: string;
  userId: string;
  author: Author;
  replyTo: ReplyRef | null;
  reactions: Reaction[];
  pending?: boolean;
};
type Me = { id: string; isAdmin: boolean; name: string };

const normalizeReactions = (rs: { emoji: string; userIds: string[] }[]): Reaction[] =>
  rs.map((r) => ({ emoji: r.emoji, userIds: [...r.userIds] }));

/* Plain-text body with safe linkified URLs + @mention highlights (no HTML). */
function MessageBody({ text }: { text: string }) {
  const parts = useMemo(() => text.split(/(https?:\/\/\S+|@[a-zA-Z0-9_]{3,20})/g), [text]);
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

export function ChatClient({
  initialMessages,
  initialHasMore,
  me,
  realtime,
}: {
  initialMessages: Message[];
  initialHasMore: boolean;
  me: Me | null;
  realtime: { url: string; anonKey: string };
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
  const [typers, setTypers] = useState<Record<string, { name: string; until: number }>>({});
  const [stickToBottom, setStickToBottom] = useState(true);
  const [unread, setUnread] = useState(0);
  const [replyTarget, setReplyTarget] = useState<ReplyRef | null>(null);
  const [reactOpenId, setReactOpenId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);
  const lastTyping = useRef(0);
  const stickRef = useRef(true);
  stickRef.current = stickToBottom;

  const appendMessage = useCallback((m: Message) => {
    setMessages((prev) => {
      if (prev.some((x) => x.id === m.id)) return prev;
      if (!stickRef.current) setUnread((u) => u + 1);
      return [...prev, { ...m, reactions: normalizeReactions(m.reactions) }];
    });
  }, []);
  const hideMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // Idempotent reaction delta — safe to apply for both optimistic + echoed events.
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
          .on("broadcast", { event: "new_message" }, ({ payload }) => appendMessage(payload as Message))
          .on("broadcast", { event: "message_hidden" }, ({ payload }) => hideMessage((payload as { id: string }).id))
          .on("broadcast", { event: "reaction" }, ({ payload }) => {
            const p = payload as { messageId: string; emoji: string; userId: string; op: "add" | "remove" };
            applyReaction(p.messageId, p.emoji, p.userId, p.op);
          })
          .on("broadcast", { event: "typing" }, ({ payload }) => {
            const p = payload as { userId: string; name: string };
            if (p.userId === me?.id) return;
            setTypers((t) => ({ ...t, [p.userId]: { name: p.name, until: Date.now() + 4000 } }));
          })
          .on("presence", { event: "sync" }, () => {
            setOnline(Object.keys(channel.presenceState()).length);
          })
          .subscribe((status) => {
            setLive(status === "SUBSCRIBED");
            if (status === "SUBSCRIBED") channel.track({ at: Date.now(), name: me?.name ?? "Guest" });
          });
        channelRef.current = channel;
        cleanup = () => {
          client.removeChannel(channel);
          channelRef.current = null;
          setLive(false);
          setOnline(0);
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
            const known = new Set(prev.map((m) => m.id));
            const incoming = (data.messages as Message[])
              .filter((m) => !known.has(m.id))
              .map((m) => ({ ...m, reactions: normalizeReactions(m.reactions) }));
            // also refresh reactions on known messages
            const byId = new Map((data.messages as Message[]).map((m) => [m.id, m]));
            const merged = prev.map((m) => {
              const fresh = byId.get(m.id);
              return fresh ? { ...m, reactions: normalizeReactions(fresh.reactions) } : m;
            });
            if (incoming.length && !stickRef.current) setUnread((u) => u + incoming.length);
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
  }, [realtime.url, realtime.anonKey, me?.id, me?.name, appendMessage, hideMessage, applyReaction]);

  // Expire stale typing indicators.
  useEffect(() => {
    if (Object.keys(typers).length === 0) return;
    const t = setInterval(() => {
      setTypers((prev) => {
        const now = Date.now();
        const next = Object.fromEntries(Object.entries(prev).filter(([, v]) => v.until > now));
        return Object.keys(next).length === Object.keys(prev).length ? prev : next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [typers]);

  // Stick to bottom unless the user scrolled up.
  useEffect(() => {
    const el = listRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, typers]);

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setStickToBottom(nearBottom);
    if (nearBottom) setUnread(0);
  }

  function jumpToLatest() {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setStickToBottom(true);
    setUnread(0);
  }

  function sendTyping() {
    const ch = channelRef.current;
    if (!ch || !me) return;
    const now = Date.now();
    if (now - lastTyping.current < 2000) return;
    lastTyping.current = now;
    ch.send({ type: "broadcast", event: "typing", payload: { userId: me.id, name: me.name } });
  }

  async function loadOlder() {
    if (!messages.length || loadingOlder) return;
    setLoadingOlder(true);
    const el = listRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    try {
      const res = await fetch(`/api/chat/messages?cursor=${messages[0]!.id}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.messages) {
        setMessages((prev) => {
          const known = new Set(prev.map((m) => m.id));
          const older = (data.messages as Message[])
            .filter((m) => !known.has(m.id))
            .map((m) => ({ ...m, reactions: normalizeReactions(m.reactions) }));
          return [...older, ...prev];
        });
        setHasMore(Boolean(data.hasMore));
        requestAnimationFrame(() => {
          if (el) el.scrollTop = el.scrollHeight - prevHeight;
        });
      }
    } finally {
      setLoadingOlder(false);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending || !me) return;
    setError("");
    setSending(true);
    setBody("");
    const reply = replyTarget;
    setReplyTarget(null);
    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text, replyToId: reply?.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not send. Try again.");
        setBody(text);
        setReplyTarget(reply);
        return;
      }
      appendMessage(data.message as Message);
      jumpToLatest();
    } catch {
      setError("Network error. Please try again.");
      setBody(text);
      setReplyTarget(reply);
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

  function scrollToMessage(id: string) {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-1", "ring-gold-500/50");
      setTimeout(() => el.classList.remove("ring-1", "ring-gold-500/50"), 1200);
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

  return (
    <div className="glass relative flex h-[68vh] min-h-[440px] flex-col overflow-hidden rounded-3xl">
      {/* status strip */}
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="inline-flex items-center gap-2 text-xs text-zinc-400">
          <span className={cn("h-1.5 w-1.5 rounded-full", live ? "animate-pulse-dot bg-mint-400" : "bg-zinc-600")} />
          {live ? "Live" : "Connected"} · General
        </span>
        <span className="inline-flex items-center gap-3 text-[11px] text-zinc-500">
          {online > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-mint-400" />
              {online} online
            </span>
          )}
          <span className="hidden sm:inline text-zinc-600">Be respectful. No spam.</span>
        </span>
      </div>

      {/* messages */}
      <div ref={listRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-3 py-4 sm:px-4">
        {hasMore && (
          <div className="mb-4 text-center">
            <button onClick={loadOlder} disabled={loadingOlder} className="btn-ghost !px-4 !py-1.5 text-xs disabled:opacity-60">
              {loadingOlder ? "Loading…" : "Load older messages"}
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <p className="py-16 text-center text-sm text-zinc-600">No messages yet — be the first to say gm. 👋</p>
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

            return (
              <div key={m.id}>
                {showDay && (
                  <div className="my-4 flex items-center gap-3 text-[11px] text-zinc-600">
                    <span className="h-px flex-1 bg-white/5" />
                    {day}
                    <span className="h-px flex-1 bg-white/5" />
                  </div>
                )}
                <motion.div
                  id={`msg-${m.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className={cn(
                    "group relative flex items-start gap-3 rounded-xl px-2 transition-colors hover:bg-white/[0.03]",
                    grouped ? "py-0.5" : "py-1.5"
                  )}
                >
                  <div className="w-9 shrink-0">
                    {!grouped &&
                      (m.author.username ? (
                        <Link href={`/u/${m.author.username}`}>
                          <Avatar name={m.author.name} image={m.author.image} size="sm" />
                        </Link>
                      ) : (
                        <Avatar name={m.author.name} image={m.author.image} size="sm" />
                      ))}
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
                          {new Date(m.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
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

                    <MessageBody text={m.body} />

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

                  {/* hover action bar */}
                  {me && (
                    <div className="absolute -top-3 right-2 flex items-center gap-0.5 rounded-lg border border-line bg-ink-800/95 p-0.5 opacity-100 shadow-elevate backdrop-blur transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                      <div className="relative">
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
                              className="absolute bottom-full right-0 z-20 mb-1 flex gap-0.5 rounded-full border border-line bg-ink-900/95 px-1.5 py-1 shadow-elevate backdrop-blur-xl"
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
                      <button
                        onClick={() => setReplyTarget({ id: m.id, body: m.body.slice(0, 80), authorName: m.author.name ?? (m.author.username ? `@${m.author.username}` : "Member") })}
                        className="rounded p-1.5 text-zinc-400 hover:bg-white/10 hover:text-gold-200"
                        aria-label="Reply"
                      >
                        <Reply className="h-3.5 w-3.5" />
                      </button>
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
                  <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-zinc-500"
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
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
            onClick={jumpToLatest}
            className="absolute bottom-24 right-6 inline-flex items-center gap-1.5 rounded-full border border-line bg-ink-800/90 px-3 py-2 text-xs text-zinc-200 shadow-elevate backdrop-blur transition-colors hover:text-gold-200"
          >
            <ArrowDown className="h-4 w-4" />
            {unread > 0 ? `${unread} new` : "Latest"}
          </motion.button>
        )}
      </AnimatePresence>

      {/* composer */}
      <div className="border-t border-line px-3 py-3 sm:px-4">
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
            <form onSubmit={send} className="flex items-end gap-2">
              <div className="relative flex-1">
                <textarea
                  value={body}
                  onChange={(e) => {
                    setBody(e.target.value.slice(0, MAX_LENGTH));
                    sendTyping();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(e);
                    }
                  }}
                  rows={1}
                  placeholder="Say something… (Enter to send)"
                  className="max-h-28 w-full resize-none rounded-xl border border-white/10 bg-ink-700/60 px-4 py-2.5 pr-10 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20"
                />
                <button
                  type="button"
                  onClick={() => setPickerOpen((v) => !v)}
                  className="absolute bottom-2.5 right-2 rounded-lg p-1 text-zinc-500 transition-colors hover:text-gold-200"
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
                <div className="mt-1 flex items-center justify-between text-[11px]">
                  <span className="text-red-300">{error}</span>
                  <span className={cn("text-zinc-600", body.length > MAX_LENGTH - 50 && "text-amber-300")}>
                    {body.length}/{MAX_LENGTH}
                  </span>
                </div>
              </div>
              <motion.button
                type="submit"
                disabled={sending || !body.trim()}
                whileTap={{ scale: 0.9 }}
                className="btn-primary mb-5 !px-4 !py-2.5 disabled:opacity-50"
                aria-label="Send message"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
              </motion.button>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-center justify-between gap-2 py-1 sm:flex-row">
            <p className="text-sm text-zinc-400">Join the conversation — it&apos;s free.</p>
            <Link href="/login?callbackUrl=/community" className="btn-gold !py-2 text-[13px]">
              Log in to chat
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
