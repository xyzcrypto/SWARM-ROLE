import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/chat/bookmarks - the ids of MY bookmarked messages, so the room can
// mark them. Personal, so never cached anywhere. A database that has not had
// migration 42 pushed yet answers an empty list instead of an error.
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ ids: [] }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  const rows = await prisma.chatBookmark
    .findMany({ where: { userId: me.id }, select: { messageId: true }, orderBy: { createdAt: "desc" }, take: 500 })
    .catch(() => [] as { messageId: string }[]);
  return NextResponse.json({ ids: rows.map((r) => r.messageId) }, { headers: { "Cache-Control": "private, no-store" } });
}
