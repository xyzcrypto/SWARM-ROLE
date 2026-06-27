import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { ok, fail, handleError, requirePermission } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { notifyNewPost } from "@/lib/notifications";
import { broadcastEvent, CH_NOTIFY } from "@/lib/realtime";

// On publish: fan out the in-app notification AND auto-create a linked "What's
// New" entry so newly-shipped research shows up in the homepage feed. Both are
// best-effort — a hiccup here never fails the publish.
async function afterPublish(post: { id: string; title: string; excerpt: string }) {
  await notifyNewPost(post as never);
  await prisma.whatsNewEntry
    .create({ data: { title: post.title, body: post.excerpt, tag: "New", postId: post.id } })
    .then(() => broadcastEvent(CH_NOTIFY, "whatsnew_updated", { postId: post.id }))
    .catch(() => null);
}

// Refresh the ISR-cached pages that list/show posts after a content change.
function revalidateContent(slug?: string) {
  revalidatePath("/");
  revalidatePath("/research");
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
        include: { author: { select: { name: true } } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.post.count({ where }),
    ]);

    // Never ship a premium post's body to the list/cards (no leak via JSON).
    const safe = posts.map((p) => (p.premium ? { ...p, content: "" } : p));

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
      const post = await prisma.post.create({ data: { ...payload, slug: base } });
      revalidateContent(post.slug);
      // Fan out an in-app notification to members (only for published posts).
      if (post.published) await afterPublish(post);
      return ok({ post }, 201);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
        const post = await prisma.post.create({ data: { ...payload, slug } });
        revalidateContent(post.slug);
        if (post.published) await afterPublish(post);
        return ok({ post }, 201);
      }
      throw e;
    }
  } catch (err) {
    return handleError(err, "research:create");
  }
}
