import Link from "next/link";
import { LogIn, MessageCircle, Pin } from "lucide-react";
import { Avatar } from "./Avatar";
import { chatMediaUrl } from "@/lib/chat-media";
import { timeAgo } from "@/lib/news";
import type { ChatMessagePayload } from "@/lib/chat";

function bodyPreview(m: ChatMessagePayload): string {
  if (m.kind === "poll" && m.poll) return `📊 Poll: ${m.poll.question}`;
  if (chatMediaUrl(m.body)) return "📷 Photo";
  return m.body;
}

function Row({ m, now }: { m: ChatMessagePayload; now: number }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Avatar name={m.author.name} image={m.author.image} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[12px]">
          <span className="font-semibold text-zinc-200">{m.author.name ?? "Member"}</span>
          <span className="text-zinc-600">·</span>
          <span className="mono text-zinc-500">{timeAgo(new Date(m.createdAt).getTime(), now)}</span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-[13px] text-zinc-400">{bodyPreview(m)}</p>
      </div>
    </div>
  );
}

/**
 * Read-only snapshot of the community room for anonymous visitors - no
 * WebSocket connection, no composer, no admin tools. The full live ChatClient
 * (realtime channel + poll voting + moderation) only mounts for logged-in
 * members; this keeps anonymous page views (crawlers, first-time visitors)
 * cheap on both Function CPU and Supabase Realtime connections, and the
 * underlying data comes from a short-TTL shared cache (getCommunityPreview)
 * instead of a fresh Postgres round trip per visitor.
 */
export function CommunityPreview({ messages, pinned, now }: { messages: ChatMessagePayload[]; pinned: ChatMessagePayload | null; now: number }) {
  return (
    <div className="glass relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-ink-900 px-4 py-3">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
          <MessageCircle className="h-4 w-4 text-gold-300" /> Community
        </span>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-500">Preview</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        {pinned && (
          <div className="mt-3 rounded-xl border border-gold-500/20 bg-gold-500/[0.06] p-3">
            <p className="mb-1.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gold-200">
              <Pin className="h-3 w-3" /> Pinned
            </p>
            <Row m={pinned} now={now} />
          </div>
        )}
        {messages.length ? (
          <div className="divide-y divide-white/[0.04]">
            {messages.map((m) => (
              <Row key={m.id} m={m} now={now} />
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-zinc-500">The room is quiet right now - be the first to say something.</p>
        )}
      </div>

      <div className="border-t border-white/10 bg-ink-900/95 p-4 text-center">
        <p className="text-[13px] text-zinc-400">Log in to chat live, react, and join polls.</p>
        <Link href="/login?callbackUrl=/community" className="btn-primary mt-2.5 inline-flex items-center gap-1.5 px-4 py-2 text-sm">
          <LogIn className="h-4 w-4" /> Log in to join
        </Link>
      </div>
    </div>
  );
}
