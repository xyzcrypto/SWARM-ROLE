import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser, isCuid } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * The reasons a member may report a message.
 *
 * A fixed list, validated server-side. Free-text-only reporting produces a
 * queue nobody can triage; an open enum would let a client invent categories
 * that the moderation view has no meaning for.
 */
export const REPORT_REASONS = ["harassment", "spam", "scam", "illegal", "threat", "other"] as const;

const bodySchema = z.object({
  reason: z.enum(REPORT_REASONS),
  // Optional, and capped. This is free text from an unauthenticated-adjacent
  // surface that a moderator will read: 600 characters is enough to explain a
  // report and short enough that it cannot be used as a storage channel.
  details: z.string().trim().max(600).optional().default(""),
});

/**
 * POST /api/chat/messages/<id>/report - flag a message for staff review.
 *
 * ## What this deliberately does NOT do
 *
 * ⚠️ It returns nothing about moderation. Not whether the message was already
 * reported, not by how many people, not whether staff have acted, not who the
 * moderators are. The reporter learns one thing: that their own report was
 * received. Every other answer is a probe someone could run against the room.
 *
 * ⚠️ It does not hide anything. Reporting is a signal, not an action - a
 * self-service hide would let any member silence any other, which is a worse
 * failure than a slow queue. Hiding stays with `post:manage` in the existing
 * moderate route, untouched by this PR.
 *
 * ## The gates, in order
 *
 * 1. **Authenticated.** Anonymous reports cannot be rate-limited per person and
 *    cannot be de-duplicated, which makes the queue unusable.
 * 2. **Rate limited twice** - per user AND per IP. Per-user alone is defeated
 *    by registering accounts; per-IP alone punishes shared NAT. This is the
 *    two-key pattern the rest of this codebase uses for abusable endpoints.
 * 3. **Shape-checked before the DB** - a non-cuid id can only ever be a 404.
 * 4. **The message must be VISIBLE.** You cannot report what you cannot see,
 *    which is also what stops the endpoint being used to enumerate hidden or
 *    deleted message ids.
 * 5. **Not your own message.** Reporting yourself is noise in the queue.
 * 6. **One per person per message**, enforced by a unique index rather than a
 *    read-then-write - see the P2002 branch below.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in to report a message.", 401);

    // Two independent keys, so neither a fresh account nor a rotated IP gets a
    // clean budget on its own.
    // ⚠️ Block-scoped so BOTH checks can use the canonical
    // `const { success } = …; if (!success) return` shape.
    // `api-rate-limits.test.ts` greps for exactly that, and it is right to:
    // a limiter whose result is never checked reads as protection while
    // allowing everything through. Renaming the result to dodge the check
    // would have weakened a security test to fit my code.
    {
      const { success } = await rateLimit("comment", `report-${me.id}`);
      if (!success) return fail("You're reporting too quickly. Please slow down.", 429);
    }
    {
      const { success } = await rateLimit("comment", `report-ip-${clientIp(req)}`);
      if (!success) return fail("You're reporting too quickly. Please slow down.", 429);
    }

    const { id } = await ctx.params;
    if (!isCuid(id)) return fail("Not found.", 404);

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid report.", 400);

    // ⚠️ `status: "visible"` is part of the WHERE, not a check afterwards. It is
    // what makes "you can only report what you can see" true at the database
    // rather than in a branch someone can later reorder.
    const message = await prisma.chatMessage.findFirst({
      where: { id, status: "visible" },
      select: { id: true, userId: true },
    });
    if (!message) return fail("Not found.", 404);
    if (message.userId === me.id) return fail("You cannot report your own message.", 400);

    try {
      await prisma.chatReport.create({
        data: {
          messageId: message.id,
          userId: me.id,
          reason: parsed.data.reason,
          details: parsed.data.details || null,
        },
      });
    } catch (err) {
      // ⚠️ A duplicate returns the SAME success the first report did.
      //
      // Telling the reporter "you already reported this" would confirm the
      // existence of a prior report, which is moderation state. It also gains
      // them nothing: the report is on file either way. Silence here is both
      // the safer and the more honest answer.
      if ((err as { code?: string })?.code !== "P2002") throw err;
    }

    // The same response in every successful path, including the duplicate one.
    return ok({ received: true });
  } catch (err) {
    // `handleError` maps a missing table (P2021/P2022) to a graceful 503, so
    // the room keeps working if this ships ahead of its migration.
    return handleError(err, "chat:report");
  }
}
