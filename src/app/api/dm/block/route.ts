import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser, isCuid } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ userId: z.string().min(1), blocked: z.boolean() });

/**
 * POST /api/dm/block - block or unblock a member.
 *
 * The row is one-way (who blocked whom) but it is enforced symmetrically when
 * messaging, in `dm-gate`. Existing messages are left alone: a block stops what
 * happens next, it does not rewrite what was already said, and quietly deleting
 * a history someone may need to report would be the wrong instinct.
 */
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);

    const { success } = await rateLimit("dm", me.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Invalid request.", 400);
    const { userId, blocked } = parsed.data;
    if (!isCuid(userId)) return fail("Invalid member.", 400);
    if (userId === me.id) return fail("You can't block yourself.", 400);

    if (blocked) {
      // Idempotent: blocking twice is a no-op, not an error. The button can be
      // pressed again after a failed request without a second thought.
      await prisma.block
        .upsert({
          where: { blockerId_blockedId: { blockerId: me.id, blockedId: userId } },
          create: { blockerId: me.id, blockedId: userId },
          update: {},
        })
        .catch(() => null);
    } else {
      await prisma.block
        .deleteMany({ where: { blockerId: me.id, blockedId: userId } })
        .catch(() => null);
    }

    return ok({ blocked });
  } catch (err) {
    return handleError(err, "dm:block");
  }
}
