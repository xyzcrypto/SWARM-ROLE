import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser, isCuid } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { broadcastChatEvent } from "@/lib/chat";

// DELETE /api/chat/messages/[id] - hide a message. Allowed for the author
// (delete your own) or an admin (moderation). Soft-delete via status so the
// record survives for audit.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);

    const { success } = await rateLimit("chat", me.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    if (!isCuid(params.id)) return fail("Invalid id.", 400);

    const msg = await prisma.chatMessage.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true, status: true },
    });
    if (!msg || msg.status !== "visible") return fail("Message not found.", 404);
    if (msg.userId !== me.id && me.role !== "ADMIN") {
      return fail("You can only delete your own messages.", 403);
    }

    await prisma.chatMessage.update({
      where: { id: params.id },
      data: { status: "hidden" },
    });
    await broadcastChatEvent({ event: "message_hidden", payload: { id: params.id } });

    return ok({ ok: true });
  } catch (err) {
    return handleError(err, "chat:delete");
  }
}
