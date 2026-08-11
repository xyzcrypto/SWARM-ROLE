"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { cn, formatDateTime } from "@/lib/utils";
import { useRealtime } from "@/lib/useRealtime";
import { MessageButton } from "@/components/MessageButton";
import { Avatar } from "@/components/Avatar";
import { hapticTap } from "@shared/utils/haptics";

type CommentAuthor = { name: string; username: string | null; image: string | null; premium?: boolean };
type Comment = { id: string; body: string; createdAt: string; author: CommentAuthor };

export function CommentSection({ postId }: { postId: string }) {
  const { data: session } = useSession();
  // Read isAdmin from our own session, not a server-rendered prop - the page
  // may be ISR-cached (research/[slug] for free posts), so a baked-in prop
  // would be stale/wrong for whoever's actually viewing.
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";
  const rootRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  const [items, setItems] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Perf: don't fetch comments until the section is scrolled near the viewport.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "150px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setItems(data.comments ?? []);
        setTotal(data.total ?? 0);
        setHasMore(Boolean(data.hasMore));
        setPage(1);
      }
    } finally {
      setLoading(false);
    }
  }, [postId]);

  // Older pages: the API has always supported ?page=, but no control ever
  // called it - comments beyond the first 20 were unreachable.
  const loadOlder = useCallback(async () => {
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await fetch(`/api/posts/${postId}/comments?page=${next}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const older = (data.comments ?? []) as Comment[];
        setItems((prev) => [...prev, ...older.filter((c) => !prev.some((p) => p.id === c.id))]);
        setHasMore(Boolean(data.hasMore));
        setPage(next);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [postId, page]);

  useEffect(() => {
    if (inView) load();
  }, [inView, load]);

  useRealtime({
    channel: `post:${postId}`,
    event: "comment",
    enabled: inView,
    onMessage: (payload) => {
      setItems((prev) => {
        if (prev.some((c) => c.id === (payload as Comment).id)) return prev;
        setTotal((t) => t + 1);
        return [payload as Comment, ...prev];
      });
    },
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    hapticTap(); // posting a comment
    setError("");
    setPosting(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not post your comment.");
        return;
      }
      setItems((prev) => [data.comment, ...prev]);
      setTotal((t) => t + 1);
      setBody("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPosting(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((c) => c.id !== id));
      setTotal((t) => Math.max(0, t - 1));
      setConfirmDeleteId(null);
    }
  }

  return (
    <section ref={rootRef} className="mx-auto mt-12 max-w-3xl px-4 sm:px-6">
      <h2 className="font-display text-xl font-semibold text-zinc-100">
        Comments {total > 0 && <span className="text-zinc-500">({total})</span>}
      </h2>

      {session ? (
        <form onSubmit={submit} className="mt-5">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 1000))}
            rows={3}
            placeholder="Share your thoughts…"
            className="w-full resize-y rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20"
          />
          {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
          <div className="mt-2 flex items-center justify-between">
            <span className="mono text-[11px] text-zinc-600">{body.length}/1000</span>
            <button type="submit" disabled={posting || !body.trim()} className="btn-gold !px-5 !py-2 text-[13px] disabled:opacity-60">
              {posting ? "Posting…" : "Post comment"}
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-400">
          <Link href="/login" className="font-semibold text-gold-200 hover:underline">Log in</Link>{" "}
          to join the conversation.
        </p>
      )}

      <div className="mt-8 space-y-5">
        {loading ? (
          <p className="text-sm text-zinc-600">Loading comments…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-zinc-600">No comments yet. Be the first.</p>
        ) : (
          items.map((c) => (
            <div key={c.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {c.author.username ? (
                    <Link href={`/u/${c.author.username}`} className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
                      <Avatar name={c.author.name} image={c.author.image} size="sm" premium={c.author.premium} />
                      <span className={cn("text-sm font-semibold hover:text-gold-200", c.author.premium ? "text-gold-gradient" : "text-zinc-200")}>
                        {c.author.name}
                      </span>
                    </Link>
                  ) : (
                    <>
                      <Avatar name={c.author.name} image={c.author.image} size="sm" premium={c.author.premium} />
                      <span className={cn("text-sm font-semibold", c.author.premium ? "text-gold-gradient" : "text-zinc-200")}>
                        {c.author.name}
                      </span>
                    </>
                  )}
                  <span className="mono text-[11px] text-zinc-600">{formatDateTime(c.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {c.author.username && <MessageButton username={c.author.username} compact />}
                  {isAdmin && (
                    confirmDeleteId === c.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">Sure?</span>
                        <button onClick={() => remove(c.id)} className="text-xs text-red-400 hover:underline">Yes</button>
                        <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-zinc-400 hover:underline">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(c.id)} className="text-xs text-red-400 hover:underline">
                        Delete
                      </button>
                    )
                  )}
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-300">{c.body}</p>
            </div>
          ))
        )}
        {hasMore && !loading && (
          <div className="text-center">
            <button onClick={loadOlder} disabled={loadingMore} className="btn-ghost !px-4 !py-2 text-xs disabled:opacity-60">
              {loadingMore ? "Loading…" : "Load older comments"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
