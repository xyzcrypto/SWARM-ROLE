"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Heart } from "lucide-react";
import { useRealtime } from "@/lib/useRealtime";

/** Heart + count. Optimistic toggle for logged-in users; others go to login. */
export function LikeButton({
  postId,
  initialCount,
  initialLiked,
}: {
  postId: string;
  initialCount: number;
  initialLiked: boolean;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  // Self-correct our own liked state once on mount for a logged-in user - the
  // page may be ISR-cached (research/[slug], free posts), so the server-baked
  // initialLiked reflects whoever's request happened to fill that cache slot,
  // not necessarily us. Guests never had a liked state to begin with, so no
  // request fires for anonymous traffic.
  useEffect(() => {
    if (!session) return;
    fetch(`/api/posts/${postId}/like`)
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.liked === "boolean") setLiked(d.liked);
      })
      .catch(() => {});
  }, [session, postId]);

  // Live like count: update when anyone else likes/unlikes this post. Ignored
  // while our own toggle is in flight - the broadcast can race the optimistic
  // update and flash an off-by-one count; our POST response settles the truth.
  useRealtime({
    channel: `post:${postId}`,
    event: "like",
    onMessage: (p) => {
      if (busyRef.current) return;
      const c = (p as { count?: number } | null)?.count;
      if (typeof c === "number") setCount(c);
    },
  });

  async function toggle() {
    if (!session) {
      router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (busy) return;
    // Optimistic update; revert on failure.
    const prev = { liked, count };
    setLiked(!liked);
    setCount((c) => c + (liked ? -1 : 1));
    setBusy(true);
    busyRef.current = true;
    try {
      const res = await fetch(`/api/posts/${postId}/like`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLiked(prev.liked);
        setCount(prev.count);
        return;
      }
      setLiked(Boolean(data.liked));
      if (typeof data.count === "number") setCount(data.count);
    } catch {
      setLiked(prev.liked);
      setCount(prev.count);
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={liked}
      aria-label={liked ? "Unlike" : "Like"}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-all ${
        liked
          ? "border-gold-500/50 bg-gold-500/15 text-gold-200"
          : "border-white/10 bg-white/5 text-zinc-300 hover:border-gold-500/40 hover:text-gold-100"
      }`}
    >
      <Heart className={`h-3.5 w-3.5 transition-transform ${liked ? "scale-110 fill-gold-300 text-gold-300" : ""}`} />
      {count > 0 ? count : "Like"}
    </button>
  );
}
