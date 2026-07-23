import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser, isCuid } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const daySchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
  note: z.string().max(1000).nullable().optional(),
  mood: z.enum(["disciplined", "neutral", "off-plan"]).nullable().optional(),
});

// PUT /api/journal/challenges/[id]/days - upsert the CALLER's own day note/mood
// for one day of a challenge they're participating in. Participant-gated, not
// owner-gated - this is each participant's own personal log, unlike milestones
// (which are the creator's checkpoints for the whole challenge).
export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    if (!isCuid(params.id)) return fail("Invalid challenge id.", 400);
    const { success } = await rateLimit("journal", me.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const challenge = await prisma.challenge.findUnique({
      where: { id: params.id },
      include: { participants: { where: { userId: me.id } } },
    });
    if (!challenge) return fail("Not found.", 404);
    const isParticipant = challenge.creatorId === me.id || challenge.participants.length > 0;
    if (!isParticipant) return fail("You're not a participant of that challenge.", 403);

    const parsed = daySchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.", 400);
    const d = parsed.data;

    const dayNote = await prisma.challengeDayNote.upsert({
      where: { challengeId_userId_day: { challengeId: challenge.id, userId: me.id, day: d.day } },
      create: { challengeId: challenge.id, userId: me.id, day: d.day, note: d.note ?? null, mood: d.mood ?? null },
      update: { note: d.note ?? null, mood: d.mood ?? null },
    });
    return ok({ dayNote });
  } catch (err) {
    return handleError(err, "journal:challenges:days:put");
  }
}
