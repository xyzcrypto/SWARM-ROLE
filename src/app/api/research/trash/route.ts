import { prisma } from "@/lib/prisma";
import { fail, handleError, requirePermission } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * The trash: posts that were deleted but not destroyed.
 *
 * ⚠️ The reason this exists is a real loss. `DELETE /api/research/[id]` called
 * `prisma.post.delete`, so a published article was gone from Postgres with no
 * way back short of a database backup - and a backup is not a feature, it is a
 * thing you find out you do not have on the day you need it.
 *
 * Deleting now sets `deletedAt`. This lists what is in there so it can be
 * restored, and permanent deletion takes a second, explicit action
 * (`DELETE …?purge=1`) taken while looking at this list.
 *
 * ⚠️ `private, no-store`: an admin-only list of things that are not public.
 * Edge-caching it would put unpublished titles in a shared cache.
 */
export async function GET(req: Request) {
  try {
    const actor = await requirePermission("post:manage");
    if (!actor) return fail("Forbidden", 403);

    const { success } = await rateLimit("admin", clientIp(req));
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const posts = await prisma.post.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        category: true,
        premium: true,
        published: true,
        createdAt: true,
        deletedAt: true,
      },
    });

    return new Response(JSON.stringify({ posts }), {
      status: 200,
      headers: { "content-type": "application/json", "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    // A database without the `deletedAt` column yet (P2022) is survivable: the
    // trash is simply empty until the migration lands, rather than a 500 on an
    // admin screen. `handleError` maps that to a graceful 503.
    return handleError(err, "research:trash");
  }
}
