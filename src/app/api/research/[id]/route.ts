import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { ok, fail, handleError, getAdminSession, isCuid } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";

function revalidateContent(slug?: string) {
  revalidatePath("/");
  revalidatePath("/research");
  if (slug) revalidatePath(`/research/${slug}`);
}

// GET /api/research/:id — admin only; full post (incl. drafts) for the editor.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAdminSession();
    if (!session) return fail("Unauthorized", 401);
    if (!isCuid(params.id)) return fail("Invalid id.", 400);

    const post = await prisma.post.findUnique({ where: { id: params.id } });
    if (!post) return fail("Post not found.", 404);
    return ok({ post });
  } catch (err) {
    return handleError(err, "research:get");
  }
}

const updateSchema = z.object({
  title: z.string().trim().min(4).max(160).optional(),
  excerpt: z.string().trim().min(8).max(320).optional(),
  content: z.string().trim().min(20).max(100_000, "Article is too long (100k characters max).").optional(),
  category: z.enum(["Research", "Article", "Post"]).optional(),
  cover: z.string().trim().url().optional().or(z.literal("")),
  tags: z.string().trim().max(200).optional(),
  published: z.boolean().optional(),
  premium: z.boolean().optional(),
});

// PATCH /api/research/:id — admin only; partial update.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAdminSession();
    if (!session) return fail("Unauthorized", 401);

    const { success } = await rateLimit("admin", clientIp(req));
    if (!success) return fail("Too many requests. Please slow down.", 429);

    if (!isCuid(params.id)) return fail("Invalid id.", 400);

    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }
    const data = parsed.data;

    const existing = await prisma.post.findUnique({
      where: { id: params.id },
      select: { slug: true, title: true, published: true },
    });
    if (!existing) return fail("Post not found.", 404);

    // Slug is stable to never break a published URL. Only regenerate while the
    // post is still a draft and the title actually changed.
    let nextSlug = existing.slug;
    const titleChanged = data.title && data.title !== existing.title;
    const willBeDraft = data.published === false || (data.published === undefined && !existing.published);
    if (titleChanged && willBeDraft) {
      nextSlug = slugify(data.title!) || existing.slug;
    }

    const payload = {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.excerpt !== undefined ? { excerpt: data.excerpt } : {}),
      ...(data.content !== undefined ? { content: data.content } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.cover !== undefined ? { cover: data.cover || null } : {}),
      ...(data.tags !== undefined ? { tags: data.tags } : {}),
      ...(data.published !== undefined ? { published: data.published } : {}),
      ...(data.premium !== undefined ? { premium: data.premium } : {}),
    };

    async function update(slug: string) {
      return prisma.post.update({
        where: { id: params.id },
        data: { ...payload, slug },
      });
    }

    let post;
    try {
      post = await update(nextSlug);
    } catch (e) {
      // Slug collided with another post — retry once with a short suffix.
      if (nextSlug !== existing.slug && e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        post = await update(`${nextSlug}-${Math.random().toString(36).slice(2, 6)}`);
      } else {
        throw e;
      }
    }

    revalidateContent(existing.slug);
    if (post.slug !== existing.slug) revalidateContent(post.slug);
    return ok({ post });
  } catch (err) {
    return handleError(err, "research:update");
  }
}

// DELETE /api/research/:id — admin only
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAdminSession();
    if (!session) return fail("Unauthorized", 401);

    const { success } = await rateLimit("admin", clientIp(req));
    if (!success) return fail("Too many requests. Please slow down.", 429);

    if (!isCuid(params.id)) return fail("Invalid id.", 400);

    const existing = await prisma.post.findUnique({
      where: { id: params.id },
      select: { id: true, slug: true },
    });
    if (!existing) return fail("Post not found.", 404);

    await prisma.post.delete({ where: { id: params.id } });
    revalidateContent(existing.slug);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err, "research:delete");
  }
}
