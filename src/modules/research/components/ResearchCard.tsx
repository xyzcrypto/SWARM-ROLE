"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Clock, Eye, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { SaveButton } from "@modules/research/components/SaveButton";
import { formatDate } from "@/lib/utils";
import type { PostCardData } from "@/modules/community/components/PostCard";

const catTone: Record<string, "gold" | "sky" | "violet"> = {
  Research: "gold",
  Article: "sky",
  Post: "violet",
};

export function ResearchCard({ post, priority }: { post: PostCardData; priority?: boolean }) {
  const authorName = post.author?.name || "XYZ Research Desk";
  const initials = authorName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const firstTag = post.tags
    ? post.tags
        .split(",")
        .map((t) => t.trim())
        .find(Boolean)
    : undefined;

  return (
    <div className="neu-card group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl p-5 shadow-neu-lg border border-white/[0.04] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-neu-glow-gold active:translate-y-0 active:scale-[0.99]">
      {/* Clickable base link */}
      <Link
        href={`/research/${post.slug}`}
        className="absolute inset-0 z-0"
        aria-label={`Read ${post.title}`}
      />

      <div>
        {/* Neumorphic Inset Frame for Cover Media */}
        <div className="neu-frame relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-ink-950">
          {post.cover ? (
            <>
              <Image
                src={post.cover}
                alt={post.title}
                fill
                className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105 group-active:scale-105"
                sizes="(max-width: 640px) 95vw, (max-width: 1024px) 50vw, 33vw"
                unoptimized={post.cover.startsWith("data:")}
                priority={priority}
              />
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink-950/80 to-transparent" />
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ink-800 to-ink-950">
              <span className="font-display text-3xl font-bold text-gold-400 opacity-40">XYZ</span>
            </div>
          )}

          {/* Badges in Top-Left */}
          <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap gap-1.5">
            <span className="neu-raised-sm rounded-full px-2.5 py-0.5 mono text-[10px] font-bold uppercase tracking-wider text-amber-200 bg-ink-950/85 border border-gold-500/30 shadow-neu-sm">
              {post.category}
            </span>
            {post.premium && (
              <span className="neu-raised-sm inline-flex items-center gap-1 rounded-full bg-mint-500 px-2.5 py-0.5 text-[10px] font-bold uppercase text-ink shadow-sm">
                <Sparkles className="h-2.5 w-2.5" />
                Pro
              </span>
            )}
            {firstTag && (
              <span className="neu-raised-sm hidden sm:inline-flex rounded-full px-2 py-0.5 mono text-[10px] text-zinc-300 bg-ink-950/80 border border-white/[0.04]">
                #{firstTag}
              </span>
            )}
          </div>

          {/* 1-Click Bookmark Button in Top-Right */}
          <div className="absolute right-3 top-3 z-20">
            <SaveButton
              slug={post.slug}
              title={post.title}
              excerpt={post.excerpt}
              cover={post.cover}
              category={post.category}
              label={false}
              className="neu-btn !rounded-full !h-8 !w-8 !min-h-8 !border-white/10 !bg-ink-950/85 !text-zinc-300 shadow-neu-sm hover:!text-gold-200 active:scale-95 flex items-center justify-center"
            />
          </div>
        </div>

        {/* Title */}
        <h3 className="mt-4 font-display text-base sm:text-lg font-bold leading-snug text-zinc-900 dark:text-white transition-colors duration-200 group-hover:text-amber-600 dark:group-hover:text-gold-200 line-clamp-2">
          {post.title}
        </h3>

        {/* Excerpt */}
        {post.excerpt && (
          <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300 line-clamp-2">
            {post.excerpt}
          </p>
        )}
      </div>

      {/* Recessed Footer Meta Strip */}
      <div className="neu-inset-sm mt-5 flex items-center justify-between rounded-xl px-3 py-2 text-[11px] text-zinc-600 dark:text-zinc-400 border border-zinc-200/50 dark:border-white/[0.03]">
        <div className="flex items-center gap-2">
          <div className="neu-convex flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-amber-700 dark:text-gold-300 border border-gold-500/30">
            {initials}
          </div>
          <span className="truncate max-w-[100px] font-medium text-zinc-800 dark:text-zinc-300">{authorName}</span>
          <span className="text-zinc-400 dark:text-zinc-600">•</span>
          <span>{formatDate(post.createdAt)}</span>
        </div>

        <div className="flex items-center gap-2 mono text-[11px] text-zinc-600 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-gold-300 font-medium">
            <Clock className="h-3 w-3" />
            {post.readMinutes ?? 5}m
          </span>
          {typeof post.views === "number" && post.views > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {post.views}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
