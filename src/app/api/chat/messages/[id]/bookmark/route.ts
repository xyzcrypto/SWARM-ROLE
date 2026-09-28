import { ok, fail, handleError, getSessionUser, isCuid } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/chat/messages/[id]/bookmark - bookmark a community message.
// Idempotent (upsert on the unique pair). Only a visible message can be
// bookmarked; bookmarks show on the member's public profile.
export async function POST(req: Request, props: Ctx) {
  const params = await props.params;
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    if (!isCuid(params.id)) return fail("Invalid id.", 400);
    {
      const { success } = await rateLimit("like", `bookmark-${me.id}`);
      if (!success) return fail("Too many requests. Please slow down.", 429);
    }
    {
      const { success } = await rateLimit("like", `bookmark-ip-${clientIp(req)}`);
      if (!success) return fail("Too many requests. Please slow down.", 429);
    }
    const msg = await prisma.chatMessage.findFirst({ where: { id: params.id, status: "visible" }, select: { id: true } });
    if (!msg) return fail("Message not found.", 404);
    await prisma.chatBookmark.upsert({
      where: { userId_messageId: { userId: me.id, messageId: msg.id } },
      create: { userId: me.id, messageId: msg.id },
      update: {},
    });
    return ok({ bookmarked: true });
  } catch (err) {
    return handleError(err, "chat:bookmark");
  }
}

// DELETE - remove my bookmark (a no-op if there was none).
export async function DELETE(req: Request, props: Ctx) {
  const params = await props.params;
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    if (!isCuid(params.id)) return fail("Invalid id.", 400);
    {
      const { success } = await rateLimit("like", `bookmark-${me.id}`);
      if (!success) return fail("Too many requests. Please slow down.", 429);
    }
    {
      const { success } = await rateLimit("like", `bookmark-ip-${clientIp(req)}`);
      if (!success) return fail("Too many requests. Please slow down.", 429);
    }
    await prisma.chatBookmark.deleteMany({ where: { userId: me.id, messageId: params.id } });
    return ok({ bookmarked: false });
  } catch (err) {
    return handleError(err, "chat:unbookmark");
  }
}
