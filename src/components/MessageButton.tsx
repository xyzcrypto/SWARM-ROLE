"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { MessageSquare, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// "Message" affordance. Opens (or creates) my conversation with this user and
// jumps into the thread. Hidden on my own account; sends logged-out visitors to
// login first (returning to the current page). Two shapes:
//   - default: a labeled pill (profile header)
//   - compact: an icon-only button for dense rows (chat + comment authors)
export function MessageButton({ username, compact = false, className }: { username: string; compact?: boolean; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [busy, setBusy] = useState(false);

  const me = (session?.user as { username?: string } | undefined)?.username;
  // Don't offer "message yourself".
  if (status === "authenticated" && me && me.toLowerCase() === username.toLowerCase()) return null;

  const start = async () => {
    if (status !== "authenticated") {
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname || `/u/${username}`)}`);
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

  if (compact) {
    return (
      <button
        onClick={start}
        disabled={busy}
        aria-label={`Message ${username}`}
        title="Message"
        className={cn("inline-flex items-center justify-center rounded-full p-1.5 text-mint-400 transition-colors hover:bg-mint-500/15 hover:text-mint-200 disabled:opacity-60", className)}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
      </button>
    );
  }

  return (
    <button
      onClick={start}
      disabled={busy}
      className={cn("btn-secondary inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm disabled:opacity-60", className)}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
      Message
    </button>
  );
}
