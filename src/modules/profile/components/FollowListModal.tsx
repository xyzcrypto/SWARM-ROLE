"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { X, Loader2, UserPlus, UserCheck, UserMinus } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { cn } from "@/lib/utils";

type Row = { name: string | null; username: string; image: string | null; bio: string | null; isFollowing: boolean; isMe: boolean };
type Tab = "followers" | "following";

// A small follow/unfollow button used inside each list row.
function RowFollow({ username, initial, onChanged }: { username: string; initial: boolean; onChanged?: () => void }) {
  const router = useRouter();
  const [following, setFollowing] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const next = !following;
    setFollowing(next);
    try {
      const r = await fetch("/api/follow", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username }) });
      if (r.status === 401) { router.push(`/login?callbackUrl=/u/${username}`); setFollowing(!next); return; }
      const j = r.ok ? await r.json() : null;
      if (j) setFollowing(!!j.following);
      onChanged?.();
    } catch { setFollowing(!next); }
    finally { setBusy(false); }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn(
        "shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60",
        following
          ? hover
            ? "bg-red-500/15 text-red-500 ring-1 ring-red-500/40 dark:text-red-300"
            : "bg-white/5 text-zinc-200 ring-1 ring-white/15"
          : "btn-primary"
      )}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : following ? (hover ? <><UserMinus className="h-3.5 w-3.5" />Unfollow</> : <><UserCheck className="h-3.5 w-3.5" />Following</>) : <><UserPlus className="relative z-10 h-3.5 w-3.5 !text-white" /><span className="relative z-10 !text-white">Follow</span></>}
    </button>
  );
}

// Followers / Following list in a modal, with tabs + per-row follow/unfollow.
export function FollowListModal({
  username,
  initialType,
  onClose,
  onChanged,
}: {
  username: string;
  initialType: Tab;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [tab, setTab] = useState<Tab>(initialType);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (t: Tab) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/follow/list?username=${encodeURIComponent(username)}&type=${t}`, { cache: "no-store" });
      const j = r.ok ? await r.json() : null;
      setRows(Array.isArray(j?.list) ? j.list : []);
    } catch { setRows([]); }
    finally { setLoading(false); }
  }, [username]);

  useEffect(() => { load(tab); }, [tab, load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 14, scale: 0.97 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => e.stopPropagation()}
          className="glass flex max-h-[75vh] w-full max-w-md flex-col overflow-hidden rounded-3xl"
        >
          <div className="flex items-center border-b border-white/10">
            {(["followers", "following"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 py-3 text-sm font-semibold capitalize transition-colors",
                  tab === t ? "border-b-2 border-mint-400 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {t}
              </button>
            ))}
            <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center text-zinc-500 hover:text-zinc-200">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {loading ? (
              <p className="py-12 text-center text-sm text-zinc-500"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Loading…</p>
            ) : rows.length === 0 ? (
              <p className="py-12 text-center text-sm text-zinc-500">{tab === "followers" ? "No followers yet." : "Not following anyone yet."}</p>
            ) : (
              <ul className="space-y-0.5">
                {rows.map((u) => (
                  <li key={u.username} className="flex items-center gap-3 rounded-2xl px-2.5 py-2 transition-colors hover:bg-white/[0.04]">
                    <Link href={`/u/${u.username}`} onClick={onClose} className="shrink-0">
                      <Avatar name={u.name} image={u.image} size="md" />
                    </Link>
                    <Link href={`/u/${u.username}`} onClick={onClose} className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-zinc-100">{u.name ?? `@${u.username}`}</span>
                      <span className="mono block truncate text-[11px] text-zinc-500">@{u.username}</span>
                      {u.bio && <span className="mt-0.5 block truncate text-[11px] text-zinc-500">{u.bio}</span>}
                    </Link>
                    {!u.isMe && <RowFollow username={u.username} initial={u.isFollowing} onChanged={onChanged} />}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
