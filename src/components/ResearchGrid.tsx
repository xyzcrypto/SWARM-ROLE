"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { PostCard, type PostCardData } from "./PostCard";

const categories = ["All", "Research", "Article", "Post"] as const;
type Category = (typeof categories)[number];

export function ResearchGrid({
  initial,
  total,
  pageSize,
}: {
  initial: PostCardData[];
  total: number;
  pageSize: number;
}) {
  const [items, setItems] = useState<PostCardData[]>(initial);
  const [active, setActive] = useState<Category>("All");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initial.length < total);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Skip the first filter-effect run so we keep the server-rendered first page.
  const firstRun = useRef(true);

  async function fetchPage(nextPage: number, replace: boolean) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(pageSize),
      });
      if (active !== "All") params.set("category", active);
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/research?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not load posts.");
        return;
      }
      setItems((prev) => (replace ? data.posts : [...prev, ...data.posts]));
      setPage(nextPage);
      setHasMore(Boolean(data.hasMore));
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Debounced refetch (page 1) whenever the category or search query changes.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const t = setTimeout(() => fetchPage(1, true), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, query]);

  return (
    <div>
      <div className="mb-10 flex flex-col items-center gap-5">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search research, articles, tags…"
            className="w-full rounded-full border border-white/10 bg-white/5 py-2.5 pl-11 pr-4 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-gold-500/40 focus:bg-white/[0.07]"
          />
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActive(c)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                active === c
                  ? "bg-gold-shine text-ink shadow-gold-sm"
                  : "border border-white/10 bg-white/5 text-zinc-400 hover:text-gold-100"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="mb-6 text-center text-sm text-red-300">{error}</p>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gold-500/20 bg-ink-700/40 p-16 text-center">
          <p className="font-display text-lg font-semibold text-zinc-200">
            {loading ? "Searching…" : "Nothing here yet"}
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            {query
              ? `No results for “${query}”.`
              : `New ${active === "All" ? "content" : active.toLowerCase() + "s"} will appear here soon.`}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <PostCard key={p.slug} post={p} />
            ))}
          </div>

          {hasMore && (
            <div className="mt-12 flex justify-center">
              <button
                onClick={() => fetchPage(page + 1, false)}
                disabled={loading}
                className="rounded-full border border-white/10 bg-white/5 px-7 py-3 text-sm font-semibold text-zinc-200 transition-all hover:border-gold-500/40 hover:text-gold-100 disabled:opacity-60"
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
