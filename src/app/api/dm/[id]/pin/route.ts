import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser, isCuid } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({ pinned: z.boolean() });

// PATCH /api/dm/[id]/pin — pin or unpin this conversation in my inbox.
export async function PATCH(req: Request, props: Ctx) {
  const params = await props.params;
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    if (!isCuid(params.id)) return fail("Invalid conversation.", 400);

    const { success } = await rateLimit("dm", me.id);
    if (!success) return fail("Too many requests.", 429);

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Invalid request.", 400);

    const conv = await prisma.conversation.findUnique({
      where: { id: params.id },
      select: { id: true, userAId: true, userBId: true },
    });
    if (!conv || (conv.userAId !== me.id && conv.userBId !== me.id)) {
      return fail("Conversation not found.", 404);
    }

    const iAmA = conv.userAId === me.id;
    await prisma.conversation.update({
      where: { id: conv.id },
      data: iAmA ? { pinnedByA: parsed.data.pinned } : { pinnedByB: parsed.data.pinned },
    });

    return ok({ ok: true, pinned: parsed.data.pinned });
  } catch (err) {
    return handleError(err, "dm:pin-conv");
  }
}
