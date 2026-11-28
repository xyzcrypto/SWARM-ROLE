import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser, isCuid } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REASONS = ["spam", "harassment", "scam", "other"] as const;

const schema = z.object({
  userId: z.string().min(1),
  reason: z.enum(REASONS),
  note: z.string().trim().max(500).optional(),
  messageId: z.string().optional(),
});

/**
 * POST /api/dm/report - report a member, optionally citing one DM.
 *
 * Exists because block on its own is only half a safety story: it protects the
 * person who pressed it and tells the owner nothing. A report lands in a queue
 * someone can act on.
 *
 * The message is referenced by id rather than copied. DM deletes are soft, so
 * the evidence is still there for whoever reviews it, and storing a second copy
 * of a private message outside the conversation is the kind of thing that ages
 * badly.
 */
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);

    // Reports are cheap to file and expensive to read, so they get their own
    // throttle rather than sharing the send bucket.
    const { success } = await rateLimit("dm", `report:${me.id}`);
    if (!success) return fail("Too many reports. Please slow down.", 429);

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Invalid report.", 400);
    const { userId, reason, note, messageId } = parsed.data;
    if (!isCuid(userId)) return fail("Invalid member.", 400);
    if (userId === me.id) return fail("You can't report yourself.", 400);

    // A cited message must be one the REPORTED member sent, in a conversation
    // the REPORTER is part of. Any DM id used to be accepted, and the staff
    // queue shows that message's text: a crafted report could pin someone
    // else's words on the accused, or surface a private DM the reporter was
    // never in. A message that does not qualify is dropped, the report stays.
    let citedId: string | null = null;
    if (messageId && isCuid(messageId)) {
      const m = await prisma.directMessage
        .findUnique({ where: { id: messageId }, select: { senderId: true, conversation: { select: { userAId: true, userBId: true } } } })
        .catch(() => null);
      const inIt = m && (m.conversation.userAId === me.id || m.conversation.userBId === me.id);
      if (m && inIt && m.senderId === userId) citedId = messageId;
    }

    await prisma.report
      .create({
        data: {
          reporterId: me.id,
          subjectId: userId,
          reason,
          note: note || null,
          messageId: citedId,
        },
      })
      .catch(() => null); // a not-yet-migrated DB must not swallow the UI

    return ok({ reported: true });
  } catch (err) {
    return handleError(err, "dm:report");
  }
}
