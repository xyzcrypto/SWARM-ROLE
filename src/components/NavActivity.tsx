"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Note = {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  href?: string | null;
  read: boolean;
  createdAt: string;
};

const POLL_MS = 45_000;
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
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const [chatDot, setChatDot] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const loadNotes = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setUnread(typeof data.unread === "number" ? data.unread : 0);
    } catch {
      /* offline / transient - keep last known state */
    }
  }, []);

  const loadChat = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/messages", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const msgs: { createdAt: string }[] = Array.isArray(data.messages) ? data.messages : [];
      const latest = msgs.length ? msgs[msgs.length - 1]!.createdAt : null;
      if (!latest) return setChatDot(false);
      const seen = localStorage.getItem(CHAT_SEEN_KEY);
      setChatDot(!seen || new Date(latest).getTime() > new Date(seen).getTime());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadNotes();
    loadChat();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadNotes();
        loadChat();
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [loadNotes, loadChat]);

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
              className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-line bg-ink-900/95 shadow-elevate backdrop-blur-xl"
            >
              <div className="border-b border-white/5 px-4 py-3">
                <span className="text-sm font-semibold text-zinc-100">Notifications</span>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {items.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-zinc-500">You&apos;re all caught up.</p>
                ) : (
                  items.map((n) => (
                    <Link
                      key={n.id}
                      href={n.href ?? "#"}
                      onClick={() => setOpen(false)}
                      className={`block border-b border-white/5 px-4 py-3 transition-colors hover:bg-white/5 ${
                        n.read ? "" : "bg-gold-500/[0.04]"
                      }`}
                    >
                      <p className="text-sm font-medium text-zinc-200">{n.title}</p>
                      {n.body && <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">{n.body}</p>}
                      <p className="mono mt-1 text-[10px] text-zinc-600">{timeAgo(n.createdAt)}</p>
                    </Link>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
