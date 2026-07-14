import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";

// GET /api/chat/last-activity - a single timestamp, nothing else. The navbar's
// chat-activity dot only needs to know whether a newer message exists than the
// visitor's last-seen marker; it used to fetch the full /api/chat/messages
// page (up to 50 complete messages) just to read the last one's createdAt,
// which was a real, sitewide, every-60s cost for zero extra information.
export async function GET() {
  try {
    const latest = await prisma.chatMessage
      .findFirst({
        where: { status: "visible" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      })
      .catch(() => null);

    const res = ok({ latestAt: latest?.createdAt ?? null });
    res.headers.set("Cache-Control", "public, s-maxage=15, stale-while-revalidate=60");
    return res;
  } catch (err) {
    return handleError(err, "chat:last-activity");
  }
}
