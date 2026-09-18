"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Save a research post to read later.
 *
 * ## Why it reuses the news saved-stories store
 *
 * ⚠️ Deliberately NOT a new table. `SavedStory` is keyed on `(userId, url)` and
 * already holds title, summary, source, image and category - every field a
 * research post needs. A second store would mean a second migration, a second
 * API, and - the part that actually matters - a **second place a reader has to
 * look for the thing they saved**.
 *
 * One saved list. A research post lands there beside a saved news story, tagged
 * with its own source so the two are still distinguishable.
 *
 * ## Absolute URL
 *
 * The store's schema is `z.string().url()`, so a bare `/research/slug` is
 * rejected. The origin is read at CLICK time, never during render: a
 * `window.location` read while rendering is a client-only signal reaching the
 * DOM, which is the React #418 trap documented in CLAUDE.md.
 */
export function SaveButton({
  slug,
  title,
  excerpt,
  cover,
  category,
  className,
  label = true,
}: {
  slug: string;
  title: string;
  excerpt?: string;
  cover?: string | null;
  category?: string;
  className?: string;
  /** Show the word as well as the icon. Cards pass false. */
  label?: boolean;
}) {
  const { data: session } = useSession();
  const loggedIn = Boolean(session?.user);

  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const path = `/research/${slug}`;

  // Whether this one is already saved. In an effect, never during render, and
  // only for a signed-in reader - an anonymous visitor has nothing to look up.
  useEffect(() => {
    if (!loggedIn) return;
    let alive = true;
    fetch("/api/news/saved", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !j) return;
        const here = `${window.location.origin}${path}`;
        setSaved(Boolean(j.items?.some((i: { url: string }) => i.url === here)));
      })
      .catch(() => {
        // A saved list we cannot read is not a reason to hide the button; the
        // toggle still works and the server is the source of truth.
      });
    return () => {
      alive = false;
    };
  }, [loggedIn, path]);

  const toggle = useCallback(async () => {
    if (busy) return;
    if (!loggedIn) {
      setNote("Log in to save this.");
      return;
    }
    setBusy(true);
    setNote(null);
    const url = `${window.location.origin}${path}`;
    try {
      if (saved) {
        const res = await fetch(`/api/news/saved?url=${encodeURIComponent(url)}`, { method: "DELETE" });
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Could not remove it.");
        setSaved(false);
      } else {
        const res = await fetch("/api/news/saved", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            url,
            title,
            summary: (excerpt ?? "").slice(0, 2000),
            // Names the lane, so a saved research piece is not mistaken for a
            // story someone else reported.
            source: "XYZ Crypto",
            image: cover || null,
            category: category || "Research",
          }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Could not save it.");
        setSaved(true);
      }
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [busy, loggedIn, saved, path, title, excerpt, cover, category]);

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy}
        aria-pressed={saved}
        aria-label={saved ? "Remove from saved" : "Save to read later"}
        title={saved ? "Saved" : "Save to read later"}
        className={cn(
          "inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors disabled:opacity-50",
          saved
            ? "border-gold-500/40 bg-gold-500/15 text-gold-200"
            : "border-hairline text-content-muted hover:text-content active:text-content",
          className
        )}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.7} />
        ) : saved ? (
          <BookmarkCheck className="h-3.5 w-3.5" strokeWidth={1.7} />
        ) : (
          <Bookmark className="h-3.5 w-3.5" strokeWidth={1.7} />
        )}
        {label && (saved ? "Saved" : "Save")}
      </button>
      {/* ⚠️ Once something IS saved, the reader needs to know where it went.
          A bookmark with no visible destination is a button that files things
          into a drawer with no handle - and they only find that out later. */}
      {saved && (
        <a
          href="/saved"
          className="mt-1 text-[11px] text-content-subtle underline underline-offset-2 transition-colors hover:text-gold-200"
        >
          See your saved reads
        </a>
      )}
      {note && <span className="mt-1 text-[11px] text-content-subtle">{note}</span>}
    </span>
  );
}
