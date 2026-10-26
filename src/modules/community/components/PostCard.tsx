import Link from "next/link";
import Image from "next/image";
import { formatDate, readingTime } from "@/lib/utils";
import { Badge } from "@/components/ui/primitives";
import { TiltCard } from "@/components/TiltCard";
import { SaveButton } from "@modules/research/components/SaveButton";
import { Clock, Eye } from "lucide-react";

export type PostCardData = {
  id?: string;
  slug: string;
  title: string;
  excerpt: string;
  cover: string | null;
  category: string;
  tags?: string;
  /** Full body optional - list payloads ship a precomputed readMinutes instead. */
  content?: string;
  readMinutes?: number;
  premium?: boolean;
  views?: number;
  createdAt: Date | string;
  author?: { name: string | null; image?: string | null } | null;
};

const catTone: Record<string, "gold" | "sky" | "violet"> = {
  Research: "gold",
  Article: "sky",
  Post: "violet",
};

export function PostCard({ post, priority }: { post: PostCardData; priority?: boolean }) {
  const authorName = post.author?.name ?? "XYZ Crypto";
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
    <TiltCard max={5}>
      <div className="surface surface-hover lift group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-ink-900/60 transition-all duration-300 hover:border-gold-500/30">
        {/* Clickable base link */}
        <Link
          href={`/research/${post.slug}`}
          className="absolute inset-0 z-0"
          aria-label={`Read ${post.title}`}
        />

        {/* Visual Media Header */}
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-ink-700">
          {post.cover ? (
            <>
              <Image
                src={post.cover}
                alt={post.title}
                fill
                className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
                sizes="(max-width: 640px) 95vw, (max-width: 1024px) 50vw, 33vw"
                unoptimized={post.cover.startsWith("data:")}
                priority={priority}
              />
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink-950/80 to-transparent" />
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ink-700 to-ink-900">
              <span className="font-display text-3xl font-bold text-gold-gradient opacity-40">XYZ</span>
            </div>
          )}

          {/* Badges */}
          <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap gap-1.5">
            <Badge tone={catTone[post.category] ?? "gold"}>
              <span className="mono text-[10px] font-semibold uppercase tracking-wider">{post.category}</span>
            </Badge>
            {post.premium && (
              <span className="inline-flex items-center rounded-full bg-gold-shine px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink shadow-gold-sm">
                Premium
              </span>
            )}
            {firstTag && (
              <span className="hidden sm:inline-flex rounded-md border border-white/10 bg-ink-900/80 px-1.5 py-0.5 mono text-[10px] text-zinc-300 backdrop-blur-sm">
                #{firstTag}
              </span>
            )}
          </div>

          {/* 1-Click Bookmark Button */}
          <div className="absolute right-3 top-3 z-20">
            <SaveButton
              slug={post.slug}
              title={post.title}
              excerpt={post.excerpt}
              cover={post.cover}
              category={post.category}
              label={false}
              className="!min-h-8 !border-white/15 !bg-black/60 !text-zinc-200 backdrop-blur-md hover:!border-gold-400/40 hover:!bg-black/80"
            />
          </div>
        </div>

        {/* Content Body */}
        <div className="pointer-events-none relative z-10 flex flex-1 flex-col p-5">
          <h3 className="font-display text-lg font-semibold leading-snug text-zinc-50 transition-colors group-hover:text-gold-100">
            {post.title}
          </h3>
          <p className="mt-2 line-clamp-2 flex-1 text-sm text-zinc-300 leading-relaxed font-normal">{post.excerpt}</p>

          <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3 mono text-[11px] text-zinc-400">
            <div className="flex items-center gap-1.5">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gold-500/20 text-[9px] font-bold text-gold-300">
                {initials}
              </div>
              <span className="text-zinc-300">{authorName}</span>
            </div>

            <div className="flex items-center gap-2">
              <span>{formatDate(post.createdAt)}</span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 text-zinc-400">
                <Clock className="h-3 w-3 text-gold-400" />
                {post.premium ? "🔒" : `${post.readMinutes ?? readingTime(post.content ?? "")}m`}
              </span>
              {typeof post.views === "number" && post.views > 0 && (
                <>
                  <span>•</span>
                  <span className="hidden xs:inline-flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {post.views}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </TiltCard>
  );
}
