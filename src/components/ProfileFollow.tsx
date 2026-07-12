"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { UserPlus, UserCheck, UserMinus, Loader2 } from "lucide-react";
import { userChannel } from "@/lib/realtime";
import { useRealtime } from "@/lib/useRealtime";
import { cn } from "@/lib/utils";

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 ? 1 : 0) + "k";
  return String(n);
}

// Follower/following counts + a Twitter-style follow button (Follow → Following,
// hover shows Unfollow). Self-hides on your own profile; redirects to login when
// logged out. Counts update live via the profile's realtime channel.
export function ProfileFollow({
  username,
  profileId,
  initialFollowers,
  initialFollowing,
}: {
  username: string;
  profileId: string;
  initialFollowers: number;
  initialFollowing: number;
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

  const sync = useCallback(async () => {
    try {
      const r = await fetch(`/api/follow?username=${encodeURIComponent(username)}`, { cache: "no-store" });
      const j = r.ok ? await r.json() : null;
      if (j) { setFollowers(j.followers ?? 0); setFollowing(!!j.following); }
    } catch { /* keep current */ }
  }, [username]);

  useEffect(() => { sync(); }, [sync, status]);

  // Live: refresh the follower count when someone follows/unfollows this profile.
  useRealtime({
    channel: userChannel(profileId),
    event: "follow",
    onMessage: (p) => {
      const followersCount = (p as { followers?: number } | null)?.followers;
      if (typeof followersCount === "number") setFollowers(followersCount);
      else void sync();
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
    } catch {
      void sync();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2">
      <div className="flex items-center gap-4 text-sm">
        <span><b className="font-semibold text-zinc-100">{fmt(followers)}</b> <span className="text-zinc-500">Followers</span></span>
        <span><b className="font-semibold text-zinc-100">{fmt(followingCount)}</b> <span className="text-zinc-500">Following</span></span>
      </div>

      {!isOwner && (
        <button
          onClick={toggle}
          disabled={busy}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          aria-label={following ? "Unfollow" : "Follow"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors disabled:opacity-60",
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
