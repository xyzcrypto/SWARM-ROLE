import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, requirePermission, isCuid } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

/**
 * Put a post back.
 *
 * The other half of the soft delete: without a restore path, `deletedAt` is
 * just a slower way of losing something.
 *
 * ⚠️ Restores to whatever `published` state it had when it was trashed, rather
 * than force-publishing. A draft that was deleted should come back a draft - the
 * restore is undoing the deletion, not making a publishing decision on the
 * owner's behalf.
 */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const actor = await requirePermission("post:manage");
    if (!actor) return fail("Forbidden", 403);

    const { success } = await rateLimit("admin", clientIp(req));
    if (!success) return fail("Too many requests. Please slow down.", 429);

    if (!isCuid(params.id)) return fail("Invalid id.", 400);

    const existing = await prisma.post.findUnique({
      where: { id: params.id },
      select: { id: true, slug: true, deletedAt: true, published: true },
    });
    if (!existing) return fail("Post not found.", 404);
    if (!existing.deletedAt) return fail("That post is not in the trash.", 409);

    await prisma.post.update({ where: { id: params.id }, data: { deletedAt: null } });

    // The list and the article are both cached. Restoring has to bust both, or
    // the post is back in the database and still missing from the site.
    revalidatePath("/research");
  revalidatePath("/academy/research");
    revalidatePath(`/research/${existing.slug}`);

    return ok({ ok: true, restored: true, published: existing.published });
  } catch (err) {
    return handleError(err, "research:restore");
  }
}
