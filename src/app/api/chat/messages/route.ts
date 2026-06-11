import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser, isCuid } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import {
  chatMessageSchema,
  broadcastChatEvent,
  CHAT_PAGE_SIZE,
  type ChatMessagePayload,
} from "@/lib/chat";

const AUTHOR_SELECT = {
  name: true,
  username: true,
  image: true,
  membership: true,
  role: true,
} as const;

function toPayload(m: {
  id: string;
  body: string;
  createdAt: Date;
  userId: string;
  user: { name: string | null; username: string | null; image: string | null; membership: string; role: string };
}): ChatMessagePayload {
  return {
    id: m.id,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    userId: m.userId,
    author: m.user,
  };
}

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
      select: {
        id: true,
        body: true,
        createdAt: true,
        userId: true,
        user: { select: AUTHOR_SELECT },
      },
    });

    const hasMore = rows.length > CHAT_PAGE_SIZE;
    const page = hasMore ? rows.slice(0, CHAT_PAGE_SIZE) : rows;
    // Oldest-first for rendering; cursor = oldest id of this page.
    const messages = page.reverse().map(toPayload);

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

    const created = await prisma.chatMessage.create({
      data: { body: parsed.data.body, userId: me.id },
      select: {
        id: true,
        body: true,
        createdAt: true,
        userId: true,
        user: { select: AUTHOR_SELECT },
      },
    });

    const message = toPayload(created);
    await broadcastChatEvent({ event: "new_message", payload: message });

    return ok({ message }, 201);
  } catch (err) {
    return handleError(err, "chat:create");
  }
}
