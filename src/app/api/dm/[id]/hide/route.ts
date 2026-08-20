import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser, isCuid } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// DELETE /api/dm/[id]/hide — remove this conversation from my inbox.
// The conversation and messages are kept; it simply disappears from the list
// until the other person sends a new message (which un-hides it).
export async function DELETE(_req: Request, props: Ctx) {
  const params = await props.params;
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    if (!isCuid(params.id)) return fail("Invalid conversation.", 400);

    const { success } = await rateLimit("dm", me.id);
    if (!success) return fail("Too many requests.", 429);

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
      // Also unpin — a pinned hidden conversation is confusing.
      data: iAmA
        ? { hiddenByA: true, pinnedByA: false }
        : { hiddenByB: true, pinnedByB: false },
    });

    return ok({ ok: true });
  } catch (err) {
    return handleError(err, "dm:hide");
  }
}
