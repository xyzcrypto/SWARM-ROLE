import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { pushEnabled } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  }),
});

// POST /api/push/subscribe — store this browser's push subscription for the
// signed-in member (upsert by endpoint). Auth-gated.
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    if (!pushEnabled) return fail("Push notifications aren't configured yet.", 503);

    const { success } = await rateLimit("profile", me.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return fail("Invalid subscription.", 400);
    const { endpoint, keys } = parsed.data.subscription;

    await prisma.pushSubscription
      .upsert({
        where: { endpoint },
        create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId: me.id },
        update: { p256dh: keys.p256dh, auth: keys.auth, userId: me.id },
      })
      .catch(() => null); // pre-migration: no-op

    return ok({ ok: true });
  } catch (err) {
    return handleError(err, "push:subscribe");
  }
}
