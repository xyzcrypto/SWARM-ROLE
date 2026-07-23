import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser, isCuid } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { broadcastChatEvent } from "@/lib/chat";

const voteSchema = z.object({ optionId: z.string() });

// POST /api/chat/polls/[id]/vote - vote in a poll. Telegram semantics:
// one vote per user; voting a different option moves your vote; voting the
// SAME option again retracts it. Broadcasts anonymous counts only.
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);

    const { success } = await rateLimit("like", me.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const parsed = voteSchema.safeParse(await req.json());
    if (!parsed.success || !isCuid(params.id) || !isCuid(parsed.data.optionId)) {
      return fail("Invalid input.", 400);
    }
    const { optionId } = parsed.data;

    const poll = await prisma.chatPoll.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        messageId: true,
        message: { select: { status: true } },
        options: { select: { id: true } },
      },
    });
    if (!poll || poll.message.status !== "visible") return fail("Poll not found.", 404);
    if (!poll.options.some((o) => o.id === optionId)) return fail("Invalid option.", 400);

    const existing = await prisma.chatPollVote.findUnique({
      where: { pollId_userId: { pollId: poll.id, userId: me.id } },
      select: { id: true, optionId: true },
    });

    let myVote: string | null;
    if (!existing) {
      await prisma.chatPollVote.create({ data: { pollId: poll.id, optionId, userId: me.id } });
      myVote = optionId;
    } else if (existing.optionId === optionId) {
      await prisma.chatPollVote.delete({ where: { id: existing.id } }); // retract
      myVote = null;
    } else {
      await prisma.chatPollVote.update({ where: { id: existing.id }, data: { optionId } }); // move
      myVote = optionId;
    }

    // Fresh anonymous counts for the broadcast + response.
    const grouped = await prisma.chatPollVote.groupBy({
      by: ["optionId"],
      where: { pollId: poll.id },
      _count: { _all: true },
    });
    const byOption = new Map(grouped.map((g) => [g.optionId, g._count._all]));
    const counts = poll.options.map((o) => ({ optionId: o.id, count: byOption.get(o.id) ?? 0 }));
    const total = counts.reduce((s, c) => s + c.count, 0);

    await broadcastChatEvent({
      event: "poll_vote",
      payload: { pollId: poll.id, messageId: poll.messageId, counts, total },
    });

    return ok({ ok: true, counts, total, myVote });
  } catch (err) {
    return handleError(err, "chat:poll:vote");
  }
}
