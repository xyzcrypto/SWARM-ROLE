import type { Metadata } from "next";
import { SaveButton } from "@modules/research/components/SaveButton";
import { NOT_TRASHED } from "@modules/research/lib/post-visibility";
import { cache } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/Navbar";
import { Avatar } from "@/components/Avatar";
import { Markdown, extractHeadings } from "@/lib/markdown";
import { prisma } from "@/lib/prisma";
import { schemaOrThrow } from "@/lib/db-error";
import { cn, formatDate, readingTime, publicImageUrl } from "@/lib/utils";
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
import { ArticleTableOfContents } from "@modules/research/components/ArticleTableOfContents";
import { FloatingArticleDock } from "@modules/research/components/FloatingArticleDock";
import { AuthorBioCard } from "@modules/research/components/AuthorBioCard";
import { ArrowLeft, Clock, Eye, Sparkles, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/primitives";

export const revalidate = 3600;

function withSafeAuthorImage<T extends { author: { id: string; image: string | null } | null }>(post: T): T {
  return { ...post, author: post.author ? { ...post.author, image: publicImageUrl(post.author.image, post.author.id) } : null };
}

function formatArticleTitle(raw: string): string {
  if (!raw) return "";
  const lettersOnly = raw.replace(/[^a-zA-Z]/g, "");
  // If mostly uppercase, convert gracefully to Title Case
  if (lettersOnly.length > 6 && lettersOnly === lettersOnly.toUpperCase()) {
    return raw
      .toLowerCase()
      .replace(/\b([a-z])/g, (m) => m.toUpperCase())
      .replace(/\b(And|Or|The|In|On|At|To|For|Of|With|A|An|Vs)\b/g, (m) => m.toLowerCase())
      .replace(/\b(part\s+\d+)\b/gi, (m) => m.toUpperCase())
      .replace(/^([a-z])/, (m) => m.toUpperCase());
  }
  return raw;
}

const catTone: Record<string, "gold" | "sky" | "violet"> = {
  Research: "gold",
  Article: "sky",
  Post: "violet",
};

const getPost = cache(async (slug: string) => {
  try {
    const post = await prisma.post.findFirst({
      where: { slug, published: true, ...NOT_TRASHED },
      include: { author: { select: { id: true, name: true, username: true, image: true, membership: true } } },
    });
    let resolvedPost = post ? withSafeAuthorImage(post) : null;
    if (!resolvedPost) {
      const { DEMO_RESEARCH_POSTS } = await import("@modules/research/lib/demo-posts");
      const demo = DEMO_RESEARCH_POSTS.find((p) => p.slug === slug);
      if (demo) {
        resolvedPost = {
          id: demo.id || `demo-${demo.slug}`,
          slug: demo.slug,
          title: demo.title,
          excerpt: demo.excerpt,
          content:
            demo.content && demo.content.trim()
              ? demo.content
              : `## Executive Summary\n\n${demo.excerpt}\n\n## 1. Architectural Foundation & Technical Paradigm\n\nThe evolution of on-chain systems requires shifting from sequential transaction pipelines to high-concurrency state trees. By pipelining state access, decoupling execution from consensus, and leveraging hardware acceleration, modern Web3 protocols are solving the trilemma without sacrificing decentralized verification.\n\n### Key Metrics & On-Chain Benchmarks\n\n- **Peak Measured Throughput:** 12,400+ TPS in stress tests\n- **Average State Finality:** < 450 milliseconds\n- **Validator Hardware Footprint:** Optimized NVMe SSD sequential reads\n\n> "True scalability is not merely about larger blocks; it is about eliminating uncoordinated lock contention at the state storage boundary."\n\n## 2. Market Impact & Capital Dynamics\n\nFrom liquidity aggregation to high-frequency automated market making, institutional participants demand predictable transaction execution windows. The transition toward intent-centric architectures allows solver networks to settle complex trades across fragmented pools while minimizing MEV leakage.\n\n## 3. What to Watch Next\n\nAs testnet metrics transition toward production rollouts, monitoring developer mindshare, fee burn rate, and real economic yield remains paramount. The XYZ Research Desk will publish ongoing weekly updates as mainnet telemetry goes live.`,
          cover: demo.cover,
          category: demo.category,
          tags: demo.tags || "",
          published: true,
          premium: demo.premium || false,
          summary: "Institutional deep dive exploring technical architecture, benchmarks, and economic implications.",
          views: demo.views || 2500,
          createdAt: new Date(demo.createdAt),
          updatedAt: new Date(demo.createdAt),
          authorId: "demo-analyst",
          author: {
            id: "demo-analyst",
            name: demo.author?.name || "XYZ Research Desk",
            username: "xyzresearch",
            image: null,
            membership: "Pro",
          },
          likes: [],
          comments: [],
        } as any;
      }
    }
    return resolvedPost;
  } catch (err: any) {
    if (err?.code === "P2022") {
      const post = await prisma.post
        .findFirst({
          where: { slug, published: true, ...NOT_TRASHED },
          select: {
            id: true, slug: true, title: true, excerpt: true, content: true,
            cover: true, category: true, tags: true, premium: true,
            createdAt: true, updatedAt: true,
            author: { select: { id: true, name: true, username: true, image: true, membership: true } },
          },
        })
        .catch(schemaOrThrow);
      return post ? withSafeAuthorImage({ ...post, views: 0 }) : null;
    }
    const { DEMO_RESEARCH_POSTS } = await import("@modules/research/lib/demo-posts");
    const demo = DEMO_RESEARCH_POSTS.find((p) => p.slug === slug);
    if (demo) {
      return {
        id: demo.id || `demo-${demo.slug}`,
        slug: demo.slug,
        title: demo.title,
        excerpt: demo.excerpt,
        content:
          demo.content && demo.content.trim()
            ? demo.content
            : `## Executive Summary\n\n${demo.excerpt}\n\n## 1. Architectural Foundation & Technical Paradigm\n\nThe evolution of on-chain systems requires shifting from sequential transaction pipelines to high-concurrency state trees. By pipelining state access, decoupling execution from consensus, and leveraging hardware acceleration, modern Web3 protocols are solving the trilemma without sacrificing decentralized verification.\n\n### Key Metrics & On-Chain Benchmarks\n\n- **Peak Measured Throughput:** 12,400+ TPS in stress tests\n- **Average State Finality:** < 450 milliseconds\n- **Validator Hardware Footprint:** Optimized NVMe SSD sequential reads\n\n> "True scalability is not merely about larger blocks; it is about eliminating uncoordinated lock contention at the state storage boundary."\n\n## 2. Market Impact & Capital Dynamics\n\nFrom liquidity aggregation to high-frequency automated market making, institutional participants demand predictable transaction execution windows. The transition toward intent-centric architectures allows solver networks to settle complex trades across fragmented pools while minimizing MEV leakage.\n\n## 3. What to Watch Next\n\nAs testnet metrics transition toward production rollouts, monitoring developer mindshare, fee burn rate, and real economic yield remains paramount. The XYZ Research Desk will publish ongoing weekly updates as mainnet telemetry goes live.`,
        cover: demo.cover,
        category: demo.category,
        tags: demo.tags || "",
        published: true,
        premium: demo.premium || false,
        summary: "Institutional deep dive exploring technical architecture, benchmarks, and economic implications.",
        views: demo.views || 2500,
        createdAt: new Date(demo.createdAt),
        updatedAt: new Date(demo.createdAt),
        authorId: "demo-analyst",
        author: {
          id: "demo-analyst",
          name: demo.author?.name || "XYZ Research Desk",
          username: "xyzresearch",
          image: null,
          membership: "Pro",
        },
        likes: [],
        comments: [],
      } as any;
    }
    return null;
  }
});

export async function generateMetadata(
  props: {
    params: Promise<{ slug: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  const post = await getPost(params.slug);
  if (!post) return { title: "Not found" };
  const url = `/research/${post.slug}`;
  const images = post.cover ? [post.cover] : ["/logo.png"];
  const keywords = post.tags
    ? (post.tags as string).split(",").map((t: string) => t.trim()).filter(Boolean)
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

export default async function PostPage(
  props: {
    params: Promise<{ slug: string }>;
  }
) {
  const params = await props.params;
  const post = await getPost(params.slug);
  if (!post) notFound();

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

  const related = relatedRaw.map(({ content, ...p }) => ({
    ...p,
    content: "",
    readMinutes: readingTime(content),
  }));

  const tags: string[] = post.tags
    ? (post.tags as string).split(",").map((t: string) => t.trim()).filter(Boolean)
    : [];

  const formattedTitle = formatArticleTitle(post.title);
  const headings = extractHeadings(post.content || "");
  const readMins = readingTime(post.content);

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
      <main className="relative min-h-screen pt-28 pb-24 bg-[#e9edf4] dark:bg-[#0c0e14] text-zinc-900 dark:text-zinc-100 selection:bg-amber-500/25">
        <div className="mesh" />
        {/* Directional Top-Left Studio Light */}
        <div aria-hidden className="pointer-events-none absolute -left-40 top-0 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-amber-400/[0.06] via-gold-500/[0.03] to-transparent blur-[140px]" />

        {/* Outer Container */}
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          
          {/* ── 1. Top Breadcrumb & Quick Actions Bar ── */}
          <div className="neu-convex flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4 shadow-neu-sm border border-white/[0.04]">
            <nav className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <Link
                href="/research"
                className="neu-btn inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-semibold text-zinc-700 dark:text-zinc-300 shadow-neu-sm hover:text-black dark:hover:text-white active:scale-95"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Research Hub
              </Link>
              <span className="text-zinc-400 dark:text-zinc-600">/</span>
              <span className="neu-raised-sm rounded-full px-2.5 py-1 mono text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200 border border-gold-500/30">
                {post.category}
              </span>
              {post.premium && (
                <span className="neu-raised-sm inline-flex items-center gap-1 rounded-full bg-mint-500/20 border border-mint-500/40 px-2.5 py-1 mono text-[10px] font-bold uppercase text-mint-700 dark:text-mint-300">
                  <Sparkles className="h-2.5 w-2.5" />
                  Pro
                </span>
              )}
            </nav>

            <div className="flex items-center gap-3">
              <SaveButton
                slug={post.slug}
                title={post.title}
                excerpt={post.excerpt}
                cover={post.cover}
                category={post.category}
                className="neu-btn !rounded-full !px-3 !py-1.5 text-xs text-zinc-700 dark:text-zinc-300 shadow-neu-sm hover:text-amber-600 dark:hover:text-gold-200 active:scale-95"
              />
              <ShareRow title={formattedTitle} path={`/research/${post.slug}`} />
            </div>
          </div>

          {/* ── 2. Editorial Article Header ── */}
          <header className="mt-8 max-w-4xl">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="neu-raised-sm inline-flex items-center gap-1.5 rounded-full border border-gold-500/30 bg-gold-500/10 px-3.5 py-1 font-bold text-amber-700 dark:text-gold-200 shadow-neu-sm">
                {post.category} Intelligence
              </span>
              <span className="neu-raised-sm inline-flex items-center gap-1 rounded-full px-3 py-1 text-zinc-700 dark:text-zinc-300 shadow-neu-sm border border-zinc-200/60 dark:border-white/[0.04]">
                <Clock className="h-3 w-3 text-gold-400" />
                {readMins} min read
              </span>
              {typeof post.views === "number" && (
                <span className="neu-raised-sm inline-flex items-center gap-1 rounded-full px-3 py-1 text-zinc-700 dark:text-zinc-300 shadow-neu-sm border border-zinc-200/60 dark:border-white/[0.04]">
                  <Eye className="h-3 w-3" />
                  {(post.views + 1).toLocaleString()} views
                </span>
              )}
            </div>

            <h1 className="mt-5 font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-[1.18] tracking-tight text-zinc-900 dark:text-zinc-50 text-balance">
              {formattedTitle}
            </h1>

            {/* Author Byline Strip - Recessed Neumorphic Well */}
            <div className="neu-inset-sm mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4 text-xs border border-zinc-200/50 dark:border-white/[0.03]">
              {(() => {
                const authorIsPremium = post.author?.membership === "Premium" || post.author?.membership === "Pro";
                const byline = (
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={post.author?.name ?? "XYZ Crypto"}
                      image={post.author?.image ?? null}
                      size="md"
                      premium={authorIsPremium}
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={cn("text-sm font-semibold", authorIsPremium ? "text-gold-gradient" : "text-zinc-900 dark:text-zinc-100")}>
                          {post.author?.name ?? "XYZ Crypto"}
                        </span>
                        <CheckCircle2 className="h-3.5 w-3.5 text-mint-400" />
                      </div>
                      <p className="mono text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Published {formatDate(post.createdAt)}
                      </p>
                    </div>
                  </div>
                );
                return post.author?.username ? (
                  <Link href={`/u/${post.author.username}`} className="transition-opacity hover:opacity-85">
                    {byline}
                  </Link>
                ) : (
                  byline
                );
              })()}

              <div className="flex items-center gap-2">
                <LikeButton postId={post.id} initialCount={likeCount} initialLiked={Boolean(myLike)} />
              </div>
            </div>
          </header>

          {/* ── 3. Cinematic Cover Image ── */}
          {post.cover && (
            <div className="neu-frame relative mt-8 w-full max-w-5xl overflow-hidden rounded-3xl bg-ink-950 shadow-neu-lg">
              <div className="relative aspect-[16/9] w-full">
                <Image
                  src={post.cover}
                  alt={post.title}
                  fill
                  priority
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 1024px"
                  unoptimized={post.cover.startsWith("data:")}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950/80 via-transparent to-black/20" />
              </div>
            </div>
          )}

          {/* ── 4. Main Editorial Two-Column Grid ── */}
          <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 lg:gap-12 items-start">
            
            {/* Left Column: Article Body & Comments (8 cols) */}
            <article className="lg:col-span-8 min-w-0">
              
              {/* Editorial Excerpt Quote */}
              {post.excerpt && (
                <div className="rounded-2xl border-l-4 border-amber-500 dark:border-gold-400 bg-amber-500/[0.08] dark:bg-gold-500/[0.05] p-5 sm:p-6 backdrop-blur-sm shadow-sm mb-8">
                  <p className="font-serif text-base sm:text-lg italic leading-relaxed text-zinc-800 dark:text-zinc-100">
                    "{post.excerpt}"
                  </p>
                </div>
              )}

              {/* AI TL;DR / Executive Summary (if available) */}
              {(() => {
                const summary = post.premium ? null : (post as { summary?: string | null }).summary;
                return summary ? (
                  <div className="mb-8 rounded-2xl border border-mint-500/30 bg-mint-500/[0.06] p-5 sm:p-6 shadow-mint-sm">
                    <p className="mono text-[11px] font-bold uppercase tracking-wider text-mint-700 dark:text-mint-300 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-mint-400" />
                      Executive Summary · XYZ AI
                    </p>
                    <p className="mt-2 text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-200">{summary}</p>
                  </div>
                ) : null;
              })()}

              {/* Main Content Body */}
              {locked ? (
                <PremiumLock loggedIn={Boolean(sessionUser)} />
              ) : (
                <div className="prose-xyz">
                  <Markdown content={post.content || ""} />
                </div>
              )}

              {/* Tags Cloud */}
              {tags.length > 0 && (
                <div className="mt-10 flex flex-wrap gap-2 border-t border-zinc-300/80 dark:border-white/[0.08] pt-6">
                  {tags.map((t: string) => (
                    <span
                      key={t}
                      className="rounded-lg border border-zinc-300/60 dark:border-white/10 bg-zinc-200/60 dark:bg-white/5 px-3 py-1 mono text-xs text-zinc-700 dark:text-zinc-300"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}

              {/* Author Bio Signature Box */}
              <div className="mt-10">
                <AuthorBioCard author={post.author} />
              </div>

              {/* Comment Section */}
              <div id="comments" className="mt-12 scroll-mt-28">
                <CommentSection postId={post.id} />
              </div>
            </article>

            {/* Right Column: Sticky Table of Contents & Intelligence Rail (4 cols) */}
            <aside aria-label="Article navigation" className="hidden lg:block lg:col-span-4 sticky top-28 space-y-6">
              <ArticleTableOfContents
                headings={headings}
                readMinutes={readMins}
                author={post.author}
              />
            </aside>
          </div>

          {/* ── 5. Related Research Intelligence ── */}
          {related.length > 0 && (
            <section className="mt-20 border-t border-zinc-300/80 dark:border-white/[0.08] pt-12">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                    More in <span className="text-shine">{post.category}</span>
                  </h2>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    Latest institutional intelligence from the XYZ research desk.
                  </p>
                </div>
                <Link
                  href="/research"
                  className="neu-btn inline-flex items-center gap-1 rounded-full px-4 py-2 text-xs font-semibold text-amber-700 dark:text-gold-200 hover:text-black dark:hover:text-white"
                >
                  View All Reports →
                </Link>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((p) => (
                  <PostCard key={p.slug} post={p} />
                ))}
              </div>
            </section>
          )}

        </div>

        {/* ── 6. Floating Action Dock (bottom-center on scroll) ── */}
        <FloatingArticleDock
          postId={post.id}
          postSlug={post.slug}
          postTitle={formattedTitle}
          postExcerpt={post.excerpt}
          postCover={post.cover}
          postCategory={post.category}
          likeCount={likeCount}
          initialLiked={Boolean(myLike)}
          commentCount={post.comments?.length ?? 0}
        />
      </main>
    </>
  );
}
