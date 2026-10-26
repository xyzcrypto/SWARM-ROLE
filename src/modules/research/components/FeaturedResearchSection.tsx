"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Sparkles } from "lucide-react";
import type { PostCardData } from "@/modules/community/components/PostCard";
import { Avatar } from "@/components/Avatar";

interface FeaturedResearchSectionProps {
  posts: PostCardData[];
}

export function FeaturedResearchSection({ posts }: FeaturedResearchSectionProps) {
  // Take top 3 posts for the featured showcase
  const featuredList = posts.slice(0, 3);

  if (featuredList.length === 0) return null;

  return (
    <section id="featured-research" className="pt-8 pb-12 sm:pt-12 sm:pb-16">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="neu-inset-sm flex h-7 w-7 items-center justify-center rounded-lg text-gold-400">
              <Sparkles className="h-4 w-4" />
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
              Featured Research
            </h2>
          </div>
          <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            Institutional-grade teardowns, curated by our senior Web3 analysts.
          </p>
        </div>

        <div>
          <a
            href="#research-library"
            className="neu-btn inline-flex items-center gap-2.5 rounded-full px-5 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 shadow-neu-sm hover:text-black dark:hover:text-white active:scale-95 group"
          >
            <span>View All Reports</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1 group-active:translate-x-1" />
          </a>
        </div>
      </div>

      {/* 3-Card Neumorphic Grid */}
      <div className="grid grid-cols-1 gap-7 md:grid-cols-3">
        {featuredList.map((post, idx) => {
          // Badges according to index or tag
          let badgeLabel = "FEATURED";
          let badgeStyle = "border-gold-500/30 text-amber-800 dark:text-gold-300 bg-gold-500/15 dark:bg-gold-500/10";
          let dotColor = "bg-gold-400 shadow-[0_0_8px_#f59e0b]";

          if (idx === 1 || (idx !== 0 && post.tags?.toLowerCase().includes("layer 2"))) {
            badgeLabel = "LAYER 2";
            badgeStyle = "border-indigo-500/30 text-indigo-700 dark:text-indigo-300 bg-indigo-500/15 dark:bg-indigo-500/10";
            dotColor = "bg-indigo-400 shadow-[0_0_8px_#818cf8]";
          } else if (idx === 2 || (idx !== 0 && post.tags?.toLowerCase().includes("tokenomics"))) {
            badgeLabel = "TOKENOMICS";
            badgeStyle = "border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 dark:bg-emerald-500/10";
            dotColor = "bg-emerald-400 shadow-[0_0_8px_#34d399]";
          }

          const dateStr = post.createdAt
            ? new Date(post.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "Recently";

          const readTime = post.readMinutes ? `${post.readMinutes} min read` : "8 min read";
          const authorName = post.author?.name?.replace(/\s*\(.*?\)\s*/g, "") || "XYZ Analyst";

          return (
            <Link
              key={post.id || post.slug}
              href={`/research/${post.slug}`}
              className="neu-card group relative flex flex-col justify-between overflow-hidden rounded-3xl p-5 shadow-neu-lg border border-white/[0.04] transition-all duration-300 hover:-translate-y-1 hover:shadow-neu-glow-gold active:translate-y-0 active:scale-[0.99]"
            >
              <div>
                {/* Neumorphic Inset Frame for Cover Image */}
                <div className="neu-frame relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-ink-950">
                  {post.cover ? (
                    <Image
                      src={post.cover}
                      alt={post.title}
                      fill
                      unoptimized
                      className="object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105 group-active:scale-105"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ink-800 to-ink-950">
                      <span className="font-display text-sm font-bold text-gold-400 opacity-60">XYZ RESEARCH</span>
                    </div>
                  )}

                  {/* Top-left Category Pill */}
                  <div className="absolute left-3 top-3 z-10">
                    <span
                      className={`neu-raised-sm inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold tracking-wider backdrop-blur-md shadow-neu-sm ${badgeStyle}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                      {badgeLabel}
                    </span>
                  </div>
                </div>

                {/* Article Title */}
                <h3 className="mt-4 text-base font-bold leading-snug text-zinc-900 dark:text-white transition-colors duration-200 group-hover:text-amber-600 dark:group-hover:text-gold-200 line-clamp-2">
                  {post.title}
                </h3>

                {/* Article Excerpt */}
                {post.excerpt && (
                  <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400 line-clamp-2">
                    {post.excerpt}
                  </p>
                )}
              </div>

              {/* Author & Read Time Footer - Recessed Neumorphic Rail */}
              <div className="neu-inset-sm mt-5 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[11px] text-zinc-600 dark:text-zinc-400 border border-zinc-200/50 dark:border-white/[0.03]">
                <Avatar
                  name={authorName}
                  image={post.author?.image}
                  size="sm"
                  ring={false}
                  className="!h-6 !w-6"
                />
                <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[110px]">
                  {authorName}
                </span>
                <span className="text-zinc-400 dark:text-zinc-600">•</span>
                <span>{dateStr}</span>
                <span className="text-zinc-400 dark:text-zinc-600">•</span>
                <span>{readTime}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
