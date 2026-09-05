import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { slugify, readingTime } from "@/lib/utils";
import { ok, fail, handleError, requirePermission, isCuid } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { summarize } from "@/lib/ai-tasks";

// Post fields WITHOUT the AI `summary` column, so the editor GET + updates keep
// working before the `12_post_summary` migration lands (missing column → P2022).
const POST_SCALARS = {
  id: true, title: true, slug: true, excerpt: true, content: true,
  cover: true, category: true, tags: true, published: true, premium: true,
  views: true, readMinutes: true, createdAt: true, updatedAt: true, authorId: true,
} satisfies Prisma.PostSelect;

function revalidateContent(slug?: string) {
  revalidatePath("/");
  revalidatePath("/research");
  if (slug) revalidatePath(`/research/${slug}`);
}

// GET /api/research/:id - admin only; full post (incl. drafts) for the editor.
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const actor = await requirePermission("post:manage");
    if (!actor) return fail("Forbidden", 403);
    if (!isCuid(params.id)) return fail("Invalid id.", 400);

    const post = await prisma.post.findUnique({ where: { id: params.id }, select: POST_SCALARS });
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

// PATCH /api/research/:id - admin only; partial update.
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const actor = await requirePermission("post:manage");
    if (!actor) return fail("Forbidden", 403);

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
      ...(data.content !== undefined ? { readMinutes: readingTime(data.content) } : {}),
    };

    async function update(slug: string) {
      return prisma.post.update({
        where: { id: params.id },
        data: { ...payload, slug },
        select: POST_SCALARS,
      });
    }

    let post: Awaited<ReturnType<typeof update>>;
    try {
      post = await update(nextSlug);
    } catch (e) {
      // Slug collided with another post - retry once with a short suffix.
      if (nextSlug !== existing.slug && e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        post = await update(`${nextSlug}-${Math.random().toString(36).slice(2, 6)}`);
      } else {
        throw e;
      }
    }

    // AI TL;DR is FREE-articles only. Regenerate when a free post's body changes;
    // if a post was switched to premium, make sure no stale summary lingers.
    if (data.premium === true) {
      post = await prisma.post
        .update({ where: { id: params.id }, data: { summary: null }, select: POST_SCALARS })
        .catch(() => post);
    } else if (!post.premium && data.content !== undefined) {
      const summary = await summarize(post.title, post.content);
      if (summary) {
        post = await prisma.post
          .update({ where: { id: params.id }, data: { summary }, select: POST_SCALARS })
          .catch(() => post);
      }
    }

    revalidateContent(existing.slug);
    if (post.slug !== existing.slug) revalidateContent(post.slug);
    return ok({ post });
  } catch (err) {
    return handleError(err, "research:update");
  }
}

// DELETE /api/research/:id - admin only
export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const actor = await requirePermission("post:manage");
    if (!actor) return fail("Forbidden", 403);

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
