"use client";

import { useEffect, useRef } from "react";

/**
 * Fire-and-forget view-counter beacon (same pattern as AwardXpOnView.tsx).
 * Decoupled from server rendering so it stays accurate under ISR - it only
 * fires from a real mounted client, never from a Next.js router prefetch
 * (prefetches fetch the RSC payload but don't mount/run effects) and never
 * from a cache fill (a cached response doesn't re-run this component).
 */
export function TrackPostView({ postId }: { postId: string }) {
  const firedRef = useRef<string | null>(null);

  useEffect(() => {
    if (firedRef.current === postId) return;
    firedRef.current = postId;
    fetch(`/api/posts/${postId}/view`, { method: "POST", keepalive: true }).catch(() => {});
  }, [postId]);

  return null;
}
