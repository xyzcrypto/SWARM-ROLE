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

const catColor: Record<string, string> = {
  Research: "text-gold-200 bg-gold-500/10 ring-gold-500/30",
  Article: "text-sky-300 bg-sky-500/10 ring-sky-500/30",
  Post: "text-fuchsia-300 bg-fuchsia-500/10 ring-fuchsia-500/30",
};

export function PostCard({ post }: { post: PostCardData }) {
  return (
    <Link
      href={`/research/${post.slug}`}
      className="card-gold-border group flex h-full flex-col overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-gold-sm"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-ink-600">
        {post.cover ? (
          <Image
            src={post.cover}
            alt={post.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 400px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ink-600 to-ink-800">
            <span className="font-display text-3xl font-bold text-gold-gradient opacity-40">
              XYZ
            </span>
          </div>
        )}
        <span
          className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 backdrop-blur ${
            catColor[post.category] ?? catColor.Research
          }`}
        >
          {post.category}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-lg font-semibold leading-snug text-zinc-50 transition-colors group-hover:text-gold-100">
          {post.title}
        </h3>
        <p className="mt-2 line-clamp-2 flex-1 text-sm text-zinc-400">
          {post.excerpt}
        </p>
        <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
          <span>{post.author?.name ?? "XYZ Crypto"}</span>
          <span>
            {formatDate(post.createdAt)} · {readingTime(post.content)} min read
          </span>
        </div>
      </div>
    </Link>
  );
}
