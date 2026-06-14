import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getAdminSession, isCuid } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { broadcastEvent, userChannel, CH_MEMBERS } from "@/lib/realtime";

const schema = z.object({
  membership: z.enum(["Free", "Premium"]),
});

// PATCH /api/users/:id/membership - admin only
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession();
    if (!session) return fail("Unauthorized", 401);

    const { success } = await rateLimit("admin", clientIp(req));
    if (!success) return fail("Too many requests. Please slow down.", 429);

    if (!isCuid(params.id)) return fail("Invalid id.", 400);

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return fail("Invalid membership.", 400);

    const existing = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!existing) return fail("User not found.", 404);

    const user = await prisma.user.update({
      where: { id: params.id },
      data: { membership: parsed.data.membership },
      select: { id: true, membership: true },
    });

    // Real-time: tell the affected user's browser (so their Premium icon updates
    // instantly) and refresh the admin member list live.
    await Promise.allSettled([
      broadcastEvent(userChannel(user.id), "membership_changed", { membership: user.membership }),
      broadcastEvent(CH_MEMBERS, "membership_changed", { id: user.id, membership: user.membership }),
    ]);

    return ok({ user });
  } catch (err) {
    return handleError(err, "membership:update");
  }
}
