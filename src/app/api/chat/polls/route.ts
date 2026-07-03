import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { broadcastChatEvent, toChatPayload, CHAT_MESSAGE_SELECT } from "@/lib/chat";

const createSchema = z.object({
  question: z.string().trim().min(3, "Question is too short.").max(200, "Keep the question under 200 characters."),
  options: z
    .array(z.string().trim().min(1, "Option cannot be empty.").max(80, "Keep options under 80 characters."))
    .min(2, "A poll needs at least 2 options.")
    .max(8, "Maximum 8 options.")
    .refine((opts) => new Set(opts.map((o) => o.toLowerCase())).size === opts.length, {
      message: "Options must be unique.",
    }),
});

// POST /api/chat/polls - create a Telegram-style poll in the community chat.
// The poll IS a chat message (kind: "poll", body = question) so it flows
// through history, realtime, moderation and pagination like any message.
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);

    const { success } = await rateLimit("chat", me.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }
    const { question, options } = parsed.data;

    const created = await prisma.$transaction(async (tx) => {
      const message = await tx.chatMessage.create({
        data: { body: question, kind: "poll", userId: me.id },
        select: { id: true },
      });
      await tx.chatPoll.create({
        data: {
          question,
          messageId: message.id,
          options: { create: options.map((text, i) => ({ text, order: i })) },
        },
      });
      return tx.chatMessage.findUniqueOrThrow({ where: { id: message.id }, select: CHAT_MESSAGE_SELECT });
    });

    const payload = toChatPayload(created);
    await broadcastChatEvent({ event: "new_message", payload });

    return ok({ message: payload }, 201);
  } catch (err) {
    return handleError(err, "chat:poll:create");
  }
}
