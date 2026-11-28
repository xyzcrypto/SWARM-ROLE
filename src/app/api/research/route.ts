import { z } from "zod";
import { NOT_TRASHED } from "@modules/research/lib/post-visibility";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { slugify, readingTime } from "@/lib/utils";
import { ok, fail, handleError, requirePermission } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { after } from "next/server";
import { notifyNewPost, pruneNotifications } from "@modules/notifications/lib/notifications";
import { broadcastEvent, CH_NOTIFY } from "@/lib/realtime";
import { summarize } from "@/lib/ai-tasks";

// Explicit post field list that OMITS the AI `summary` column. Used by every
// query that doesn't render the TL;DR so the site keeps working before the
// `12_post_summary` migration lands (a missing column would otherwise throw
// P2022 → "Database not migrated" on the public research list). Only the article
// detail page + the summarize endpoint read/write `summary`.
const POST_SCALARS = {
  id: true, title: true, slug: true, excerpt: true, content: true,
  cover: true, category: true, tags: true, published: true, premium: true,
  views: true, createdAt: true, updatedAt: true, authorId: true,
} satisfies Prisma.PostSelect;

// Best-effort: generate + store an AI TL;DR for a post. Never throws (summarize
// already swallows errors and returns null when AI is off), so callers can await
// it without risking the publish/update.
async function generateSummary(post: { id: string; title: string; content: string }) {
  const summary = await summarize(post.title, post.content);
  if (summary) {
    await prisma.post.update({ where: { id: post.id }, data: { summary } }).catch(() => null);
  }
}

// On publish: auto-create a linked "What's New" entry so newly-shipped research
// shows up in the homepage feed, then fan out the in-app notification. All
// best-effort - a hiccup here never fails the publish.
//
// Only the What's New insert is awaited (one row, and it should exist before
// the homepage is revalidated). The member fan-out and the AI summary run
// AFTER the response: they used to hold the admin's publish request for the
// whole fan-out plus an AI call (review M5).
async function afterPublish(post: { id: string; title: string; slug: string; excerpt: string; content: string; premium: boolean; authorId: string | null }) {
  await prisma.whatsNewEntry
    .create({ data: { title: post.title, body: post.excerpt, tag: "New", postId: post.id } })
    .then(() => broadcastEvent(CH_NOTIFY, "whatsnew_updated", { postId: post.id }))
    .catch(() => null);
  after(async () => {
    await notifyNewPost(post);
    await pruneNotifications();
    // AI TL;DR - only for FREE articles (never tease premium content). Best-effort;
    // no-op when AI is disabled.
    if (!post.premium) await generateSummary(post);
  });
}

// Refresh the ISR-cached pages that list/show posts after a content change.
function revalidateContent(slug?: string) {
  revalidatePath("/");
  revalidatePath("/research");
  revalidatePath("/academy/research");
  if (slug) revalidatePath(`/research/${slug}`);
}

// GET /api/research - public list (published only), filterable + paginated.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const premiumOnly = searchParams.get("premium") === "1";
    const q = searchParams.get("q")?.trim();
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(48, Math.max(1, Number(searchParams.get("pageSize")) || 12));

    const where = {
      published: true,
      // The public list never shows a trashed post. One predicate, spread
      // everywhere, so this cannot drift from the other fifteen read sites.
      ...NOT_TRASHED,
      ...(premiumOnly ? { premium: true } : {}),
      ...(category && category !== "All" ? { category } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" as const } },
              { excerpt: { contains: q, mode: "insensitive" as const } },
              { tags: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: { ...POST_SCALARS, author: { select: { name: true } } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.post.count({ where }),
    ]);

    // Never ship article bodies in list payloads (premium must never leak; free
    // bodies just ballooned the JSON). Cards show a precomputed reading time.
    const safe = posts.map(({ content, ...p }) => ({
      ...p,
      content: "",
      readMinutes: readingTime(content),
    }));

    // Public + identical for all users (premium redacted) → CDN-cacheable.
    const res = ok({ posts: safe, total, page, pageSize, hasMore: page * pageSize < total });
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res;
  } catch (err) {
    return handleError(err, "research:list");
  }
}

const createSchema = z.object({
  title: z.string().trim().min(4).max(160),
  excerpt: z.string().trim().min(8).max(320),
  content: z.string().trim().min(20).max(100_000, "Article is too long (100k characters max)."),
  category: z.enum(["Research", "Article", "Post"]).default("Research"),
  cover: z.string().trim().url().optional().or(z.literal("")),
  tags: z.string().trim().max(200).optional(),
  published: z.boolean().optional(),
  premium: z.boolean().optional(),
});

// POST /api/research - admin only
export async function POST(req: Request) {
  try {
    const author = await requirePermission("post:publish");
    if (!author) return fail("Forbidden", 403);

    const { success } = await rateLimit("admin", clientIp(req));
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }
    const data = parsed.data;
    const base = slugify(data.title) || "post";
    const authorId = author.id ?? null;

    const payload = {
      title: data.title,
      excerpt: data.excerpt,
      content: data.content,
      category: data.category,
      cover: data.cover || null,
      tags: data.tags || "",
      published: data.published ?? true,
      premium: data.premium ?? false,
      authorId,
    };

    // Try the clean slug; on a unique collision, retry once with a short suffix
    // (avoids the previous unbounded findUnique loop).
    try {
      const post = await prisma.post.create({ data: { ...payload, slug: base }, select: POST_SCALARS });
      // What's New first, so the revalidated homepage already lists it.
      if (post.published) await afterPublish(post);
      revalidateContent(post.slug);
      return ok({ post }, 201);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
        const post = await prisma.post.create({ data: { ...payload, slug }, select: POST_SCALARS });
        if (post.published) await afterPublish(post);
        revalidateContent(post.slug);
        return ok({ post }, 201);
      }
      throw e;
    }
  } catch (err) {
    return handleError(err, "research:create");
  }
}
