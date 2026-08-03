"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { X, Loader2, UserPlus, UserCheck, UserMinus } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useHydrated } from "@/lib/useClientFlag";
import { useScrollLock } from "@/lib/useScrollLock";
import { cn } from "@/lib/utils";

type Row = { name: string | null; username: string; image: string | null; bio: string | null; isFollowing: boolean; isMe: boolean };
type Tab = "followers" | "following";

/**
 * A tiny in-memory cache of list responses, so the modal can open with rows
 * already in hand instead of a spinner.
 *
 * The list was fetched when the modal mounted, which meant every open showed
 * "Loading…" for a full round trip - and the tap that opens it is preceded by a
 * hover (desktop) or a touchstart (phone), both of which are dead time the
 * request could have been using. `prefetchFollowList` fires on those, the modal
 * reads the result synchronously on mount, and the common case renders filled
 * in on the first frame.
 *
 * Entries expire after ENTRY_TTL_MS so a cached list can't outlive the truth by
 * long, and are dropped outright whenever a follow/unfollow happens (the modal
 * calls `invalidateFollowLists` on every toggle), which is the only edit that
 * can change these lists from this page.
 */
const ENTRY_TTL_MS = 30_000;
const cache = new Map<string, { at: number; rows: Row[] }>();
const inflight = new Map<string, Promise<Row[]>>();

const keyOf = (username: string, tab: Tab) => `${username.toLowerCase()}:${tab}`;

async function fetchList(username: string, tab: Tab): Promise<Row[]> {
  const key = keyOf(username, tab);
  const running = inflight.get(key);
  if (running) return running;
  const p = (async () => {
    try {
      const r = await fetch(`/api/follow/list?username=${encodeURIComponent(username)}&type=${tab}`, { cache: "no-store" });
      const j = r.ok ? await r.json() : null;
      const rows: Row[] = Array.isArray(j?.list) ? j.list : [];
      // Only a real response is worth caching - an error would otherwise pin an
      // empty list in front of the user for the whole TTL.
      if (r.ok) cache.set(key, { at: Date.now(), rows });
      return rows;
    } catch {
      return [];
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

function cached(username: string, tab: Tab): Row[] | null {
  const hit = cache.get(keyOf(username, tab));
  if (!hit) return null;
  if (Date.now() - hit.at > ENTRY_TTL_MS) { cache.delete(keyOf(username, tab)); return null; }
  return hit.rows;
}

/** Warm both tabs for a profile. Safe to call repeatedly - it de-dupes. */
export function prefetchFollowList(username: string) {
  if (typeof window === "undefined") return;
  (["followers", "following"] as Tab[]).forEach((t) => {
    if (!cached(username, t)) void fetchList(username, t);
  });
}

/** Drop every cached list. Called after any follow/unfollow. */
export function invalidateFollowLists() {
  cache.clear();
}

// A small follow/unfollow button used inside each list row.
function RowFollow({ username, initial, onChanged, onOptimistic }: {
  username: string;
  initial: boolean;
  onChanged?: () => void;
  // Fired the instant the row is tapped, before the request goes out, so the
  // parent's Following count moves with the tap instead of a round trip later.
  // `onChanged` still reconciles against the server afterwards.
  onOptimistic?: (delta: number) => void;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const next = !following;
    setFollowing(next);
    onOptimistic?.(next ? 1 : -1);
    try {
      const r = await fetch("/api/follow", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username }) });
      if (r.status === 401) {
        router.push(`/login?callbackUrl=/u/${username}`);
        setFollowing(!next);
        onOptimistic?.(next ? -1 : 1); // put the count back
        return;
      }
      const j = r.ok ? await r.json() : null;
      if (j) setFollowing(!!j.following);
      else onOptimistic?.(next ? -1 : 1); // request failed - undo the guess
      // The lists this cache holds are exactly what a follow/unfollow changes,
      // so a stale hit here would show a button in the wrong state next open.
      invalidateFollowLists();
      onChanged?.();
    } catch {
      setFollowing(!next);
      onOptimistic?.(next ? -1 : 1);
    }
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
  onOptimistic,
}: {
  username: string;
  initialType: Tab;
  onClose: () => void;
  onChanged?: () => void;
  onOptimistic?: (delta: number) => void;
}) {
  // Portalled to document.body, and this is the actual "background aligned
  // nahi hai" bug rather than a padding question.
  //
  // `position: fixed` is only relative to the viewport while no ancestor
  // establishes a containing block - and `filter`, `transform`, `backdrop-filter`
  // and friends all do. The profile hero card is wrapped in
  // `<Reveal variant="blur">`, which animates `filter: blur(...)` and settles on
  // `blur(0px)`. That is visually nothing and is NOT `none`, so the card became
  // the containing block for everything fixed inside it. Measured at 1280x800:
  // this dialog's `fixed inset-0` overlay resolved to **832x328 at (224,112)**
  // instead of 1280x800 at (0,0) - a dialog boxed inside the profile card,
  // which is exactly what it looked like. A portal moves it out from under the
  // filtered ancestor so `inset-0` means the viewport again.
  //
  // ImageLightbox already portals for this same reason; its comment names
  // backdrop-filter. The blur-Reveal case is the one that was missed.
  const mounted = useHydrated();
  const [tab, setTab] = useState<Tab>(initialType);
  // Lazy initialisers, so a prefetched list is on screen for the FIRST paint
  // rather than after an effect - no spinner flash when the hover/touch that
  // opened the modal already warmed the cache.
  const [rows, setRows] = useState<Row[]>(() => cached(username, initialType) ?? []);
  const [loading, setLoading] = useState(() => !cached(username, initialType));

  const load = useCallback(async (t: Tab, alive: () => boolean) => {
    const hit = cached(username, t);
    if (hit) { setRows(hit); setLoading(false); return; }
    setLoading(true);
    const fresh = await fetchList(username, t);
    // Tabs can be switched back and forth faster than a request completes;
    // without this the slower one lands last and shows the wrong list.
    if (!alive()) return;
    setRows(fresh);
    setLoading(false);
  }, [username]);

  useEffect(() => {
    let alive = true;
    void load(tab, () => alive);
    return () => { alive = false; };
  }, [tab, load]);

  // Freeze the profile behind the dialog. Measured before this: one wheel
  // gesture over the open list moved the page underneath by 171px at 390px wide
  // and 20px at 1440px, because the list is short enough not to consume the
  // wheel itself and Lenis then scrolled the page with it.
  useScrollLock();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        // The overlay reserves the space the dialog may NOT use, and the dialog
        // centres in what is left. The panel used to subtract the bottom nav
        // from its own height while still centring inside the full viewport,
        // which left an unequal gap above and below; reserving it here makes the
        // two equal by construction, on every screen height, with no arithmetic
        // to keep in sync. Top padding clears the fixed navbar.
        className="fixed inset-0 z-[70] grid place-items-center bg-black/60 px-4 pb-[calc(1rem+3.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+4rem)] backdrop-blur-sm md:p-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 14, scale: 0.97 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => e.stopPropagation()}
          // panel-solid: `.glass` alone is translucent, so the profile page
          // behind this - avatar, bio, banner, stat tiles - showed straight
          // through the list and tangled with the names on top of it. Solid
          // base, same glass material and border above it.
          //
          // Height is now just "as tall as the space the overlay left me", on
          // every screen. It used to compute its own
          // `min(75svh, 100svh - 9rem - safe-area)`, which is where the
          // misalignment came from - the panel shrank for the bottom nav but the
          // centring did not know about it, so the gap above was always larger
          // than the gap below. `max-h-full` against a padded overlay gives
          // equal gaps by construction and needs no arithmetic to keep in sync
          // with the nav's height.
          //
          // `md:max-h-[80svh]` keeps the dialog from becoming a full-height slab
          // on a tall desktop screen, and the panel widens a step there so the
          // name + Following button row is not cramped into a phone-width
          // column on a 1440px display.
          className="panel-solid glass flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-3xl md:max-h-[80svh] md:max-w-lg"
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

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
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
                    {!u.isMe && <RowFollow username={u.username} initial={u.isFollowing} onChanged={onChanged} onOptimistic={onOptimistic} />}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
