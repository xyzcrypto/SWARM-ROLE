import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Markdown } from "@/lib/markdown";
import { prisma } from "@/lib/prisma";
import { formatDate, readingTime } from "@/lib/utils";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { JsonLd, articleJsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { PostCard } from "@/components/PostCard";
import { ReadingProgress } from "@/components/ReadingProgress";
import { ShareRow } from "@/components/ShareRow";
import { PremiumLock } from "@/components/PremiumLock";
import { CommentSection } from "@/components/CommentSection";
import { LikeButton } from "@/components/LikeButton";
import { POST_CARD_SELECT } from "@/lib/post-select";
import { AwardXpOnView } from "@/components/AwardXpOnView";
import { TrackPostView } from "@/components/TrackPostView";

// ISR: free posts never touch a Dynamic API (getServerSession is only called
// below when post.premium is true), so they're cache-eligible and repeat
// anonymous reads are served from the CDN with no origin invocation. Premium
// posts DO call getServerSession, which opts that specific slug's render out
// of the static cache entirely - premium HTML is therefore never written to a
// shared cache (not "cached safely", simply never cached).
export const revalidate = 60;

// Shared by generateMetadata + the page so both share one query per request.
const getPost = cache(async (slug: string) => {
  try {
    return await prisma.post.findFirst({
      where: { slug, published: true },
      include: { author: { select: { name: true, username: true, image: true } } },
    });
  } catch (err: any) {
    // Resilience: if the `views` column hasn't been migrated yet (P2022), don't
    // 404 the whole article - re-query the needed fields and default views to 0.
    if (err?.code === "P2022") {
      const post = await prisma.post
        .findFirst({
          where: { slug, published: true },
          select: {
            id: true, slug: true, title: true, excerpt: true, content: true,
            cover: true, category: true, tags: true, premium: true,
            createdAt: true, updatedAt: true,
            author: { select: { name: true, username: true, image: true } },
          },
        })
        .catch(() => null);
      return post ? { ...post, views: 0 } : null;
    }
    return null;
  }
});

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getPost(params.slug);
  if (!post) return { title: "Not found" };
  const url = `/research/${post.slug}`;
  const images = post.cover ? [post.cover] : ["/logo.png"];
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

  // Premium gating: only Premium members or admins can read a premium body.
  // Session is only read for premium posts - checking post.premium first is a
  // plain DB read, not a Dynamic API call, so FREE posts never touch
  // getServerSession() and stay eligible for the ISR cache above. Trusting the
  // JWT (no per-request DB re-check) is safe: RealtimeSession (mounted
  // site-wide) refreshes the session the instant a membership_changed/
  // access_changed broadcast fires, so up/downgrade still takes effect live.
  let sessionUser: any = null;
  let isAdmin = false;
  let isPremium = false;
  if (post.premium) {
    const session = await getServerSession(authOptions);
    sessionUser = session?.user ?? null;
    isAdmin = sessionUser?.role === "ADMIN";
    isPremium = sessionUser?.membership === "Premium";
  }
  const canViewPremium = isAdmin || isPremium;
  const locked = post.premium && !canViewPremium;

  const [relatedRaw, likeCount, myLike] = await Promise.all([
    prisma.post
      .findMany({
        where: { published: true, category: post.category, slug: { not: post.slug } },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: POST_CARD_SELECT,
      })
      .catch(() => []),
    prisma.postLike.count({ where: { postId: post.id } }).catch(() => 0),
    sessionUser?.id
      ? prisma.postLike
          .findUnique({
            where: { postId_userId: { postId: post.id, userId: sessionUser.id } },
            select: { id: true },
          })
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  // Related cards never need bodies - strip + precompute read time.
  const related = relatedRaw.map(({ content, ...p }) => ({
    ...p,
    content: "",
    readMinutes: readingTime(content),
  }));

  const tags = post.tags
    ? post.tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  return (
    <>
      <JsonLd data={articleJsonLd(locked ? { ...post, content: "" } : post)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Research", path: "/research" },
          { name: post.title, path: `/research/${post.slug}` },
        ])}
      />
      <Navbar />
      <ReadingProgress />
      <TrackPostView postId={post.id} />
      {!locked && <AwardXpOnView action="research_view" keyId={post.id} />}
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
            {post.premium && (
              <span className="ml-2 rounded-full bg-gold-shine px-3 py-1 text-xs font-bold text-ink ring-1 ring-gold-500/40">
                Premium
              </span>
            )}
            <h1 className="mt-4 font-display text-3xl font-bold leading-tight text-zinc-50 sm:text-5xl">
              {post.title}
            </h1>

            {/* Byline + share */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-y border-white/5 py-4">
              {(() => {
                const byline = (
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gold-500/15 font-display text-sm font-bold text-gold-200 ring-1 ring-gold-500/30">
                      {(post.author?.name ?? "XYZ Crypto").charAt(0)}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-zinc-200">
                        {post.author?.name ?? "XYZ Crypto"}
                      </p>
                      <p className="mono text-[11px] text-zinc-500">
                        {formatDate(post.createdAt)} · {readingTime(post.content)} min read
                        {" · "}
                        {(post.views + 1).toLocaleString()} views
                      </p>
                    </div>
                  </div>
                );
                // Link to the author's public profile when they have a handle.
                return post.author?.username ? (
                  <Link href={`/u/${post.author.username}`} className="transition-opacity hover:opacity-80">
                    {byline}
                  </Link>
                ) : (
                  byline
                );
              })()}
              <div className="flex items-center gap-2">
                <LikeButton postId={post.id} initialCount={likeCount} initialLiked={Boolean(myLike)} />
                <ShareRow title={post.title} path={`/research/${post.slug}`} />
              </div>
            </div>
          </div>

          {post.cover && (
            <div className="relative mt-8 aspect-[16/9] w-full overflow-hidden rounded-2xl ring-1 ring-white/10">
              <Image
                src={post.cover}
                alt={post.title}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 768px"
                unoptimized={post.cover.startsWith("data:")}
              />
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink-950/70 to-transparent" />
            </div>
          )}

          <p className="mt-8 border-l-2 border-gold-500/60 pl-4 text-lg leading-relaxed text-zinc-200">
            {post.excerpt}
          </p>

          {(() => {
            // AI TL;DR (XYZ AI). FREE articles only - never tease premium content.
            // Optional column - hidden pre-migration or until generated.
            const summary = post.premium ? null : (post as { summary?: string | null }).summary;
            return summary ? (
              <div className="mt-6 rounded-xl border border-mint-500/25 bg-mint-500/[0.06] p-4">
                <p className="mono text-[11px] font-semibold uppercase tracking-wide text-mint-300">
                  TL;DR · XYZ AI
                </p>
                <p className="mt-1.5 text-[15px] leading-relaxed text-zinc-200">{summary}</p>
              </div>
            ) : null;
          })()}

          {locked ? (
            <PremiumLock loggedIn={Boolean(sessionUser)} />
          ) : (
            <div className="prose-xyz mt-6">
              <Markdown content={post.content} />
            </div>
          )}

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

        <CommentSection postId={post.id} />

        {related.length > 0 && (
          <section className="mx-auto mt-12 max-w-5xl px-4 pb-24 sm:px-6">
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
