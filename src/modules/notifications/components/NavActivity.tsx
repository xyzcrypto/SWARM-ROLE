"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bell, MessageCircle, Mail } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { joinSharedChannel } from "@/lib/sharedChannel";
import { useLiveData } from "@/lib/useLiveData";

type Note = {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  href?: string | null;
  read: boolean;
  createdAt: string;
};

// Fallback poll. Realtime's "ping" handles instant updates *when it works* -
// but it needs BOTH halves of the Supabase setup, and they are separate
// credentials: the browser subscribes with NEXT_PUBLIC_SUPABASE_URL/ANON_KEY,
// while the server pushes with SUPABASE_URL/SERVICE_ROLE_KEY via
// broadcastEvent(). Either half can be missing on its own, and when the server
// half is, broadcastEvent() is a no-op and this poll is the ONLY thing that
// ever moves the DM badge. 60s was fine as a backstop to realtime; as the sole
// path it means a DM can sit unnoticed for a minute.
const POLL_MS = 60_000;
// So: poll the cheap unread counts faster while the tab is actually in front of
// the user. /api/dm/unread and /api/chat/last-activity are small, indexed
// count queries - not the full notification list, which stays on POLL_MS.
//
// 30s, not the 20s this first shipped as. Every one of these is a database
// query, and database responses are Supabase egress - which this project is
// currently OVER on the free tier. 20s was three requests a minute per
// logged-in tab on top of the existing poll; 30s halves that added cost while
// still being a large improvement on waiting a full minute for a DM badge. The
// focus listener below is what actually makes it feel instant, and it costs one
// request per return rather than a permanently faster background loop.
const FAST_POLL_MS = 30_000;
const CHAT_SEEN_KEY = "xyz:chatSeen";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/**
 * Navbar activity cluster: a chat icon (mint unread dot) + a notification bell
 * (gold unread count + dropdown). Notifications come from /api/notifications;
 * the chat dot compares the latest message time against a per-device "last seen"
 * marker that clears whenever the user opens /community.
 */
export function NavActivity() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const meId = (session?.user as { id?: string } | undefined)?.id;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const [chatDot, setChatDot] = useState(false);
  const [dmUnread, setDmUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // These three no longer swallow their failures. They are driven by
  // useLiveData, which retries a rejected load with backoff and refetches when
  // the tab or the network comes back - and a swallowed error is invisible to
  // it, so the badge simply stayed wrong until the next reload. Keeping the
  // last known state on failure is still the behaviour: nothing is cleared,
  // the error only travels upwards so something can act on it.
  const loadNotes = useCallback(async () => {
    const res = await fetch("/api/notifications", { cache: "no-store" });
    if (!res.ok) throw new Error(`notifications ${res.status}`);
    const data = await res.json();
    setItems(Array.isArray(data.items) ? data.items : []);
    setUnread(typeof data.unread === "number" ? data.unread : 0);
  }, []);

  const loadDm = useCallback(async () => {
    const res = await fetch("/api/dm/unread", { cache: "no-store" });
    if (!res.ok) throw new Error(`dm unread ${res.status}`);
    const data = await res.json();
    setDmUnread(typeof data.unread === "number" ? data.unread : 0);
  }, []);

  const loadChat = useCallback(async () => {
    // Only the latest message's timestamp is needed to flip the dot - not the
    // full message list (see src/app/api/chat/last-activity/route.ts).
    const res = await fetch("/api/chat/last-activity");
    if (!res.ok) throw new Error(`last-activity ${res.status}`);
    const data = await res.json();
    const latest: string | null = data.latestAt ?? null;
    if (!latest) { setChatDot(false); return; }
    const seen = localStorage.getItem(CHAT_SEEN_KEY);
    setChatDot(!seen || new Date(latest).getTime() > new Date(seen).getTime());
  }, []);

  // Two loops, both resilient. useLiveData retries a failed load with backoff,
  // never overlaps requests, pauses while hidden, and refetches on
  // visibilitychange / focus / online - the last of which nothing here had, so
  // a phone moving between wifi and mobile data kept a stale badge until the
  // next tick, or forever if that tick failed too.
  const badges = useCallback(async () => {
    // Both together, so one failure retries both rather than leaving the pair
    // inconsistent.
    await Promise.all([loadDm(), loadChat()]);
  }, [loadDm, loadChat]);

  const everything = useCallback(async () => {
    await Promise.all([loadNotes(), loadChat(), loadDm()]);
  }, [loadNotes, loadChat, loadDm]);

  // Full refresh, including the notification list.
  useLiveData({ load: everything, intervalMs: POLL_MS });
  // Just the two cheap unread counts, twice as often. These are the badges a
  // person actually watches, and the ones left stranded when the server half
  // of realtime is unconfigured.
  useLiveData({ load: badges, intervalMs: FAST_POLL_MS });

  // Refetch the DM unread count on every navigation so the badge drops as soon
  // as the user opens /messages (a thread read clears its unread server-side).
  useEffect(() => { loadDm(); }, [pathname, loadDm]);

  // Real-time: refetch the moment the server pings (new post/comment), so the
  // bell + chat dot update instantly instead of waiting for the next poll.
  // No-op (poll-only) when Supabase realtime isn't configured.
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      const ch = joinSharedChannel(url, anon, "notifications");
      ch.onBroadcast("ping", () => { void loadNotes(); void loadChat(); });
      // Live chat dot: light up on a new community message unless the user is
      // currently on the chat page (which marks messages seen). This shares the
      // `community` topic with ChatClient - which is exactly the collision that
      // used to throw and silently drop one side's listeners.
      const chat = joinSharedChannel(url, anon, "community");
      chat.onBroadcast("new_message", () => {
        if (!window.location.pathname.startsWith("/community")) setChatDot(true);
      });
      // Live DM badge: refetch my unread count when a message lands on my
      // per-user channel.
      let dm: ReturnType<typeof joinSharedChannel> | undefined;
      if (meId) {
        dm = joinSharedChannel(url, anon, `user:${meId}`);
        dm.onBroadcast("dm_message", () => { void loadDm(); });
      }
      cleanup = () => {
        ch.release();
        chat.release();
        dm?.release();
      };
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [loadNotes, loadChat, loadDm, meId]);

  // Opening the community page marks chat as seen.
  useEffect(() => {
    if (pathname?.startsWith("/community")) {
      localStorage.setItem(CHAT_SEEN_KEY, new Date().toISOString());
      setChatDot(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      setItems((cur) => cur.map((n) => ({ ...n, read: true })));
      try {
        await fetch("/api/notifications/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
      } catch {
        /* best-effort */
      }
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Link
        href="/community"
        aria-label="Community chat"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white/5 text-zinc-300 transition-colors hover:border-mint-500/30 hover:text-mint-200"
      >
        <MessageCircle className="h-4 w-4" />
        {chatDot && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 animate-pulse-dot rounded-full bg-mint-400 ring-2 ring-ink-900" />
        )}
      </Link>

      <Link
        href="/messages"
        aria-label="Direct messages"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white/5 text-zinc-300 transition-colors hover:border-gold-500/30 hover:text-gold-200"
      >
        <Mail className="h-4 w-4" />
        {dmUnread > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-gold-shine px-1 text-[10px] font-bold text-ink ring-2 ring-ink-900">
            {dmUnread > 9 ? "9+" : dmUnread}
          </span>
        )}
      </Link>

      <div className="relative" ref={ref}>
        <button
          onClick={toggle}
          aria-label="Notifications"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white/5 text-zinc-300 transition-colors hover:border-gold-500/30 hover:text-gold-200"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-gold-shine px-1 text-[10px] font-bold text-ink ring-2 ring-ink-900">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="fixed inset-x-3 top-[4.75rem] z-[60] overflow-hidden rounded-2xl border border-line bg-ink-900/95 shadow-elevate backdrop-blur-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:z-auto sm:mt-2 sm:w-80"
            >
              <div className="border-b border-white/5 px-4 py-3">
                <span className="text-sm font-semibold text-zinc-100">Notifications</span>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {items.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-zinc-500">You&apos;re all caught up.</p>
                ) : (
                  items.map((n) => {
                    const inner = (
                      <>
                        <p className="text-sm font-medium text-zinc-200">{n.title}</p>
                        {n.body && <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">{n.body}</p>}
                        <p className="mono mt-1 text-[10px] text-zinc-600">{timeAgo(n.createdAt)}</p>
                      </>
                    );
                    const cls = `block border-b border-white/5 px-4 py-3 transition-colors hover:bg-white/5 ${
                      n.read ? "" : "bg-gold-500/[0.04]"
                    }`;
                    // A notification without a target isn't a link - an href="#"
                    // anchor would jump the page to the top on click.
                    return n.href ? (
                      <Link key={n.id} href={n.href} onClick={() => setOpen(false)} className={cls}>
                        {inner}
                      </Link>
                    ) : (
                      <div key={n.id} className={cls}>
                        {inner}
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
