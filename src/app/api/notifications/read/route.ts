import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Mark all unread, or a specific set of ids, as read.
const bodySchema = z.object({ ids: z.array(z.string()).max(100).optional() });

// POST /api/notifications/read - mark notifications read for the signed-in user.
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Unauthorized", 401);

    const { success } = await rateLimit("notifications", user.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);

    try {
      await prisma.notification.updateMany({
        where: {
          userId: user.id,
          read: false,
          ...(parsed.data.ids?.length ? { id: { in: parsed.data.ids } } : {}),
        },
        data: { read: true },
      });
      return ok({ ok: true });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        (err.code === "P2021" || err.code === "P2022")
      ) {
        return ok({ ok: true });
      }
      throw err;
    }
  } catch (err) {
    return handleError(err, "notifications:read");
  }
}
