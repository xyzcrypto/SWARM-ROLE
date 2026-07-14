import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser, isCuid } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/journal/challenges/[id]/join - join a public/community challenge.
// Idempotent: already-joined just returns success (unique constraint on
// [challengeId, userId] makes a duplicate insert a no-op).
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in to join a challenge.", 401);
    if (!isCuid(params.id)) return fail("Invalid challenge id.", 400);
    const { success } = await rateLimit("journal", me.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const challenge = await prisma.challenge.findUnique({ where: { id: params.id } });
    if (!challenge) return fail("Not found.", 404);
    if (challenge.visibility === "private") return fail("This challenge is private.", 403);

    await prisma.challengeParticipant
      .create({ data: { challengeId: challenge.id, userId: me.id, role: "participant" } })
      .catch(() => {}); // already joined - fine

    return ok({ joined: true });
  } catch (err) {
    return handleError(err, "journal:challenges:join");
  }
}
