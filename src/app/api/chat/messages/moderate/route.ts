import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, requirePermission, isCuid } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { broadcastChatEvent, toChatPayload, CHAT_MESSAGE_SELECT } from "@/lib/chat";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

// GET /api/chat/messages/moderate - moderation view of the chat (post:manage):
// latest messages INCLUDING hidden ones (the public GET is visible-only), with
// status so hidden messages can be reviewed and restored.
export async function GET(req: Request) {
  try {
    const actor = await requirePermission("post:manage");
    if (!actor) return fail("Forbidden", 403);

    const params = new URL(req.url).searchParams;
    const statusParam = params.get("status") ?? "all";
    const status = ["visible", "hidden"].includes(statusParam) ? statusParam : undefined;
    const cursor = params.get("cursor");

    const rows = await prisma.chatMessage.findMany({
      where: status ? { status } : {},
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
      select: { ...CHAT_MESSAGE_SELECT, status: true },
    });
    const hasMore = rows.length > PAGE_SIZE;
    const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

    return ok({
      messages: page.map((m) => ({ ...toChatPayload(m), status: m.status })),
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    });
  } catch (err) {
    return handleError(err, "chat:moderate:list");
  }
}

const actionSchema = z.object({
  id: z.string(),
  action: z.enum(["hide", "restore"]),
});

// POST /api/chat/messages/moderate - hide or restore a message (post:manage).
// Broadcasts so live clients update: hide → message_hidden (tombstone);
// restore → new_message (clients ignore duplicates by id).
export async function POST(req: Request) {
  try {
    const actor = await requirePermission("post:manage");
    if (!actor) return fail("Forbidden", 403);

    const { success } = await rateLimit("admin", clientIp(req));
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const parsed = actionSchema.safeParse(await req.json());
    if (!parsed.success || !isCuid(parsed.data.id)) return fail("Invalid input.", 400);
    const { id, action } = parsed.data;

    const msg = await prisma.chatMessage.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!msg) return fail("Message not found.", 404);

    const nextStatus = action === "hide" ? "hidden" : "visible";
    if (msg.status !== nextStatus) {
      await prisma.chatMessage.update({ where: { id }, data: { status: nextStatus } });
      if (action === "hide") {
        await broadcastChatEvent({ event: "message_hidden", payload: { id } });
      } else {
        const restored = await prisma.chatMessage.findUnique({ where: { id }, select: CHAT_MESSAGE_SELECT });
        if (restored) await broadcastChatEvent({ event: "new_message", payload: toChatPayload(restored) });
      }
    }

    return ok({ ok: true, status: nextStatus });
  } catch (err) {
    return handleError(err, "chat:moderate");
  }
}
