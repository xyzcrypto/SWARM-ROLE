import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser, isCuid } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { reactionSchema, broadcastChatEvent } from "@/lib/chat";

// POST /api/chat/messages/[id]/react - toggle an emoji reaction on a message.
// One row per (message, user, emoji); posting the same emoji again removes it.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in to react.", 401);

    const { success } = await rateLimit("like", me.id); // reuse the like bucket (20/min)
    if (!success) return fail("Too many reactions. Please slow down.", 429);

    if (!isCuid(params.id)) return fail("Invalid id.", 400);

    const parsed = reactionSchema.safeParse(await req.json());
    if (!parsed.success) return fail("Unsupported reaction.", 400);
    const { emoji } = parsed.data;

    const msg = await prisma.chatMessage.findUnique({
      where: { id: params.id },
      select: { id: true, status: true },
    });
    if (!msg || msg.status !== "visible") return fail("Message not found.", 404);

    const existing = await prisma.chatReaction.findUnique({
      where: { messageId_userId_emoji: { messageId: params.id, userId: me.id, emoji } },
      select: { id: true },
    });

    let op: "add" | "remove";
    if (existing) {
      await prisma.chatReaction.delete({ where: { id: existing.id } });
      op = "remove";
    } else {
      await prisma.chatReaction.create({
        data: { messageId: params.id, userId: me.id, emoji },
      });
      op = "add";
    }

    await broadcastChatEvent({
      event: "reaction",
      payload: { messageId: params.id, emoji, userId: me.id, op },
    });

    return ok({ op, emoji });
  } catch (err) {
    return handleError(err, "chat:react");
  }
}
