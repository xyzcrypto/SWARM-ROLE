import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getAdminSession, isCuid } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";

// DELETE /api/comments/:id - admin only (moderation).
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAdminSession();
    if (!session) return fail("Unauthorized", 401);

    const { success } = await rateLimit("admin", clientIp(req));
    if (!success) return fail("Too many requests. Please slow down.", 429);

    if (!isCuid(params.id)) return fail("Invalid id.", 400);

    const existing = await prisma.comment.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!existing) return fail("Comment not found.", 404);

    await prisma.comment.delete({ where: { id: params.id } });
    return ok({ ok: true });
  } catch (err) {
    return handleError(err, "comments:delete");
  }
}
