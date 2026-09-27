import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser, isCuid } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { broadcastEvent, userChannel } from "@/lib/realtime";
import { canSendInThread } from "@/lib/dm-gate";
import { isDmReaction } from "@modules/messages/lib/dm-reactions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; messageId: string }> };

// `null` takes my reaction off. Anything else must be one of the fixed set -
// free text here would be a way to put arbitrary words into someone's thread.
const reactSchema = z.object({
  emoji: z.union([z.null(), z.string().refine(isDmReaction, "Unknown reaction.")]),
});

// POST /api/dm/[id]/message/[messageId]/react - set or clear MY reaction.
//
// One reaction per participant per message (see `reactionA`/`reactionB` in the
// schema). Either participant may react to any visible message, their own
// included, like every messenger does.
export async function POST(req: Request, props: Ctx) {
  const params = await props.params;
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    if (!isCuid(params.id) || !isCuid(params.messageId)) return fail("Invalid id.", 400);

    // Two keys, the pattern for anything a person can spam at another person:
    // per account, and per IP so a pile of fresh accounts does not multiply it.
    {
      const { success } = await rateLimit("dm", `react-${me.id}`);
      if (!success) return fail("You're doing that too fast. Take a breath.", 429);
    }
    {
      const { success } = await rateLimit("dm", `react-ip-${clientIp(req)}`);
      if (!success) return fail("You're doing that too fast. Take a breath.", 429);
    }

    const parsed = reactSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid reaction.", 400);

    // Authorised from the MESSAGE's own conversation, not the id in the URL -
    // a valid message id from someone else's thread must not pass because the
    // conversation id next to it is mine.
    const msg = await prisma.directMessage.findUnique({
      where: { id: params.messageId },
      select: {
        id: true,
        status: true,
        conversationId: true,
        conversation: { select: { userAId: true, userBId: true } },
      },
    });
    const c = msg?.conversation;
    if (!msg || !c || msg.conversationId !== params.id || (c.userAId !== me.id && c.userBId !== me.id)) {
      return fail("Message not found.", 404);
    }
    if (msg.status !== "visible") return fail("Message not found.", 404);

    const iAmA = c.userAId === me.id;
    const otherId = iAmA ? c.userBId : c.userAId;
    // A block closes the thread, reactions included - otherwise a reaction
    // would be the one way left to reach someone who blocked you.
    const gate = await canSendInThread(me.id, otherId);
    if (!gate.ok) return fail(gate.reason, 403);

    const emoji = parsed.data.emoji;
    await prisma.directMessage.update({
      where: { id: msg.id },
      data: iAmA ? { reactionA: emoji } : { reactionB: emoji },
    });

    // A bare ping, like every other DM event: this channel is public, so no
    // content goes on the wire. The other side refetches through the
    // participant-checked thread GET.
    await broadcastEvent(userChannel(otherId), "dm_message", { conversationId: msg.conversationId });
    return ok({ emoji });
  } catch (err) {
    return handleError(err, "dm:react");
  }
}
