import Link from "next/link";
import Image from "next/image";
import { formatDate, readingTime } from "@/lib/utils";

export type PostCardData = {
  slug: string;
  title: string;
  excerpt: string;
  cover: string | null;
  category: string;
  content: string;
  createdAt: Date | string;
  author?: { name: string | null } | null;
};

const catStyle: Record<string, string> = {
  Research: "text-gold-100  bg-gold-400/10 ring-gold-400/28",
  Article:  "text-sky-300   bg-sky-500/10  ring-sky-500/28",
  Post:     "text-fuchsia-300 bg-fuchsia-500/10 ring-fuchsia-500/25",
};

export function PostCard({ post }: { post: PostCardData }) {
  return (
    <Link
      href={`/research/${post.slug}`}
      className="card-gold-border group flex h-full flex-col overflow-hidden rounded-2xl hover:-translate-y-1.5"
    >
      {/* Cover image */}
      <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-ink-700">
        {post.cover ? (
          <Image
            src={post.cover}
            alt={post.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
            sizes="(max-width: 768px) 100vw, 420px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ink-600 via-ink-700 to-ink-800">
            <span className="font-display text-4xl font-extrabold text-gold-gradient opacity-25">
              XYZ
            </span>
          </div>
        )}
        {/* Category */}
        <span
          className={`absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ring-1 backdrop-blur-sm ${
            catStyle[post.category] ?? catStyle.Research
          }`}
        >
          {post.category}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-[1rem] font-semibold leading-snug text-zinc-100 transition-colors group-hover:text-gold-100">
          {post.title}
        </h3>
        <p className="mt-2.5 line-clamp-2 flex-1 text-[0.82rem] leading-[1.7] text-zinc-500">
          {post.excerpt}
        </p>

        {/* Meta row */}
        <div className="mt-5 flex items-center justify-between border-t border-white/[0.04] pt-4 text-[11px] text-zinc-600">
          <span className="font-medium text-zinc-500">
            {post.author?.name ?? "XYZ Crypto"}
          </span>
          <span className="flex items-center gap-1.5">
            <span>{formatDate(post.createdAt)}</span>
            <span className="text-zinc-700">·</span>
            <span>{readingTime(post.content)} min read</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
