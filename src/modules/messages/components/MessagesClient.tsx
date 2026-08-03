"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2, MessageSquare, Search, X, ImagePlus, Smile } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { SendGlyph } from "@/components/SendGlyph";
import { EmojiPicker } from "@/components/EmojiPicker";
import { GifPicker } from "@/components/GifPicker";
import { timeAgo } from "@/lib/news";
import { useRealtime } from "@/lib/useRealtime";
import { useOnlineSet } from "@/lib/useUserOnline";
import { chatMediaUrl } from "@/lib/chat-media";
import { compressImage } from "@/lib/image";
import { cn } from "@/lib/utils";

type Other = { id?: string; name: string; username: string | null; image: string | null } | null;
type Conversation = { id: string; other: Other; lastBody: string; lastMessageAt: string; unread: boolean };
type Msg = { id: string; body: string; createdAt: string; mine: boolean };
type Found = { id: string; name: string | null; username: string | null; image: string | null };

const THREAD_POLL_MS = 5000;

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
    const t = setTimeout(() => {
      fetch(`/api/dm/search?q=${encodeURIComponent(term)}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => setResults(Array.isArray(j?.users) ? j.users : []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const openConversation = (id: string) => router.replace(`/messages?c=${id}`, { scroll: false });
  const closeThread = () => router.replace("/messages", { scroll: false });

  const startDm = async (username: string) => {
    if (starting) return;
    setStarting(true);
    try {
      const r = await fetch("/api/dm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username }) });
      const j = r.ok ? await r.json() : null;
      if (j?.conversationId) { setQ(""); setResults([]); loadInbox(); openConversation(j.conversationId); }
    } catch { /* ignore */ } finally { setStarting(false); }
  };

  return (
    <div className="glass grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-3xl md:grid-cols-[minmax(0,320px)_1fr]">
      {/* Inbox */}
      <aside className={cn("flex min-h-0 flex-col border-white/10 md:border-r", activeId ? "hidden md:flex" : "flex")}>
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <h1 className="font-display text-lg font-semibold text-zinc-100">Messages</h1>
          <MessageSquare className="h-4 w-4 text-gold-400/70" />
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
              {conversations.map((c) => (
                <li key={c.id}>
                  <button onClick={() => openConversation(c.id)} className={cn("flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]", activeId === c.id && "bg-white/[0.06]")}>
                    <span className="relative shrink-0"><Avatar name={c.other?.name} image={c.other?.image} size="md" /><OnlineDot show={!!c.other?.id && onlineSet.has(c.other.id)} /></span>
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
          <Thread key={activeId} id={activeId} meId={meId} now={now} gifEnabled={gifEnabled} onlineSet={onlineSet} onBack={closeThread} onSent={loadInbox} />
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

function Thread({ id, meId, now, gifEnabled, onlineSet, onBack, onSent }: { id: string; meId: string; now: number; gifEnabled: boolean; onlineSet: Set<string>; onBack: () => void; onSent: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [other, setOther] = useState<Other>(null);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const otherOnline = !!other?.id && onlineSet.has(other.id);

  const scrollToEnd = () => requestAnimationFrame(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; });

  // Same rule as loadInbox: a failure must reach useRealtime so it can retry.
  const load = useCallback(async (silent: boolean) => {
    try {
      const r = await fetch(`/api/dm/${id}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`thread ${r.status}`);
      const j = await r.json();
      if (j) {
        setOther(j.other ?? null);
        setMessages((prev) => {
          const next: Msg[] = Array.isArray(j.messages) ? j.messages : [];
          if (silent && next.length === prev.length) return prev;
          return next;
        });
      }
    } finally {
      if (!silent) { setLoaded(true); scrollToEnd(); }
    }
  }, [id]);

  useEffect(() => { setLoaded(false); setMessages([]); load(false); }, [load]);
  useRealtime({ channel: `user:${meId}`, event: "dm_message", onMessage: () => load(true), pollMs: THREAD_POLL_MS });
  useEffect(() => { scrollToEnd(); }, [messages.length]);

  // Send any body (text, or a media URL). Optimistic + reconcile.
  const postMessage = async (raw: string, fromDraft = false) => {
    const body = raw.trim();
    if (!body || sending) return;
    setSending(true);
    setErr(null);
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setMessages((m) => [...m, { id: tempId, body, createdAt: new Date().toISOString(), mine: true }]);
    if (fromDraft) setDraft("");
    try {
      const r = await fetch(`/api/dm/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
      const j = r.ok ? await r.json() : null;
      if (j?.message) {
        setMessages((m) => { const without = m.filter((x) => x.id !== tempId); return without.some((x) => x.id === j.message.id) ? without : [...without, j.message]; });
        onSent();
      } else {
        setMessages((m) => m.filter((x) => x.id !== tempId));
        if (fromDraft) setDraft((d) => (d.trim() ? d : body));
      }
    } catch {
      setMessages((m) => m.filter((x) => x.id !== tempId));
      if (fromDraft) setDraft((d) => (d.trim() ? d : body));
    } finally { setSending(false); }
  };

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
    <div className="flex min-h-0 flex-1 flex-col">
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
          {otherOnline ? (
            <p className="flex items-center gap-1 text-[11px] font-medium text-mint-500 dark:text-mint-300">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-mint-500 dark:bg-mint-400" /> online
            </p>
          ) : (
            other?.username && <p className="mono truncate text-[11px] text-zinc-500">@{other.username}</p>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {!loaded ? (
          <p className="py-10 text-center text-sm text-zinc-500"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Loading…</p>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-zinc-500">No messages yet. Say hello 👋</p>
        ) : (
          messages.map((m) => {
            const media = chatMediaUrl(m.body);
            return (
              <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[78%] rounded-2xl text-[14px] leading-relaxed", media ? "overflow-hidden p-1" : "px-3.5 py-2", m.mine ? "rounded-br-md bg-gold-500/20 text-gold-950 ring-1 ring-gold-500/30 dark:bg-gold-500/15 dark:text-gold-50" : "rounded-bl-md bg-black/[0.05] text-zinc-800 ring-1 ring-black/10 dark:bg-white/[0.05] dark:text-zinc-100 dark:ring-white/10")}>
                  {media ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={media} alt="shared media" loading="lazy" className="max-h-72 w-auto max-w-full rounded-xl" />
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  )}
                  {now > 0 && <p className={cn("mono mt-1 text-[10px]", media && "px-2 pb-0.5", m.mine ? "text-gold-700/70 dark:text-gold-200/60" : "text-zinc-500")}>{timeAgo(new Date(m.createdAt).getTime(), now)}</p>}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-white/10 p-3">
        {err && <p className="mb-1.5 px-1 text-[11px] text-amber-500">{err}</p>}
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
              className="block max-h-32 min-h-[44px] w-full resize-none rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 pr-10 text-[14px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-gold-500/40 focus:ring-1 focus:ring-gold-500/20"
            />
            <button type="button" onClick={() => setPickerOpen((v) => !v)} className="absolute bottom-0 right-0 grid h-11 w-10 place-items-center text-zinc-500 hover:text-gold-200" aria-label="Emoji">
              <Smile className="h-5 w-5" />
            </button>
            <AnimatePresence>{pickerOpen && <EmojiPicker onPick={(e) => setDraft((b) => (b + e).slice(0, 2000))} onClose={() => setPickerOpen(false)} />}</AnimatePresence>
          </div>
          <button onClick={() => void postMessage(draft, true)} disabled={!draft.trim() || sending} aria-label="Send message" className="btn-primary relative inline-flex h-11 shrink-0 items-center gap-1 rounded-2xl !px-2.5 disabled:opacity-50">
            {sending ? <Loader2 className="relative z-10 h-4 w-4 animate-spin !text-white" /> : <SendGlyph className="relative z-10 h-4 w-4" />}
            <span className="relative z-10 hidden text-[13px] font-semibold !text-white sm:inline">Send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
