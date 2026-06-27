"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { formatDateTime } from "@/lib/utils";
import { useRealtime } from "@/lib/useRealtime";
import { Avatar } from "./Avatar";

type CommentAuthor = { name: string; username: string | null; image: string | null };
type Comment = { id: string; body: string; createdAt: string; author: CommentAuthor };

export function CommentSection({ postId, isAdmin = false }: { postId: string; isAdmin?: boolean }) {
  const { data: session } = useSession();
  const rootRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  const [items, setItems] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

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
      { rootMargin: "400px" }
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
      }
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (inView) load();
  }, [inView, load]);

  // Live: refetch when anyone posts a new comment on this post (once in view).
  useRealtime({
    channel: `post:${postId}`,
    event: "comment",
    enabled: inView,
    onMessage: () => load(),
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
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
    if (!confirm("Delete this comment?")) return;
    const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((c) => c.id !== id));
      setTotal((t) => Math.max(0, t - 1));
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
                      <Avatar name={c.author.name} image={c.author.image} size="sm" />
                      <span className="text-sm font-semibold text-zinc-200 hover:text-gold-200">{c.author.name}</span>
                    </Link>
                  ) : (
                    <>
                      <Avatar name={c.author.name} image={c.author.image} size="sm" />
                      <span className="text-sm font-semibold text-zinc-200">{c.author.name}</span>
                    </>
                  )}
                  <span className="mono text-[11px] text-zinc-600">{formatDateTime(c.createdAt)}</span>
                </div>
                {isAdmin && (
                  <button onClick={() => remove(c.id)} className="text-xs text-red-400 hover:underline">
                    Delete
                  </button>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-300">{c.body}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
