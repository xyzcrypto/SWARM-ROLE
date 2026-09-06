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
        // ⚠️ Must match the INBOX's filter (src/app/api/dm/route.ts), and did
        // not. This counted conversations the inbox refuses to show, so hiding
        // a conversation that still had an unread message left a badge in the
        // navbar with no thread behind it to open and clear.
        //
        // It needs the hidden ones excluded rather than "usually excluded":
        // a new message un-hides a conversation on the send path, so the only
        // way to be hidden AND unread is to have removed it without reading it
        // - which is exactly the case that got stuck.
        where: {
          OR: [
            { userAId: me.id, hiddenByA: false },
            { userBId: me.id, hiddenByB: false },
          ],
        },
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
