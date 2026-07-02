import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser, isCuid } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { broadcastChatEvent, CHAT_MAX_LENGTH } from "@/lib/chat";
import { canEditMessage } from "@/lib/chat-view";

const editSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Message cannot be empty.")
    .max(CHAT_MAX_LENGTH, `Keep it under ${CHAT_MAX_LENGTH} characters.`),
});

// PATCH /api/chat/messages/[id] - edit your own message within the edit
// window. Broadcasts `message_edited` so every client updates in place.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);

    const { success } = await rateLimit("chat", me.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    if (!isCuid(params.id)) return fail("Invalid id.", 400);

    const parsed = editSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }

    const msg = await prisma.chatMessage.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true, status: true, createdAt: true },
    });
    if (!msg || msg.status !== "visible") return fail("Message not found.", 404);
    if (msg.userId !== me.id) return fail("You can only edit your own messages.", 403);
    if (!canEditMessage(msg.createdAt)) {
      return fail("Messages can only be edited within 15 minutes of sending.", 403);
    }

    const editedAt = new Date();
    await prisma.chatMessage.update({
      where: { id: params.id },
      data: { body: parsed.data.body, editedAt },
    });
    await broadcastChatEvent({
      event: "message_edited",
      payload: { id: params.id, body: parsed.data.body, editedAt: editedAt.toISOString() },
    });

    return ok({ ok: true, body: parsed.data.body, editedAt: editedAt.toISOString() });
  } catch (err) {
    return handleError(err, "chat:edit");
  }
}

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
