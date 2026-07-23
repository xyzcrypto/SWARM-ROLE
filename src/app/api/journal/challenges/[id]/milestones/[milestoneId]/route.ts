import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser, isCuid } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { broadcastEvent, userChannel } from "@/lib/realtime";
import { activityForMilestone } from "@/lib/journal-activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({ achieved: z.boolean() });

// PATCH /api/journal/challenges/[id]/milestones/[milestoneId] - creator-only,
// toggle a milestone's achieved state.
export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const params = await props.params;
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    if (!isCuid(params.id) || !isCuid(params.milestoneId)) return fail("Invalid id.", 400);
    const { success } = await rateLimit("journal", me.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const challenge = await prisma.challenge.findUnique({ where: { id: params.id } });
    if (!challenge || challenge.creatorId !== me.id) return fail("Not found.", 404);

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.", 400);

    const before = await prisma.challengeMilestone.findUnique({ where: { id: params.milestoneId } });

    const milestone = await prisma.challengeMilestone.update({
      where: { id: params.milestoneId },
      data: { achieved: parsed.data.achieved, achievedAt: parsed.data.achieved ? new Date() : null },
    });

    if (parsed.data.achieved && before && !before.achieved && challenge.visibility !== "private") {
      prisma.journalActivity
        .create({ data: { userId: me.id, ...activityForMilestone(challenge.title, milestone.label) } })
        .then(() => broadcastEvent(userChannel(me.id), "journal_activity", {}))
        .catch(() => {}); // best-effort - never blocks the milestone update
    }

    return ok({ milestone });
  } catch (err) {
    return handleError(err, "journal:challenges:milestones:patch");
  }
}

// DELETE /api/journal/challenges/[id]/milestones/[milestoneId] - creator-only.
export async function DELETE(
  _req: Request,
  props: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const params = await props.params;
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    if (!isCuid(params.id) || !isCuid(params.milestoneId)) return fail("Invalid id.", 400);

    const challenge = await prisma.challenge.findUnique({ where: { id: params.id } });
    if (!challenge || challenge.creatorId !== me.id) return fail("Not found.", 404);

    await prisma.challengeMilestone.deleteMany({ where: { id: params.milestoneId, challengeId: params.id } });
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err, "journal:challenges:milestones:delete");
  }
}
