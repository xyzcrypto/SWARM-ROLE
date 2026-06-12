import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser, isCuid } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import {
  chatMessageSchema,
  broadcastChatEvent,
  toChatPayload,
  CHAT_MESSAGE_SELECT,
  CHAT_PAGE_SIZE,
} from "@/lib/chat";

// GET /api/chat/messages[?cursor=<id>] — public chat history, newest page
// first; pass the oldest message id as cursor to page further back.
export async function GET(req: Request) {
  try {
    const cursor = new URL(req.url).searchParams.get("cursor");
    if (cursor && !isCuid(cursor)) return fail("Invalid cursor.", 400);

    const rows = await prisma.chatMessage.findMany({
      where: { status: "visible" },
      orderBy: { createdAt: "desc" },
      take: CHAT_PAGE_SIZE + 1, // +1 → hasMore without a count query
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: CHAT_MESSAGE_SELECT,
    });

    const hasMore = rows.length > CHAT_PAGE_SIZE;
    const page = hasMore ? rows.slice(0, CHAT_PAGE_SIZE) : rows;
    // Oldest-first for rendering; cursor = oldest id of this page.
    const messages = page.reverse().map(toChatPayload);

    return ok({ messages, hasMore, nextCursor: hasMore ? page[0]!.id : null });
  } catch (err) {
    return handleError(err, "chat:list");
  }
}

// POST /api/chat/messages — send a message (logged-in only, rate-limited).
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in to chat.", 401);

    const { success } = await rateLimit("chat", me.id);
    if (!success) return fail("You're sending messages too fast. Take a breath.", 429);

    const parsed = chatMessageSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid message", 400);
    }

    // Validate the reply target exists and is visible (ignore otherwise).
    let replyToId: string | null = null;
    if (parsed.data.replyToId) {
      const parent = await prisma.chatMessage.findUnique({
        where: { id: parsed.data.replyToId },
        select: { id: true, status: true },
      });
      if (parent && parent.status === "visible") replyToId = parent.id;
    }

    const created = await prisma.chatMessage.create({
      data: { body: parsed.data.body, userId: me.id, replyToId },
      select: CHAT_MESSAGE_SELECT,
    });

    const message = toChatPayload(created);
    await broadcastChatEvent({ event: "new_message", payload: message });

    return ok({ message }, 201);
  } catch (err) {
    return handleError(err, "chat:create");
  }
}
