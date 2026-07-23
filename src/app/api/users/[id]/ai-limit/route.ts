import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, requirePermission, isCuid } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";

// PATCH /api/users/:id/ai-limit - set a member's per-day AI request override
// (ai:manage). `aiDailyLimit: null` (or 0) clears it back to the plan default.
const schema = z.object({
  aiDailyLimit: z.number().int().min(0).max(100_000).nullable(),
});

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const actor = await requirePermission("ai:manage");
    if (!actor) return fail("Forbidden", 403);

    const { success } = await rateLimit("admin", clientIp(req));
    if (!success) return fail("Too many requests. Please slow down.", 429);

    if (!isCuid(params.id)) return fail("Invalid id.", 400);

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return fail("Invalid limit.", 400);

    const existing = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!existing) return fail("User not found.", 404);

    // 0 means "clear the override" → null (fall back to the plan default).
    const value = parsed.data.aiDailyLimit && parsed.data.aiDailyLimit > 0 ? parsed.data.aiDailyLimit : null;

    const user = await prisma.user.update({
      where: { id: params.id },
      data: { aiDailyLimit: value },
      select: { id: true, aiDailyLimit: true },
    });

    await prisma.adminAudit
      .create({ data: { actorId: actor.id, action: "ai.limit.update", targetId: user.id, detail: JSON.stringify({ aiDailyLimit: value }) } })
      .catch(() => null);

    return ok({ user });
  } catch (err) {
    return handleError(err, "ai:limit:update");
  }
}
