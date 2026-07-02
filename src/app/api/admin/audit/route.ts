import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, requirePermission } from "@/lib/api";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

// GET /api/admin/audit - the AdminAudit trail (written on access changes) was
// append-only with no reader; this surfaces it for the dashboard Activity
// panel (users:roles). Cursor-paginated, newest first.
export async function GET(req: Request) {
  try {
    const actor = await requirePermission("users:roles");
    if (!actor) return fail("Forbidden", 403);

    const cursor = new URL(req.url).searchParams.get("cursor");
    const rows = await prisma.adminAudit.findMany({
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        targetId: true,
        detail: true,
        createdAt: true,
        actor: { select: { name: true, email: true } },
      },
    });
    const hasMore = rows.length > PAGE_SIZE;
    const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

    return ok({
      entries: page.map((r) => ({
        id: r.id,
        action: r.action,
        targetId: r.targetId,
        detail: r.detail,
        createdAt: r.createdAt.toISOString(),
        actorName: r.actor.name ?? r.actor.email,
      })),
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    });
  } catch (err) {
    return handleError(err, "admin:audit");
  }
}
