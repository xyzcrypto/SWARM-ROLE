"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Sparkles,
  X,
  LayoutGrid,
  List,
  SlidersHorizontal,
  RotateCcw,
  Flame,
} from "lucide-react";
import { type PostCardData } from "@/modules/community/components/PostCard";
import { MicButton } from "@/shared/components/MicButton";
import { FeaturedResearchCard } from "./FeaturedResearchCard";
import { ResearchCard } from "./ResearchCard";
import { PostListCard } from "./PostListCard";

const categories = ["All", "Research", "Article", "Post"] as const;
type Category = (typeof categories)[number] | "Premium";

const SECTOR_TAGS = [
  "All Sectors",
  "DeFi",
  "Layer 2",
  "Solana",
  "Restaking",
  "AI Agents",
  "Perp DEX",
  "Airdrops",
] as const;

type SortOption = "newest" | "shortest" | "deepdive";

export function ResearchGrid({
  initial,
  total,
  pageSize,
  categoryCounts,
  hideHeroFeatured = false,
}: {
  initial: PostCardData[];
  total: number;
  pageSize: number;
  categoryCounts?: Record<string, number>;
  hideHeroFeatured?: boolean;
}) {
  const [items, setItems] = useState<PostCardData[]>(initial);
  const [active, setActive] = useState<Category>("All");
  const [activeSector, setActiveSector] = useState<string>("All Sectors");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => (searchParams?.get("q") ?? "").slice(0, 100));
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initial.length < total);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const firstRun = useRef(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut to focus search with "/"
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function fetchPage(nextPage: number, replace: boolean) {
    setLoading(true);
    setError("");
    try {
      const effectiveQuery = [
        query.trim(),
        activeSector !== "All Sectors" ? activeSector : "",
      ]
        .filter(Boolean)
        .join(" ");

      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(pageSize),
      });

      if (active === "Premium") params.set("premium", "1");
      else if (active !== "All") params.set("category", active);
      if (effectiveQuery.trim()) params.set("q", effectiveQuery.trim());

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

  // Debounced refetch (page 1) whenever category, query or sector tag changes
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const t = setTimeout(() => fetchPage(1, true), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, query, activeSector]);

  // Client-side sorting for current list
  const sortedItems = useMemo(() => {
    const list = [...items];
    if (sortBy === "shortest") {
      return list.sort((a, b) => (a.readMinutes ?? 5) - (b.readMinutes ?? 5));
    }
    if (sortBy === "deepdive") {
      return list.sort((a, b) => (b.readMinutes ?? 5) - (a.readMinutes ?? 5));
    }
    // Default newest
    return list;
  }, [items, sortBy]);

  // Show featured banner ONLY on page 1, when no query, "All" category, and "All Sectors"
  const isDefaultView =
    active === "All" &&
    activeSector === "All Sectors" &&
    !query.trim() &&
    page === 1;

  const featuredPost =
    !hideHeroFeatured && isDefaultView && sortedItems.length > 0 ? sortedItems[0] : null;
  const gridPosts = !hideHeroFeatured && isDefaultView ? sortedItems.slice(1) : sortedItems;

  const resetAll = () => {
    setActive("All");
    setActiveSector("All Sectors");
    setQuery("");
    setSortBy("newest");
  };

  return (
    <div className="space-y-10">
      {/* ── 1. Hero Featured Deep Dive ── */}
      {featuredPost && (
        <section aria-label="Featured Research" className="mb-8">
          <FeaturedResearchCard post={featuredPost} />
        </section>
      )}

      {/* ── 2. Unified Neumorphic Discovery Toolbar ── */}
      <div className="neu-convex rounded-3xl p-5 sm:p-6 lg:p-7 shadow-neu-lg border border-white/[0.04]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          {/* Deep Recessed Search Box */}
          <div className="relative w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gold-400" />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search reports, tokenomics, protocols… (Press /)"
              className="neu-inset-deep w-full rounded-2xl py-3.5 pl-11 pr-20 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition-colors placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-gold-500/40 focus:ring-1 focus:ring-gold-500/30"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="neu-btn rounded-full p-1.5 text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white active:scale-90"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <MicButton
                size="sm"
                className="!rounded-full !ring-0 text-zinc-500 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-gold-200"
                onText={(t) => setQuery((v) => (v ? `${v} ${t}` : t))}
              />
            </div>
          </div>

          {/* Primary Category Filters - Tactile Switch Array */}
          <div className="flex flex-wrap items-center gap-2.5">
            {categories.map((c) => {
              const count = categoryCounts ? categoryCounts[c] : undefined;
              const isActive = active === c;
              return (
                <button
                  key={c}
                  onClick={() => setActive(c)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                    isActive
                      ? "neu-inset border border-amber-500/40 dark:border-gold-500/40 text-amber-800 dark:text-amber-300 shadow-neu-inset"
                      : "neu-btn text-zinc-700 dark:text-zinc-300 shadow-neu-sm hover:text-black dark:hover:text-white active:scale-95"
                  }`}
                >
                  {c}
                  {typeof count === "number" && (
                    <span
                      className={`mono text-[10px] ${
                        isActive ? "text-amber-700 dark:text-amber-200" : "text-zinc-500 dark:text-zinc-400"
                      }`}
                    >
                      ({count})
                    </span>
                  )}
                </button>
              );
            })}

            {/* Premium Alpha Button */}
            <button
              onClick={() => setActive("Premium")}
              aria-pressed={active === "Premium"}
              className={`group relative inline-flex items-center gap-1.5 overflow-hidden rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                active === "Premium"
                  ? "neu-inset border border-mint-500/50 dark:border-mint-500/40 text-mint-700 dark:text-mint-200 shadow-neu-inset"
                  : "neu-btn text-mint-700 dark:text-mint-300 shadow-neu-sm border border-mint-500/40 hover:border-mint-500/70 active:scale-95"
              }`}
            >
              <Sparkles
                className={`h-3.5 w-3.5 transition-transform group-hover:rotate-12 ${
                  active === "Premium" ? "text-mint-700 dark:text-mint-200" : "text-mint-600 dark:text-mint-300 animate-pulse"
                }`}
              />
              Premium Alpha
              {typeof categoryCounts?.Premium === "number" && (
                <span className="mono text-[10px] text-mint-700 dark:text-mint-200">
                  ({categoryCounts.Premium})
                </span>
              )}
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full group-active:translate-x-full" />
            </button>
          </div>
        </div>

        {/* ── Sector Tags Cloud & View Toggle Bar ── */}
        <div className="mt-5 flex flex-col gap-3.5 border-t border-zinc-200/60 dark:border-white/[0.05] pt-5 sm:flex-row sm:items-center sm:justify-between">
          {/* Recessed Sector Tag Cloud */}
          <div className="neu-inset-sm flex items-center gap-2 overflow-x-auto p-1.5 px-3 rounded-2xl border border-zinc-200/50 dark:border-white/[0.03] scrollbar-none">
            <span className="inline-flex items-center gap-1 mono text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-300 shrink-0 mr-1">
              <Flame className="h-3.5 w-3.5 text-gold-400" />
              Sectors:
            </span>
            {SECTOR_TAGS.map((sector) => {
              const isSelected = activeSector === sector;
              return (
                <button
                  key={sector}
                  onClick={() => setActiveSector(sector)}
                  className={`shrink-0 rounded-xl px-3 py-1 text-xs font-medium transition-all duration-150 ${
                    isSelected
                      ? "neu-inset text-amber-800 dark:text-amber-300 border border-gold-500/30 shadow-neu-inset-sm"
                      : "neu-raised-sm text-zinc-700 dark:text-zinc-300 shadow-neu-sm hover:text-black dark:hover:text-white active:scale-95"
                  }`}
                >
                  {sector === "All Sectors" ? sector : `#${sector}`}
                </button>
              );
            })}
          </div>

          {/* Right Controls: Sort & View Toggle */}
          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
            {/* Sort Select */}
            <div className="neu-inset-sm flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 border border-zinc-200/50 dark:border-white/[0.03]">
              <SlidersHorizontal className="h-3.5 w-3.5 text-gold-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Sort research posts"
                className="bg-transparent text-xs text-zinc-800 dark:text-zinc-200 outline-none cursor-pointer"
              >
                <option value="newest" className="bg-[#ebf0f7] dark:bg-[#12141c] text-zinc-900 dark:text-white">Newest First</option>
                <option value="shortest" className="bg-[#ebf0f7] dark:bg-[#12141c] text-zinc-900 dark:text-white">Shortest Read (&lt;5m)</option>
                <option value="deepdive" className="bg-[#ebf0f7] dark:bg-[#12141c] text-zinc-900 dark:text-white">Deep Dives (&gt;8m)</option>
              </select>
            </div>

            {/* View Mode Toggle - Dual Position Recessed Rocker */}
            <div className="neu-inset-sm flex items-center rounded-xl p-1 border border-zinc-200/50 dark:border-white/[0.03]">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                aria-label="Grid View"
                className={`rounded-lg p-1.5 transition-all ${
                  viewMode === "grid"
                    ? "neu-convex text-amber-700 dark:text-gold-300 shadow-neu-sm"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-label="List View"
                className={`rounded-lg p-1.5 transition-all ${
                  viewMode === "list"
                    ? "neu-convex text-amber-700 dark:text-gold-300 shadow-neu-sm"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="neu-card rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-300">
          {error}
        </div>
      )}

      {/* ── 3. Content Display ── */}
      {sortedItems.length === 0 ? (
        /* Empty State */
        <div className="neu-inset rounded-3xl p-16 text-center border border-zinc-200/50 dark:border-white/[0.04]">
          <div className="neu-convex mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-amber-700 dark:text-gold-300 shadow-neu-sm border border-gold-500/30">
            <Search className="h-6 w-6" />
          </div>
          <h3 className="mt-4 font-display text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {loading ? "Scanning On-Chain Knowledge…" : "No matching reports found"}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
            {query || activeSector !== "All Sectors"
              ? `We couldn't find research matching your active filters. Try refining keywords or resetting filters.`
              : active === "Premium"
                ? "New institutional premium research is dropping soon."
                : `New reports will appear here soon.`}
          </p>
          {(query || activeSector !== "All Sectors" || active !== "All") && (
            <button
              onClick={resetAll}
              className="neu-btn mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-semibold text-amber-700 dark:text-gold-300 shadow-neu-sm hover:text-amber-800 dark:hover:text-gold-200 active:scale-95"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset All Filters
            </button>
          )}
        </div>
      ) : (
        /* Posts Listing */
        <>
          {viewMode === "grid" ? (
            <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {gridPosts.map((p, i) => (
                <div key={p.slug} className="contents">
                  <ResearchCard post={p} priority={i === 0 && !featuredPost} />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              {gridPosts.map((p) => (
                <div key={p.slug} className="space-y-5">
                  <PostListCard post={p} />
                </div>
              ))}
            </div>
          )}

          {/* Load More Button */}
          {hasMore && (
            <div className="mt-14 flex justify-center">
              <button
                onClick={() => fetchPage(page + 1, false)}
                disabled={loading}
                className="neu-btn inline-flex items-center gap-2.5 rounded-full px-8 py-3.5 text-sm font-bold text-zinc-800 dark:text-zinc-200 shadow-neu hover:text-amber-600 dark:hover:text-gold-200 active:scale-95 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-gold-400 border-t-transparent" />
                    Loading Reports…
                  </>
                ) : (
                  "Load More Research"
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
