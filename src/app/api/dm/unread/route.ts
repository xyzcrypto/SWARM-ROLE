import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { isUnread } from "@/lib/dm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/dm/unread — a lightweight count of my conversations with unread
// messages, for the navbar badge. Keeps the payload tiny (no message bodies).
export async function GET() {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);

    const rows = await prisma.conversation
      .findMany({
        where: { OR: [{ userAId: me.id }, { userBId: me.id }] },
        select: { userAId: true, lastMessageAt: true, lastSenderId: true, readAAt: true, readBAt: true },
        take: 200,
      })
      .catch(() => [] as any[]);

    const unread = rows.filter((c: any) => isUnread(c, me.id)).length;
    return ok({ unread });
  } catch (err) {
    return handleError(err, "dm:unread");
  }
}
