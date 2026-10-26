"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Clock, Eye, Sparkles, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { SaveButton } from "@modules/research/components/SaveButton";
import { formatDate } from "@/lib/utils";
import type { PostCardData } from "@/modules/community/components/PostCard";

interface FeaturedResearchCardProps {
  post: PostCardData;
}

export function FeaturedResearchCard({ post }: FeaturedResearchCardProps) {
  const tagList = post.tags
    ? post.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];

  const authorName = post.author?.name || "XYZ Research Desk";
  const initials = authorName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="neu-card group relative overflow-hidden rounded-3xl p-6 sm:p-8 shadow-neu-lg border border-white/[0.04] transition-all duration-300">
      {/* Subtle ambient lighting */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gold-500/10 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-mint-500/10 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />

      <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8 items-center">
        {/* Left: Cinematic Cover Image in Neumorphic Frame */}
        <div className="lg:col-span-6 xl:col-span-6">
          <div className="neu-frame relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-ink-950">
            {post.cover ? (
              <Image
                src={post.cover}
                alt={post.title}
                fill
                priority
                className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03] group-active:scale-[1.03]"
                sizes="(max-width: 1024px) 100vw, 50vw"
                unoptimized={post.cover.startsWith("data:")}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ink-800 to-ink-950">
                <span className="font-display text-4xl font-bold text-gold-400 opacity-40">
                  XYZ RESEARCH
                </span>
              </div>
            )}

            {/* Subtle contrast gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950/70 via-transparent to-black/20" />

            {/* Glowing Featured Tag */}
            <div className="absolute left-3.5 top-3.5 flex items-center gap-2">
              <span className="neu-raised-sm inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold tracking-wide text-gold-200 backdrop-blur-md shadow-neu-sm border border-gold-400/30 bg-ink-950/80">
                <span className="h-1.5 w-1.5 rounded-full bg-gold-400 shadow-[0_0_8px_#f59e0b] animate-pulse" />
                FEATURED REPORT
              </span>
            </div>

            {/* 1-Click Bookmark Button */}
            <div className="absolute right-3.5 top-3.5 z-10">
              <SaveButton
                slug={post.slug}
                title={post.title}
                excerpt={post.excerpt}
                cover={post.cover}
                category={post.category}
                label={false}
                className="neu-btn !rounded-full !min-h-8 !border-white/20 !bg-ink-950/80 !text-zinc-200 shadow-neu-sm hover:!text-gold-200 active:scale-95"
              />
            </div>
          </div>
        </div>

        {/* Right: Editorial Typography & Actions */}
        <div className="flex flex-col justify-between lg:col-span-6 xl:col-span-6 space-y-4">
          <div>
            {/* Top metadata strip */}
            <div className="neu-inset-sm flex flex-wrap items-center justify-between gap-2 rounded-xl px-3.5 py-2 text-xs text-zinc-600 dark:text-zinc-300 border border-zinc-200/50 dark:border-white/[0.03]">
              <div className="flex items-center gap-2.5">
                <div className="neu-convex flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-amber-700 dark:text-gold-200 border border-gold-500/30">
                  {initials}
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">{authorName}</span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-mint-400" />
                </div>
                <Badge tone="gold">
                  <span className="mono text-[10px] font-semibold uppercase">{post.category}</span>
                </Badge>
                {post.premium && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-mint-500/20 border border-mint-500/40 px-2 py-0.5 text-[10px] font-bold uppercase text-mint-300">
                    <Sparkles className="h-2.5 w-2.5" />
                    Pro
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mono text-[11px] text-zinc-600 dark:text-zinc-400">
                <span>{formatDate(post.createdAt)}</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-gold-300 font-medium">
                  <Clock className="h-3 w-3" />
                  {post.readMinutes ?? 5}m read
                </span>
                {typeof post.views === "number" && post.views > 0 && (
                  <>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
                      <Eye className="h-3 w-3" />
                      {post.views}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Headline */}
            <Link href={`/research/${post.slug}`} className="block group/link mt-3.5">
              <h2 className="font-display text-xl sm:text-2xl font-bold leading-snug tracking-tight text-zinc-900 dark:text-zinc-50 transition-colors group-hover/link:text-amber-600 dark:group-hover/link:text-gold-200">
                {post.title}
              </h2>
            </Link>

            {/* High-Contrast Excerpt */}
            <p className="mt-2.5 text-sm sm:text-base leading-relaxed text-zinc-600 dark:text-zinc-300 font-normal line-clamp-3">
              {post.excerpt}
            </p>

            {/* Sector Tags */}
            {tagList.length > 0 && (
              <div className="mt-3.5 flex flex-wrap gap-1.5">
                {tagList.map((tag) => (
                  <span
                    key={tag}
                    className="neu-raised-sm rounded-lg px-2.5 py-1 mono text-[11px] text-zinc-600 dark:text-zinc-300 border border-zinc-300/60 dark:border-white/[0.04]"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="pt-3 flex items-center justify-between border-t border-zinc-300/80 dark:border-white/[0.06]">
            <Link
              href={`/research/${post.slug}`}
              className="neu-btn-gold inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold shadow-neu-glow-gold active:scale-95 group/btn"
            >
              <span>Read Full Report</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1 group-active/btn:translate-x-1" />
            </Link>

            <span className="text-xs mono font-medium text-zinc-500 dark:text-zinc-400">
              {post.premium ? "🔒 Pro Intelligence" : "✓ Open Access"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
