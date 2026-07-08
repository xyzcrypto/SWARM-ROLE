import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ endpoint: z.string().url() });

// POST /api/push/unsubscribe - remove this browser's push subscription.
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return fail("Invalid input.", 400);

    await prisma.pushSubscription.deleteMany({ where: { endpoint: parsed.data.endpoint } }).catch(() => null);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err, "push:unsubscribe");
  }
}
