"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, MessageCircle, Loader2, Trash2 } from "lucide-react";
import { timeAgo } from "@/lib/news";
import { hapticToggle } from "@shared/utils/haptics";
import { MessageButton } from "@/components/MessageButton";
import { SendGlyph } from "@/components/SendGlyph";
import { cn } from "@/lib/utils";

type Comment = { id: string; body: string; createdAt: string; name: string; username: string | null; image: string | null; mine: boolean };

// Likes + comments on a news story (keyed by url). Graceful: if the DB isn't
// migrated yet the endpoints return empty/503 and this stays quiet.
export function NewsSocial({ url, loggedIn, now }: { url: string; loggedIn: boolean; now: number }) {
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  // Switching stories clears the previous story's counts so they can't flash on
  // the new one. Adjusted during render rather than at the top of the fetch
  // effect, so the stale values are never committed in the first place.
  const [prevUrl, setPrevUrl] = useState(url);
  if (prevUrl !== url) {
    setPrevUrl(url);
    setLoaded(false);
  }

  useEffect(() => {
    let stop = false;
    fetch(`/api/news/social?url=${encodeURIComponent(url)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (stop || !j) { if (!stop) setLoaded(true); return; }
        setLikes(j.likes ?? 0);
        setLiked(Boolean(j.liked));
        setComments(Array.isArray(j.comments) ? j.comments : []);
        setLoaded(true);
      })
      .catch(() => !stop && setLoaded(true));
    return () => { stop = true; };
  }, [url]);

  const toggleLike = async () => {
    if (!loggedIn) return;
    // Fires on the optimistic flip, not on the server response - the buzz should
    // land with the visual change the reader already sees, not a round-trip
    // later. If the request then fails the UI reverts, which is the correct
    // signal on its own; a second buzz there would be noise.
    hapticToggle();
    const optimistic = !liked;
    setLiked(optimistic);
    setLikes((n) => n + (optimistic ? 1 : -1));
    try {
      const r = await fetch("/api/news/like", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j) {
        setLiked(Boolean(j.liked));
        // ⚠️ Updater form, and the fallback reads `n`, not `likes`.
        //
        // `likes` here is the value from the render this callback closed over -
        // i.e. from BEFORE the optimistic bump a few lines up. So on a response
        // with no count the counter silently rolled back by one, and two quick
        // taps could leave it a full step behind what the server holds.
        setLikes((n) => (typeof j.count === "number" ? j.count : n));
      }
    } catch { /* keep optimistic */ }
  };

  const submit = async () => {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);

    // Optimistic: show the comment instantly with a temp id, then swap in the
    // server copy (real id + author). Roll back + restore text on failure.
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: Comment = {
      id: tempId, body, createdAt: new Date().toISOString(),
      name: "You", username: null, image: null, mine: true,
    };
    setComments((c) => [optimistic, ...c]);
    setDraft("");

    try {
      const r = await fetch("/api/news/social", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, body }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.comment) {
        setComments((c) => c.map((x) => (x.id === tempId ? j.comment : x)));
      } else {
        setComments((c) => c.filter((x) => x.id !== tempId));
        setDraft((d) => (d.trim() ? d : body));
      }
    } catch {
      setComments((c) => c.filter((x) => x.id !== tempId));
      setDraft((d) => (d.trim() ? d : body));
    } finally {
      setPosting(false);
    }
  };

  const remove = async (id: string) => {
    // Snapshot for the rollback. Taken from the updater rather than the render
    // closure so a comment that arrived since this render is not lost by it.
    let snapshot: Comment[] = [];
    setComments((c) => {
      snapshot = c;
      return c.filter((x) => x.id !== id);
    });
    try {
      const r = await fetch(`/api/news/social?id=${id}`, { method: "DELETE" });
      // Was: `catch { /* ignore */ }` with no check on the response either. A
      // failed delete removed the comment from view and left it on the server,
      // so it reappeared on the next load with nothing having said why.
      if (!r.ok) setComments(snapshot);
    } catch {
      setComments(snapshot);
    }
  };

  return (
    <div className="mt-4 border-t border-white/10 pt-3">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleLike}
          disabled={!loggedIn}
          aria-label={liked ? "Unlike" : "Like"}
          className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors disabled:opacity-60", liked ? "text-red-400" : "text-zinc-400 hover:text-zinc-100")}
        >
          <Heart className={cn("h-4 w-4 transition-transform active:scale-90", liked && "fill-red-400")} /> {likes > 0 ? likes : "Like"}
        </button>
        <button
          onClick={() => setShowComments((v) => !v)}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-400 transition-colors hover:text-zinc-100"
        >
          <MessageCircle className="h-4 w-4" /> {comments.length > 0 ? comments.length : ""} Comment{comments.length === 1 ? "" : "s"}
        </button>
      </div>

      {showComments && (
        <div className="mt-3 space-y-3">
          {loggedIn ? (
            <div className="flex items-start gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
                placeholder="Add a comment…"
                rows={2}
                maxLength={1000}
                className="min-h-[38px] flex-1 resize-none rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2 text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-gold-500/40 focus:ring-1 focus:ring-gold-500/20"
              />
              <button onClick={submit} disabled={!draft.trim() || posting} aria-label="Send comment" className="btn-primary relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl p-0 disabled:opacity-50">
                {posting ? <Loader2 className="relative z-10 h-[18px] w-[18px] animate-spin !text-white" /> : <SendGlyph className="relative z-10 h-[18px] w-[18px]" />}
              </button>
            </div>
          ) : (
            <p className="text-[12px] text-zinc-500"><Link href="/login" className="text-gold-200 hover:underline">Log in</Link> to like and comment.</p>
          )}

          {!loaded ? (
            <p className="py-2 text-center text-[12px] text-zinc-500"><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> Loading…</p>
          ) : comments.length ? (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="flex gap-2.5">
                  {c.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-white/10" />
                  ) : (
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold-500/15 text-[11px] font-semibold text-gold-200">{c.name.charAt(0).toUpperCase()}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                      {c.username ? <Link href={`/u/${c.username}`} className="font-medium text-zinc-300 hover:underline">{c.name}</Link> : <span className="font-medium text-zinc-300">{c.name}</span>}
                      <span>·</span>
                      <span className="mono">{now ? timeAgo(new Date(c.createdAt).getTime(), now) : ""}</span>
                      {c.username && !c.mine && <span className="ml-auto"><MessageButton username={c.username} compact /></span>}
                      {c.mine && <button onClick={() => remove(c.id)} aria-label="Delete" className="ml-auto text-zinc-600 hover:text-red-400"><Trash2 className="h-3 w-3" /></button>}
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-zinc-200">{c.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-1 text-[12px] text-zinc-500">No comments yet. Be the first.</p>
          )}
        </div>
      )}
    </div>
  );
}
