"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, Loader2, SendHorizonal, Trash2 } from "lucide-react";
import { Avatar } from "./Avatar";
import { Badge } from "./ui/primitives";
import { cn } from "@/lib/utils";
import { safeHref, cleanBareUrl } from "@/lib/links";

const MAX_LENGTH = 500;
const CHANNEL = "community";

type Author = {
  name: string | null;
  username: string | null;
  image: string | null;
  membership: string;
  role: string;
};
type Message = {
  id: string;
  body: string;
  createdAt: string;
  userId: string;
  author: Author;
  pending?: boolean;
};

/* Plain-text body with safe linkified URLs (no HTML ever rendered). */
function MessageBody({ text }: { text: string }) {
  const parts = useMemo(() => text.split(/(https?:\/\/\S+)/g), [text]);
  return (
    <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-zinc-200">
      {parts.map((part, i) => {
        if (/^https?:\/\//.test(part)) {
          const url = cleanBareUrl(part);
          const href = safeHref(url);
          if (href) {
            return (
              <a
                key={i}
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-gold-200 underline decoration-gold-500/40 underline-offset-2 hover:text-gold-100"
              >
                {url}
              </a>
            );
          }
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
  me: { id: string; isAdmin: boolean } | null;
  realtime: { url: string; anonKey: string };
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);
  const [stickToBottom, setStickToBottom] = useState(true);

  const listRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  stickRef.current = stickToBottom;

  const appendMessage = useCallback((m: Message) => {
    setMessages((prev) => {
      if (prev.some((x) => x.id === m.id)) return prev; // dedupe (own optimistic)
      return [...prev, m];
    });
  }, []);
  const hideMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // --- Live updates: Supabase Realtime, else visibility-aware polling. -----
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    async function start() {
      if (realtime.url && realtime.anonKey) {
        // Lazy-import keeps supabase-js inside this page's chunk only.
        const { createClient } = await import("@supabase/supabase-js");
        if (cancelled) return;
        const client = createClient(realtime.url, realtime.anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const channel = client
          .channel(CHANNEL)
          .on("broadcast", { event: "new_message" }, ({ payload }) =>
            appendMessage(payload as Message)
          )
          .on("broadcast", { event: "message_hidden" }, ({ payload }) =>
            hideMessage((payload as { id: string }).id)
          )
          .subscribe((status) => setLive(status === "SUBSCRIBED"));
        cleanup = () => {
          client.removeChannel(channel);
          setLive(false);
        };
        return;
      }

      // Polling fallback (10s, paused when tab hidden): newest page, merge new.
      const tick = async () => {
        if (document.hidden) return;
        try {
          const res = await fetch("/api/chat/messages", { cache: "no-store" });
          const data = await res.json().catch(() => null);
          if (!res.ok || !data?.messages) return;
          setMessages((prev) => {
            const known = new Set(prev.map((m) => m.id));
            const incoming = (data.messages as Message[]).filter((m) => !known.has(m.id));
            return incoming.length ? [...prev, ...incoming] : prev;
          });
        } catch {
          /* transient — next tick retries */
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
  }, [realtime.url, realtime.anonKey, appendMessage, hideMessage]);

  // --- Scrolling: stick to bottom unless the user scrolled up. -------------
  useEffect(() => {
    const el = listRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setStickToBottom(nearBottom);
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
          const older = (data.messages as Message[]).filter((m) => !known.has(m.id));
          return [...older, ...prev];
        });
        setHasMore(Boolean(data.hasMore));
        // Keep the viewport anchored where it was.
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
    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not send. Try again.");
        setBody(text); // give the user their draft back
        return;
      }
      appendMessage(data.message as Message);
      setStickToBottom(true);
    } catch {
      setError("Network error. Please try again.");
      setBody(text);
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string) {
    const snapshot = messages;
    hideMessage(id); // optimistic
    const res = await fetch(`/api/chat/messages/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res || !res.ok) setMessages(snapshot); // rollback
  }

  let lastDay = "";

  return (
    <div className="glass flex h-[68vh] min-h-[420px] flex-col overflow-hidden rounded-3xl">
      {/* status strip */}
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="inline-flex items-center gap-2 text-xs text-zinc-400">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              live ? "animate-pulse-dot bg-mint-400" : "bg-zinc-600"
            )}
          />
          {live ? "Live" : "Connected"} · General
        </span>
        <span className="text-[11px] text-zinc-600">Be respectful. No spam or shilling.</span>
      </div>

      {/* messages */}
      <div ref={listRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        {hasMore && (
          <div className="mb-4 text-center">
            <button
              onClick={loadOlder}
              disabled={loadingOlder}
              className="btn-ghost !px-4 !py-1.5 text-xs disabled:opacity-60"
            >
              {loadingOlder ? "Loading…" : "Load older messages"}
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <p className="py-16 text-center text-sm text-zinc-600">
            No messages yet — be the first to say gm. 👋
          </p>
        )}

        {messages.map((m) => {
          const day = dayLabel(m.createdAt);
          const showDay = day !== lastDay;
          lastDay = day;
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
              <div className="group flex items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.03]">
                {m.author.username ? (
                  <Link href={`/u/${m.author.username}`} className="shrink-0">
                    <Avatar name={m.author.name} image={m.author.image} size="sm" />
                  </Link>
                ) : (
                  <Avatar name={m.author.name} image={m.author.image} size="sm" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {m.author.username ? (
                      <Link
                        href={`/u/${m.author.username}`}
                        className="text-[13px] font-semibold text-zinc-100 hover:text-gold-200"
                      >
                        {m.author.name ?? `@${m.author.username}`}
                      </Link>
                    ) : (
                      <span className="text-[13px] font-semibold text-zinc-100">
                        {m.author.name ?? "Member"}
                      </span>
                    )}
                    {isTeam && <Badge tone="mint" className="!px-1.5 !py-0">Team</Badge>}
                    {isPremium && !isTeam && (
                      <Badge tone="gold" className="!px-1.5 !py-0">★</Badge>
                    )}
                    <span className="text-[11px] text-zinc-600">
                      {new Date(m.createdAt).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    {canDelete && (
                      <button
                        onClick={() => remove(m.id)}
                        aria-label="Delete message"
                        className="ml-auto rounded p-1 text-zinc-600 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <MessageBody text={m.body} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* jump to latest */}
      {!stickToBottom && (
        <button
          onClick={() => {
            const el = listRef.current;
            if (el) el.scrollTop = el.scrollHeight;
            setStickToBottom(true);
          }}
          className="absolute bottom-24 right-6 inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-ink-800/90 text-zinc-300 shadow-elevate backdrop-blur transition-colors hover:text-gold-200"
          aria-label="Jump to latest"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}

      {/* composer */}
      <div className="border-t border-line px-4 py-3 sm:px-5">
        {me ? (
          <form onSubmit={send} className="flex items-end gap-2">
            <div className="flex-1">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, MAX_LENGTH))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(e);
                  }
                }}
                rows={1}
                placeholder="Say something… (Enter to send)"
                className="max-h-28 w-full resize-none rounded-xl border border-white/10 bg-ink-700/60 px-4 py-2.5 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20"
              />
              <div className="mt-1 flex items-center justify-between text-[11px]">
                <span className="text-red-300">{error}</span>
                <span className={cn("text-zinc-600", body.length > MAX_LENGTH - 50 && "text-amber-300")}>
                  {body.length}/{MAX_LENGTH}
                </span>
              </div>
            </div>
            <button
              type="submit"
              disabled={sending || !body.trim()}
              className="btn-primary mb-5 !px-4 !py-2.5 disabled:opacity-50"
              aria-label="Send message"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
            </button>
          </form>
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
