import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser, isCuid } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  label: z.string().trim().min(1).max(200),
  targetDate: z.number().finite().optional(),
});

// POST /api/journal/challenges/[id]/milestones - creator-only, add a review checkpoint.
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    if (!isCuid(params.id)) return fail("Invalid challenge id.", 400);
    const { success } = await rateLimit("journal", me.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const challenge = await prisma.challenge.findUnique({ where: { id: params.id } });
    if (!challenge || challenge.creatorId !== me.id) return fail("Not found.", 404);

    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.", 400);
    const d = parsed.data;

    const milestone = await prisma.challengeMilestone.create({
      data: { challengeId: challenge.id, label: d.label, targetDate: d.targetDate ? new Date(d.targetDate) : null },
    });
    return ok({ milestone }, 201);
  } catch (err) {
    return handleError(err, "journal:challenges:milestones:post");
  }
}
