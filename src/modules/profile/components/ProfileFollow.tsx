"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { UserPlus, UserCheck, UserMinus, Loader2 } from "lucide-react";
import { userChannel } from "@/lib/realtime-channels";
import { useRealtime } from "@/lib/useRealtime";
import { FollowListModal, prefetchFollowList, invalidateFollowLists } from "@/components/FollowListModal";
import { cn } from "@/lib/utils";
import { useReducedMotionSafe } from "@/lib/useClientFlag";

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 ? 1 : 0) + "k";
  return String(n);
}

/**
 * One clickable count.
 *
 * Two things this fixes beyond looking better. (1) The number animates when it
 * changes: an unfollow used to swap a digit silently, so there was no feedback
 * that the tap had done anything - the same complaint as the count being stale,
 * from the other direction. Keyed on the value so React remounts the span and
 * AnimatePresence can run the transition; `mode="popLayout"` keeps the label
 * from shifting while it does. (2) It is a real 40px tap target - it was small
 * text with 4px of padding, well under the minimum, and easy to miss on a phone.
 *
 * It used to be its OWN bordered pill. Two of those side by side are wide enough
 * to wrap on a phone, which is what left the header with four ragged rows of
 * different widths; they are now two halves of one segmented control, so the
 * pair reads as a single object and fits one line at 360px.
 */
function CountButton({ label, value, tone, onClick, onWarm }: {
  label: string;
  value: number;
  tone: "gold" | "mint";
  onClick: () => void;
  onWarm: () => void;
}) {
  const reduced = useReducedMotionSafe();
  return (
    <button
      onClick={onClick}
      // Start the list request on the hover / touch that precedes the tap, so
      // the modal usually opens already filled in rather than on a spinner.
      onPointerEnter={onWarm}
      onPointerDown={onWarm}
      onFocus={onWarm}
      aria-label={`${value} ${label}`}
      className={cn(
        "group inline-flex h-10 items-center gap-1.5 px-4 text-sm transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset",
        tone === "gold"
          ? "hover:bg-gold-500/10 focus-visible:ring-gold-500/40"
          : "hover:bg-mint-500/10 focus-visible:ring-mint-400/40"
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.b
          key={value}
          initial={reduced ? false : { y: -6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduced ? undefined : { y: 6, opacity: 0, position: "absolute" }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className={cn("mono inline-block font-semibold tabular-nums", tone === "gold" ? "text-gold-200" : "text-mint-200")}
        >
          {fmt(value)}
        </motion.b>
      </AnimatePresence>
      <span className="text-zinc-400 transition-colors group-hover:text-zinc-200">{label}</span>
    </button>
  );
}

// Follower/following counts + a Twitter-style follow button (Follow → Following,
// hover shows Unfollow). Self-hides on your own profile; redirects to login when
// logged out. Counts update live via the profile's realtime channel.
export function ProfileFollow({
  username,
  profileId,
  initialFollowers,
  initialFollowing,
  className,
}: {
  username: string;
  profileId: string;
  initialFollowers: number;
  initialFollowing: number;
  className?: string;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const me = (session?.user as { username?: string } | undefined)?.username;
  const isOwner = status === "authenticated" && !!me && me.toLowerCase() === username.toLowerCase();

  const [followers, setFollowers] = useState(initialFollowers);
  const [followingCount, setFollowingCount] = useState(initialFollowing);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);
  const [listOpen, setListOpen] = useState<null | "followers" | "following">(null);

  const sync = useCallback(async () => {
    try {
      const r = await fetch(`/api/follow?username=${encodeURIComponent(username)}`, { cache: "no-store" });
      const j = r.ok ? await r.json() : null;
      if (!j) return;
      setFollowers(j.followers ?? 0);
      setFollowing(!!j.following);
      // This line is the bug fix. `followingCount` was never touched here -
      // only `followers` and the boolean - so the "Following" number was frozen
      // at whatever the server rendered. Unfollow someone from the list, the
      // modal called sync(), and the count sat there unchanged. The API did not
      // return it either, so there was nothing to set; both ends are fixed.
      if (typeof j.followingCount === "number") setFollowingCount(j.followingCount);
    } catch { /* keep current */ }
  }, [username]);

  useEffect(() => { sync(); }, [sync, status]);

  const warm = useCallback(() => prefetchFollowList(username), [username]);

  // Live: refresh the follower count when someone follows/unfollows this profile.
  useRealtime({
    channel: userChannel(profileId),
    event: "follow",
    onMessage: (p) => {
      // The follow API now broadcasts on two channels: the target's (carrying
      // `followers`) and the actor's own (carrying `followingCount`), so a
      // profile open on another device updates whichever number actually moved.
      const payload = (p ?? {}) as { followers?: number; followingCount?: number };
      let handled = false;
      if (typeof payload.followers === "number") { setFollowers(payload.followers); handled = true; }
      if (typeof payload.followingCount === "number") { setFollowingCount(payload.followingCount); handled = true; }
      if (!handled) void sync();
    },
    pollMs: 60000,
  });

  const toggle = async () => {
    if (busy) return;
    if (status !== "authenticated") {
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname || `/u/${username}`)}`);
      return;
    }
    setBusy(true);
    const next = !following;
    setFollowing(next);
    setFollowers((n) => Math.max(0, n + (next ? 1 : -1)));
    try {
      const r = await fetch("/api/follow", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username }),
      });
      const j = r.ok ? await r.json() : null;
      if (j) { setFollowing(!!j.following); setFollowers(j.followers ?? 0); }
      else void sync(); // reconcile with the server truth on failure
      invalidateFollowLists(); // this profile's follower list just changed
    } catch {
      void sync();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {/* One segmented control, not two pills. `divide-x` draws the single
          hairline between the halves, so there is no separate spacer element to
          keep vertically centred. */}
      <div className="inline-flex divide-x divide-white/10 overflow-hidden rounded-full border border-white/10 bg-white/[0.03]">
        <CountButton label="Followers" value={followers} tone="gold" onClick={() => setListOpen("followers")} onWarm={warm} />
        <CountButton label="Following" value={followingCount} tone="mint" onClick={() => setListOpen("following")} onWarm={warm} />
      </div>

      {listOpen && (
        <FollowListModal
          username={username}
          initialType={listOpen}
          onClose={() => setListOpen(null)}
          onChanged={sync}
          // Only on your OWN profile. Following someone from a list changes how
          // many people *you* follow - so it moves the number on your profile,
          // and not the one on the stranger's profile you happen to be reading.
          // Applying it unconditionally would make someone else's count jump
          // when you tapped Follow in their followers list. `sync()` reconciles
          // against the server either way, so a wrong guess would self-correct
          // - but only after a visible flicker of a wrong number.
          onOptimistic={
            isOwner
              ? (delta) => setFollowingCount((n) => Math.max(0, n + delta))
              : undefined
          }
        />
      )}

      {!isOwner && (
        <button
          onClick={toggle}
          disabled={busy}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          aria-label={following ? "Unfollow" : "Follow"}
          className={cn(
            // h-10 matches the counts strip beside it. The two used to be
            // different heights, which is half of why the row looked unaligned.
            //
            // Full width on a phone by design. The strip (219px) plus this
            // button plus the gap comes to 381px against 375px of usable card
            // at 412px wide, so it wraps regardless - and a wrapped button
            // hanging off the right edge looks like a mistake, where a
            // full-width one reads as the primary action it is. From sm up
            // there is room, so it returns to the end of the strip's line.
            "inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full px-5 text-sm font-semibold transition-colors disabled:opacity-60 sm:ml-auto sm:w-auto",
            following
              ? hover
                ? "bg-red-500/15 text-red-500 ring-1 ring-red-500/40 dark:text-red-300"
                : "bg-white/5 text-zinc-200 ring-1 ring-white/15 dark:text-zinc-200"
              : "btn-primary"
          )}
        >
          {busy ? (
            <Loader2 className="relative z-10 h-4 w-4 animate-spin" />
          ) : following ? (
            hover ? (
              <><UserMinus className="h-4 w-4" /> Unfollow</>
            ) : (
              <><UserCheck className="h-4 w-4" /> Following</>
            )
          ) : (
            <><UserPlus className="relative z-10 h-4 w-4 !text-white" /> <span className="relative z-10 !text-white">Follow</span></>
          )}
        </button>
      )}
    </div>
  );
}
