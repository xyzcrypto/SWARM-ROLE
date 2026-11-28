"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { photoFallback, photoSrc } from "@shared/utils/img";

type SavedItem = {
  url: string;
  title: string;
  summary?: string | null;
  source?: string | null;
  image?: string | null;
  category?: string | null;
  publishedAt?: number | null;
  createdAt?: string | number | null;
};

/**
 * Everything the reader has saved, in one place.
 *
 * ⚠️ This page is the missing half of the save button. Saving worked; there was
 * nowhere to read from. A bookmark you cannot find later is a button that files
 * things into a drawer with no handle - and the reader only discovers that after
 * they have relied on it.
 *
 * ## One list, not two
 *
 * Research posts and news stories share the `SavedStory` store, keyed
 * `(userId, url)`. That was deliberate when the save button was built, and this
 * is where it pays off: one place to look, whatever was saved.
 *
 * A saved research post is OUR url, so it opens in-app; a news story is someone
 * else's and opens through the site's own reader. `isInternal` decides, rather
 * than the source string, because a source label is a display name and this is a
 * navigation decision.
 */
export function SavedClient() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "down" | "anon">("loading");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/news/saved", { cache: "no-store" });
      if (res.status === 401) {
        setState("anon");
        return;
      }
      const j = await res.json();
      if (res.ok && Array.isArray(j.items)) {
        setItems(j.items);
        setState("ready");
      } else setState("down");
    } catch {
      setState("down");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = useCallback(
    async (url: string) => {
      if (busy) return;
      setBusy(url);
      // Optimistic: the row goes immediately and comes back if the server
      // refuses. Waiting on a round trip to un-save something is the kind of
      // lag that makes a list feel broken.
      const before = items;
      setItems((list) => list.filter((i) => i.url !== url));
      try {
        const res = await fetch(`/api/news/saved?url=${encodeURIComponent(url)}`, { method: "DELETE" });
        if (!res.ok) setItems(before);
      } catch {
        setItems(before);
      } finally {
        setBusy(null);
      }
    },
    [busy, items]
  );

  if (state === "anon") {
    return (
      <p className="surface rounded-2xl px-5 py-8 text-center text-sm text-content-muted">
        Saved reads are per member.{" "}
        <Link href="/login" className="text-gold-200 underline underline-offset-2">
          Log in
        </Link>{" "}
        to see yours.
      </p>
    );
  }

  if (state === "loading") {
    return <p className="text-sm text-content-subtle">Loading your saved reads…</p>;
  }

  if (state === "down") {
    return (
      <p className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] px-5 py-4 text-sm leading-relaxed text-amber-200">
        Could not load your saved reads right now. Nothing has been lost - try again in a moment.
      </p>
    );
  }

  if (!items.length) {
    return (
      <div className="surface rounded-2xl px-5 py-10 text-center">
        <Bookmark className="mx-auto h-6 w-6 text-content-subtle" strokeWidth={1.7} />
        <p className="mt-3 text-sm text-content-muted">Nothing saved yet.</p>
        <p className="mt-1 text-xs text-content-subtle">
          The bookmark on any research post or news story puts it here.
        </p>
        <Link
          href="/academy/research"
          className="btn-secondary mt-4 inline-flex min-h-9 items-center text-xs"
        >
          Browse research
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-2.5">
      {items.map((i) => {
        const internal = isInternal(i.url);
        const href = internal ? pathOf(i.url) : `/news/read?u=${encodeURIComponent(i.url)}`;
        return (
          <li key={i.url}>
            <article className="surface surface-hover group rounded-2xl p-4 transition-colors sm:p-5">
              <div className="flex gap-4">
                {/* Plain <img>: served straight from its origin at zero Vercel
                    transfer, and lazy so a long list does not fetch every
                    thumbnail (cost-check, trap 3). */}
                {i.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoSrc(i.image, 240) ?? i.image}
                    data-orig={i.image}
                    alt=""
                    loading="lazy"
                    className="hidden h-20 w-28 shrink-0 rounded-xl border border-hairline object-cover sm:block"
                    onError={photoFallback((img) => (img.style.display = "none"))}
                  />
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[0.625rem]">
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 font-medium",
                        internal
                          ? "border-gold-500/30 bg-gold-500/10 text-gold-200"
                          : "border-hairline text-content-muted"
                      )}
                    >
                      {i.source || (internal ? "XYZ Crypto" : "Saved")}
                    </span>
                    {i.category && (
                      <span className="rounded-full border border-hairline px-2 py-0.5 font-medium text-content-subtle">
                        {i.category}
                      </span>
                    )}
                    {i.publishedAt ? (
                      <span className="ml-auto text-content-subtle">
                        {formatDateTime(new Date(i.publishedAt))}
                      </span>
                    ) : null}
                  </div>

                  <h2 className="mt-2 text-sm font-semibold leading-snug text-content">
                    <Link href={href} className="transition-colors hover:text-gold-100">
                      {i.title}
                    </Link>
                  </h2>

                  {i.summary && (
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-content-muted">{i.summary}</p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Link
                      href={href}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-hairline px-3 text-[0.6875rem] font-medium text-gold-200 transition-colors hover:border-gold-500/30 hover:text-gold-100"
                    >
                      {internal ? "Read it" : "Read on this site"}
                    </Link>
                    {!internal && (
                      <a
                        href={i.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-9 items-center gap-1 text-[0.6875rem] text-content-subtle transition-colors hover:text-content"
                      >
                        Original <ExternalLink className="h-3 w-3" strokeWidth={1.7} />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => void remove(i.url)}
                      disabled={busy === i.url}
                      className="ml-auto inline-flex min-h-9 items-center gap-1 text-[0.6875rem] text-content-subtle transition-colors hover:text-data-down disabled:opacity-50"
                    >
                      {busy === i.url ? (
                        <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.7} />
                      ) : (
                        <Trash2 className="h-3 w-3" strokeWidth={1.7} />
                      )}
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Whether a saved url is one of ours.
 *
 * Compared against the CURRENT origin rather than a hard-coded domain, so a
 * preview deployment does not treat its own saved links as external.
 */
function isInternal(url: string): boolean {
  try {
    return new URL(url).origin === window.location.origin;
  } catch {
    return false;
  }
}

/** The path part, so an internal link routes client-side instead of reloading. */
function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}
