import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { ok, fail, handleError, getAdminSession } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";

// Refresh the ISR-cached pages that list/show posts after a content change.
function revalidateContent(slug?: string) {
  revalidatePath("/");
  revalidatePath("/research");
  if (slug) revalidatePath(`/research/${slug}`);
}

// GET /api/research — public list (optionally filter by category)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const posts = await prisma.post.findMany({
      where: {
        published: true,
        ...(category && category !== "All" ? { category } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { author: { select: { name: true } } },
    });
    return ok({ posts });
  } catch (err) {
    return handleError(err, "research:list");
  }
}

const createSchema = z.object({
  title: z.string().trim().min(4).max(160),
  excerpt: z.string().trim().min(8).max(320),
  content: z.string().trim().min(20),
  category: z.enum(["Research", "Article", "Post"]).default("Research"),
  cover: z.string().trim().url().optional().or(z.literal("")),
  tags: z.string().trim().max(200).optional(),
  published: z.boolean().optional(),
});

// POST /api/research — admin only
export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return fail("Unauthorized", 401);

    const { success } = await rateLimit("admin", clientIp(req));
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }
    const data = parsed.data;
    const base = slugify(data.title) || "post";
    const authorId = (session.user as any).id ?? null;

    const payload = {
      title: data.title,
      excerpt: data.excerpt,
      content: data.content,
      category: data.category,
      cover: data.cover || null,
      tags: data.tags || "",
      published: data.published ?? true,
      authorId,
    };

    // Try the clean slug; on a unique collision, retry once with a short suffix
    // (avoids the previous unbounded findUnique loop).
    try {
      const post = await prisma.post.create({ data: { ...payload, slug: base } });
      revalidateContent(post.slug);
      return ok({ post }, 201);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
        const post = await prisma.post.create({ data: { ...payload, slug } });
        revalidateContent(post.slug);
        return ok({ post }, 201);
      }
      throw e;
    }
  } catch (err) {
    return handleError(err, "research:create");
  }
}
