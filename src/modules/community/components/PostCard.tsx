import Link from "next/link";
import Image from "next/image";
import { formatDate, readingTime } from "@/lib/utils";
import { Badge } from "@/components/ui/primitives";
import { TiltCard } from "@/components/TiltCard";

export type PostCardData = {
  slug: string;
  title: string;
  excerpt: string;
  cover: string | null;
  category: string;
  /** Full body optional - list payloads ship a precomputed readMinutes instead. */
  content?: string;
  readMinutes?: number;
  premium?: boolean;
  createdAt: Date | string;
  author?: { name: string | null } | null;
};

const catTone: Record<string, "gold" | "sky" | "violet"> = {
  Research: "gold",
  Article: "sky",
  Post: "violet",
};

export function PostCard({ post, priority }: { post: PostCardData; priority?: boolean }) {
  return (
    <TiltCard max={5}>
    <Link
      href={`/research/${post.slug}`}
      className="surface surface-hover lift group flex h-full flex-col overflow-hidden rounded-3xl"
    >
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
            <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-ink-900/60 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ink-700 to-ink-900">
            <span className="font-display text-3xl font-bold text-gold-gradient opacity-40">XYZ</span>
          </div>
        )}
        <div className="absolute left-3 top-3 flex gap-1.5">
          <Badge tone={catTone[post.category] ?? "gold"}>
            <span className="mono text-[10px] uppercase tracking-wider">{post.category}</span>
          </Badge>
          {post.premium && (
            <span className="inline-flex items-center rounded-full bg-gold-shine px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink">
              Premium
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-lg font-semibold leading-snug text-zinc-50 transition-colors group-hover:text-gold-100">
          {post.title}
        </h3>
        <p className="mt-2 line-clamp-2 flex-1 text-sm text-zinc-400">{post.excerpt}</p>
        <div className="mt-4 flex items-center justify-between mono text-[11px] text-zinc-500">
          <span>{post.author?.name ?? "XYZ Crypto"}</span>
          <span>
            {formatDate(post.createdAt)}
            {post.premium ? " · 🔒" : ` · ${post.readMinutes ?? readingTime(post.content ?? "")}m`}
          </span>
        </div>
      </div>
    </Link>
    </TiltCard>
  );
}
