import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ endpoint: z.string().url() });

// POST /api/push/unsubscribe - remove this browser's push subscription.
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    // Mirrors push/subscribe, which uses the same bucket. Low impact on its own
    // (the delete is scoped to me.id), but an unthrottled write path is still a
    // free way to generate DB load.
    const { success } = await rateLimit("profile", me.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return fail("Invalid input.", 400);

    await prisma.pushSubscription.deleteMany({ where: { endpoint: parsed.data.endpoint, userId: me.id } }).catch(() => null);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err, "push:unsubscribe");
  }
}
