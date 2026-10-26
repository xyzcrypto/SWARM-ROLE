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

export function PostListCard({ post }: { post: PostCardData }) {
  const authorName = post.author?.name || "XYZ Crypto";
  const initials = authorName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const tagList = post.tags
    ? post.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 2)
    : [];

  return (
    <div className="neu-card group relative overflow-hidden rounded-3xl p-5 shadow-neu transition-all duration-300 hover:shadow-neu-lg active:scale-[0.99]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Neumorphic Inset Thumbnail */}
        <div className="neu-frame relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-2xl bg-ink-950 sm:w-48 md:w-56">
          {post.cover ? (
            <Image
              src={post.cover}
              alt={post.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105 group-active:scale-105"
              sizes="(max-width: 640px) 100vw, 240px"
              unoptimized={post.cover.startsWith("data:")}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ink-800 to-ink-950">
              <span className="font-display text-2xl font-bold text-gold-400 opacity-40">XYZ</span>
            </div>
          )}

          <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
            <span className="neu-raised-sm rounded-full px-2.5 py-0.5 mono text-[9px] font-bold uppercase tracking-wider text-amber-200 bg-ink-950/80 border border-gold-500/30">
              {post.category}
            </span>
            {post.premium && (
              <span className="neu-raised-sm inline-flex items-center gap-0.5 rounded-full bg-mint-500 px-2 py-0.5 text-[9px] font-bold uppercase text-ink shadow-sm">
                <Sparkles className="h-2.5 w-2.5" />
                Pro
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col justify-between">
          <div>
            {/* Meta bar */}
            <div className="neu-inset-sm flex items-center justify-between rounded-xl px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 border border-zinc-200/50 dark:border-white/[0.03]">
              <div className="flex items-center gap-2">
                <div className="neu-convex flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-amber-700 dark:text-gold-300 border border-gold-500/25">
                  {initials}
                </div>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{authorName}</span>
                <span>•</span>
                <span>{formatDate(post.createdAt)}</span>
              </div>

              <div className="flex items-center gap-2 mono text-[11px] text-zinc-600 dark:text-zinc-400">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3 text-amber-600 dark:text-gold-400" />
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

            {/* Title */}
            <Link href={`/research/${post.slug}`} className="mt-3 block">
              <h3 className="font-display text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 transition-colors group-hover:text-amber-600 dark:group-hover:text-gold-200">
                {post.title}
              </h3>
            </Link>

            {/* Excerpt */}
            <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-300 font-normal leading-relaxed">
              {post.excerpt}
            </p>
          </div>

          {/* Footer & Actions */}
          <div className="mt-3 flex items-center justify-between pt-2.5 border-t border-zinc-300/80 dark:border-white/[0.05]">
            <div className="flex items-center gap-1.5">
              {tagList.map((tag) => (
                <span
                  key={tag}
                  className="neu-raised-sm rounded-lg px-2 py-0.5 mono text-[10px] text-zinc-600 dark:text-zinc-300 border border-zinc-300/60 dark:border-white/[0.04]"
                >
                  #{tag}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <SaveButton
                slug={post.slug}
                title={post.title}
                excerpt={post.excerpt}
                cover={post.cover}
                category={post.category}
                label={false}
                className="neu-btn !rounded-full !min-h-7 !px-2.5 text-zinc-500 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-gold-200"
              />
              <Link
                href={`/research/${post.slug}`}
                className="neu-btn-gold inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold shadow-neu-sm hover:brightness-105 active:scale-95"
              >
                <span>Read</span>
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-active:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
