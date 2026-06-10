import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Markdown } from "@/lib/markdown";
import { prisma } from "@/lib/prisma";
import { formatDate, readingTime } from "@/lib/utils";
import { JsonLd, articleJsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { PostCard } from "@/components/PostCard";

// Cached per-article; revalidated on demand when admin deletes (research route).
export const revalidate = 300;

async function getPost(slug: string) {
  return prisma.post
    .findFirst({
      where: { slug, published: true },
      include: { author: { select: { name: true } } },
    })
    .catch(() => null);
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getPost(params.slug);
  if (!post) return { title: "Not found" };
  const url = `/research/${post.slug}`;
  const images = post.cover ? [post.cover] : ["/logo.jpg"];
  const keywords = post.tags
    ? post.tags.split(",").map((t) => t.trim()).filter(Boolean)
    : undefined;
  return {
    title: post.title,
    description: post.excerpt,
    keywords,
    alternates: { canonical: url },
    authors: [{ name: post.author?.name ?? "XYZ Crypto" }],
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      url,
      images,
      publishedTime: new Date(post.createdAt).toISOString(),
      modifiedTime: new Date(post.updatedAt).toISOString(),
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images,
    },
  };
}

export default async function PostPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = await getPost(params.slug);
  if (!post) notFound();

  const related = await prisma.post
    .findMany({
      where: { published: true, category: post.category, slug: { not: post.slug } },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { author: { select: { name: true } } },
    })
    .catch(() => []);

  const tags = post.tags
    ? post.tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  return (
    <>
      <JsonLd data={articleJsonLd(post)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Research", path: "/research" },
          { name: post.title, path: `/research/${post.slug}` },
        ])}
      />
      <Navbar />
      <main className="relative min-h-screen pt-28">
        <div className="mesh" />
        <article className="relative mx-auto max-w-3xl px-4 pb-24 sm:px-6">
          <Link
            href="/research"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-gold-200"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M19 12H5M11 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            All research
          </Link>

          <div className="mt-6">
            <span className="rounded-full bg-gold-500/10 px-3 py-1 text-xs font-semibold text-gold-200 ring-1 ring-gold-500/30">
              {post.category}
            </span>
            <h1 className="mt-4 font-display text-3xl font-bold leading-tight text-zinc-50 sm:text-5xl">
              {post.title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
              <span>{post.author?.name ?? "XYZ Crypto"}</span>
              <span className="text-zinc-700">•</span>
              <span>{formatDate(post.createdAt)}</span>
              <span className="text-zinc-700">•</span>
              <span>{readingTime(post.content)} min read</span>
            </div>
          </div>

          {post.cover && (
            <div className="relative mt-8 aspect-[16/9] w-full overflow-hidden rounded-2xl ring-1 ring-white/10">
              <Image src={post.cover} alt={post.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 768px" />
            </div>
          )}

          <p className="mt-8 text-lg leading-relaxed text-zinc-300">
            {post.excerpt}
          </p>

          <div className="prose-xyz mt-6">
            <Markdown content={post.content} />
          </div>

          {tags.length > 0 && (
            <div className="mt-10 flex flex-wrap gap-2 border-t border-white/5 pt-6">
              {tags.map((t) => (
                <span key={t} className="rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-400 ring-1 ring-white/10">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </article>

        {related.length > 0 && (
          <section className="mx-auto mt-4 max-w-5xl px-4 pb-24 sm:px-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold text-zinc-100">
                More in <span className="text-gold-gradient">{post.category}</span>
              </h2>
              <Link href="/research" className="text-sm font-medium text-gold-200 hover:underline">
                View all →
              </Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <PostCard key={p.slug} post={p} />
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
