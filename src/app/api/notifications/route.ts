import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";

// Per-user, personalized → never cache.
export const dynamic = "force-dynamic";

// GET /api/notifications - recent notifications + unread count for the signed-in
// user. Degrades to an empty list if the table hasn't been migrated yet.
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Unauthorized", 401);

    const { success } = await rateLimit("notifications", user.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    try {
      const [items, unread] = await Promise.all([
        prisma.notification.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { id: true, type: true, title: true, body: true, href: true, read: true, createdAt: true },
        }),
        prisma.notification.count({ where: { userId: user.id, read: false } }),
      ]);
      return ok({ items, unread });
    } catch (err) {
      // Pre-migration resilience: missing table/column → quiet empty state.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        (err.code === "P2021" || err.code === "P2022")
      ) {
        return ok({ items: [], unread: 0 });
      }
      throw err;
    }
  } catch (err) {
    return handleError(err, "notifications:list");
  }
}
