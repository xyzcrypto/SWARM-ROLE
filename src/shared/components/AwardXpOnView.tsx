"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import type { XpAction } from "@/lib/xp";

/**
 * Passive, invisible XP pinger. Mount this once wherever an engagement action
 * happens (viewing a research post, reading a news story, using a tool) and it
 * fires the award once per mount/keyId - the API is itself idempotent per day,
 * so a duplicate fire here is harmless.
 */
export function AwardXpOnView({ action, keyId }: { action: XpAction; keyId?: string }) {
  const { data: session } = useSession();
  const firedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!session) return;
    const dedupeKey = `${action}:${keyId ?? ""}`;
    if (firedRef.current === dedupeKey) return;
    firedRef.current = dedupeKey;
    fetch("/api/xp/award", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => {
      /* best-effort - never surface a failure for a passive XP ping */
    });
  }, [session, action, keyId]);

  return null;
}
