import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canStartConversation } from "@/lib/dm-gate";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { orderPair, otherOf, isUnread, DM_USER_SELECT } from "@/lib/dm";
import { normalizeUsername } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/dm — my inbox: conversations newest-first with the other participant,
// a preview snippet, and an unread flag. Returns { conversations, unread }.
export async function GET() {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);

    const rows = await prisma.conversation
      .findMany({
        where: { OR: [{ userAId: me.id }, { userBId: me.id }] },
        orderBy: { lastMessageAt: "desc" },
        take: 50,
        include: { userA: { select: DM_USER_SELECT }, userB: { select: DM_USER_SELECT } },
      })
      .catch(() => [] as any[]);

    const conversations = rows.map((c: any) => {
      const { other } = otherOf(c, me.id);
      const iAmA = c.userAId === me.id;
      return {
        id: c.id,
        other: other ? { id: other.id, name: other.name || other.username || "Member", username: other.username, image: other.image } : null,
        lastBody: c.lastBody ?? "",
        lastMessageAt: c.lastMessageAt,
        unread: isUnread(c, me.id),
        // Enough for a tick on the row preview, the same way the thread does
        // it: whether the last message was mine, and when they last read.
        lastMine: !!c.lastSenderId && c.lastSenderId === me.id,
        otherReadAt: (iAmA ? c.readBAt : c.readAAt) ?? null,
      };
    });

    return ok({ conversations, unread: conversations.filter((c: any) => c.unread).length });
  } catch (err) {
    return handleError(err, "dm:inbox");
  }
}

const startSchema = z.object({ username: z.string().min(1).max(40) });

// POST /api/dm — open (or create) my conversation with another user by username.
// Returns { conversationId }.
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in to message.", 401);
    // Same bucket the message-send path uses (dm/[id]). This handler upserts a
    // Conversation row, so unthrottled it lets one account create conversations
    // with every user it can name, as fast as it can post.
    const { success } = await rateLimit("dm", me.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const parsed = startSchema.safeParse(await req.json());
    if (!parsed.success) return fail("Invalid input.", 400);

    const handle = normalizeUsername(parsed.data.username);
    if (!handle) return fail("Invalid username.", 400);

    const target = await prisma.user.findUnique({ where: { username: handle }, select: { id: true } });
    if (!target) return fail("User not found.", 404);
    if (target.id === me.id) return fail("You can't message yourself.", 400);

    // Blocks, plus the recipient's own rule about who may approach them.
    const gate = await canStartConversation(me.id, target.id);
    if (!gate.ok) return fail(gate.reason, 403);

    const { userAId, userBId } = orderPair(me.id, target.id);
    const conv = await prisma.conversation.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      create: { userAId, userBId },
      update: {},
      select: { id: true },
    });

    return ok({ conversationId: conv.id });
  } catch (err) {
    return handleError(err, "dm:start");
  }
}
