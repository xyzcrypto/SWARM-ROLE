import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getAdminSession, isCuid, requirePermission } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";

const statusSchema = z.object({ status: z.enum(["visible", "hidden"]) });

// PATCH /api/comments/:id - soft-moderation (post:manage): hide a comment
// (or restore it) without destroying the record. The model always supported
// visible|hidden; only hard-delete existed before.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const actor = await requirePermission("post:manage");
    if (!actor) return fail("Forbidden", 403);

    const { success } = await rateLimit("admin", clientIp(req));
    if (!success) return fail("Too many requests. Please slow down.", 429);

    if (!isCuid(params.id)) return fail("Invalid id.", 400);

    const parsed = statusSchema.safeParse(await req.json());
    if (!parsed.success) return fail("Invalid status.", 400);

    const existing = await prisma.comment.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!existing) return fail("Comment not found.", 404);

    await prisma.comment.update({ where: { id: params.id }, data: { status: parsed.data.status } });
    return ok({ ok: true, status: parsed.data.status });
  } catch (err) {
    return handleError(err, "comments:moderate");
  }
}

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
