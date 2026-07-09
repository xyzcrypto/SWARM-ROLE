"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Send, MessageSquare } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { timeAgo } from "@/lib/news";
import { useRealtime } from "@/lib/useRealtime";
import { cn } from "@/lib/utils";

type Other = { name: string; username: string | null; image: string | null } | null;
type Conversation = { id: string; other: Other; lastBody: string; lastMessageAt: string; unread: boolean };
type Msg = { id: string; body: string; createdAt: string; mine: boolean };

const THREAD_POLL_MS = 5000;

// Telegram-style DM surface: inbox on the left, the open thread on the right.
// On mobile it's one pane at a time (list → thread with a back button). The
// active conversation lives in the ?c= query so profile "Message" buttons can
// deep-link straight into a thread.
export function MessagesClient({ meId }: { meId: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const activeId = search.get("c");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [inboxLoaded, setInboxLoaded] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const loadInbox = useCallback(async () => {
    try {
      const r = await fetch("/api/dm", { cache: "no-store" });
      const j = r.ok ? await r.json() : null;
      if (j?.conversations) setConversations(j.conversations);
    } catch { /* ignore */ } finally {
      setInboxLoaded(true);
    }
  }, []);

  useEffect(() => { loadInbox(); }, [loadInbox]);

  // Live: refresh the inbox (reorder + preview + unread dot) the moment a DM
  // lands on my per-user channel. Falls back to a 10s poll without realtime.
  useRealtime({ channel: `user:${meId}`, event: "dm_message", onMessage: loadInbox, pollMs: 10000 });

  const openConversation = (id: string) => {
    router.replace(`/messages?c=${id}`, { scroll: false });
  };
  const closeThread = () => router.replace("/messages", { scroll: false });

  return (
    <div className="glass grid h-[calc(100vh-11rem)] min-h-[520px] grid-cols-1 overflow-hidden rounded-3xl md:grid-cols-[minmax(0,320px)_1fr]">
      {/* Inbox */}
      <aside
        className={cn(
          "flex min-h-0 flex-col border-white/10 md:border-r",
          activeId ? "hidden md:flex" : "flex"
        )}
      >
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h1 className="font-display text-lg font-semibold text-zinc-100">Messages</h1>
          <MessageSquare className="h-4 w-4 text-gold-400/70" />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!inboxLoaded ? (
            <p className="py-10 text-center text-sm text-zinc-500"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Loading…</p>
          ) : conversations.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <MessageSquare className="mx-auto h-6 w-6 text-zinc-600" />
              <p className="mt-3 text-sm text-zinc-400">No conversations yet.</p>
              <p className="mt-1 text-xs text-zinc-600">Open someone&apos;s profile and hit Message to start.</p>
            </div>
          ) : (
            <ul>
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => openConversation(c.id)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]",
                      activeId === c.id && "bg-white/[0.06]"
                    )}
                  >
                    <Avatar name={c.other?.name} image={c.other?.image} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-zinc-100">{c.other?.name ?? "Member"}</span>
                        {now > 0 && <span className="mono ml-auto shrink-0 text-[11px] text-zinc-600">{timeAgo(new Date(c.lastMessageAt).getTime(), now)}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("truncate text-[13px]", c.unread ? "font-medium text-zinc-200" : "text-zinc-500")}>{c.lastBody || "New conversation"}</span>
                        {c.unread && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-gold-400" />}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Thread */}
      <section className={cn("min-h-0", activeId ? "flex" : "hidden md:flex")}>
        {activeId ? (
          <Thread key={activeId} id={activeId} meId={meId} now={now} onBack={closeThread} onSent={loadInbox} />
        ) : (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div>
              <MessageSquare className="mx-auto h-8 w-8 text-zinc-700" />
              <p className="mt-3 text-sm text-zinc-500">Select a conversation to start chatting.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Thread({ id, meId, now, onBack, onSent }: { id: string; meId: string; now: number; onBack: () => void; onSent: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [other, setOther] = useState<Other>(null);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  const load = useCallback(async (silent: boolean) => {
    try {
      const r = await fetch(`/api/dm/${id}`, { cache: "no-store" });
      const j = r.ok ? await r.json() : null;
      if (j) {
        setOther(j.other ?? null);
        setMessages((prev) => {
          const next: Msg[] = Array.isArray(j.messages) ? j.messages : [];
          if (silent && next.length === prev.length) return prev; // nothing new
          return next;
        });
      }
    } catch { /* ignore */ } finally {
      if (!silent) { setLoaded(true); scrollToEnd(); }
    }
  }, [id]);

  useEffect(() => {
    setLoaded(false);
    setMessages([]);
    load(false);
  }, [load]);

  // Live: re-pull the thread when a DM lands on my per-user channel (append is
  // idempotent via the length check in load). Polls every 5s without realtime.
  useRealtime({ channel: `user:${meId}`, event: "dm_message", onMessage: () => load(true), pollMs: THREAD_POLL_MS });

  useEffect(() => { scrollToEnd(); }, [messages.length]);

  const submit = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const r = await fetch(`/api/dm/${id}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }),
      });
      const j = r.ok ? await r.json() : null;
      if (j?.message) {
        setMessages((m) => [...m, j.message]);
        setDraft("");
        onSent();
      }
    } catch { /* ignore */ } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <button onClick={onBack} aria-label="Back" className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 hover:bg-white/5 hover:text-zinc-100 md:hidden">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Avatar name={other?.name} image={other?.image} size="sm" />
        <div className="min-w-0">
          {other?.username ? (
            <Link href={`/u/${other.username}`} className="truncate text-sm font-semibold text-zinc-100 hover:underline">{other?.name ?? "Member"}</Link>
          ) : (
            <span className="truncate text-sm font-semibold text-zinc-100">{other?.name ?? "Member"}</span>
          )}
          {other?.username && <p className="mono truncate text-[11px] text-zinc-500">@{other.username}</p>}
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {!loaded ? (
          <p className="py-10 text-center text-sm text-zinc-500"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Loading…</p>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-zinc-500">No messages yet. Say hello 👋</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[78%] rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed",
                  m.mine
                    ? "rounded-br-md bg-gold-500/15 text-gold-50 ring-1 ring-gold-500/25"
                    : "rounded-bl-md bg-white/[0.05] text-zinc-100 ring-1 ring-white/10"
                )}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                {now > 0 && <p className={cn("mono mt-1 text-[10px]", m.mine ? "text-gold-200/60" : "text-zinc-500")}>{timeAgo(new Date(m.createdAt).getTime(), now)}</p>}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder="Write a message…"
            rows={1}
            maxLength={2000}
            className="max-h-32 min-h-[42px] flex-1 resize-none rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-2.5 text-[14px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-gold-500/40 focus:ring-1 focus:ring-gold-500/20"
          />
          <button onClick={submit} disabled={!draft.trim() || sending} aria-label="Send" className="btn-primary inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl p-0 disabled:opacity-50">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
