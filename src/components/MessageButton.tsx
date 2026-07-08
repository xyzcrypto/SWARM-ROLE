"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { MessageCircle, Loader2 } from "lucide-react";

// "Message" affordance on a public profile. Opens (or creates) my conversation
// with this user and jumps into the thread. Hidden on my own profile; sends
// logged-out visitors to login first.
export function MessageButton({ username }: { username: string }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [busy, setBusy] = useState(false);

  const me = (session?.user as { username?: string } | undefined)?.username;
  // Don't offer "message yourself".
  if (status === "authenticated" && me && me.toLowerCase() === username.toLowerCase()) return null;

  const start = async () => {
    if (status !== "authenticated") {
      router.push(`/login?callbackUrl=/u/${username}`);
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/dm", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username }),
      });
      const j = r.ok ? await r.json() : null;
      if (j?.conversationId) router.push(`/messages?c=${j.conversationId}`);
      else setBusy(false);
    } catch { setBusy(false); }
  };

  return (
    <button
      onClick={start}
      disabled={busy}
      className="btn-secondary inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
      Message
    </button>
  );
}
