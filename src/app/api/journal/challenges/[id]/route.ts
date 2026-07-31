import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser, isCuid } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { buildLeaderboard, type ChallengeTrade } from "@/lib/challenge";
import { broadcastEvent, userChannel } from "@/lib/realtime";
import { activityForChallengeCompleted } from "@/lib/journal-activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/journal/challenges/[id] - challenge detail + a leaderboard.
// PRIVACY: other participants' raw trade fills never leave the server - only
// the aggregated {capital, returnPct, trades count} computed by
// buildLeaderboard() is returned. The caller's OWN trades come back in full.
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    if (!isCuid(params.id)) return fail("Invalid challenge id.", 400);

    const challenge = await prisma.challenge.findUnique({
      where: { id: params.id },
      include: {
        participants: { include: { user: { select: { id: true, name: true, username: true } } } },
        milestones: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!challenge) return fail("Not found.", 404);

    const isParticipant = challenge.creatorId === me.id || challenge.participants.some((p) => p.userId === me.id);
    if (challenge.visibility === "private" && !isParticipant) return fail("Not found.", 404);

    const allTrades = await prisma.trade
      .findMany({
        where: { challengeId: challenge.id },
        select: { userId: true, side: true, fills: { select: { kind: true, price: true, size: true, fee: true } } },
      })
      .catch(() => [] as any[]);

    const tradesByUserId = new Map<string, ChallengeTrade[]>();
    for (const t of allTrades) {
      const arr = tradesByUserId.get(t.userId) ?? [];
      arr.push({ side: t.side, fills: t.fills });
      tradesByUserId.set(t.userId, arr);
    }
    const participants = challenge.participants.map((p) => ({
      userId: p.userId,
      name: p.user.name || p.user.username || "Trader",
    }));
    const leaderboard = buildLeaderboard(participants, tradesByUserId, challenge.startingCapital);

    const myTrades = await prisma.trade
      .findMany({
        where: { challengeId: challenge.id, userId: me.id },
        include: { fills: { orderBy: { executedAt: "asc" } } },
        orderBy: { createdAt: "desc" },
      })
      .catch(() => [] as any[]);

    const dayNotes = await prisma.challengeDayNote
      .findMany({ where: { challengeId: challenge.id, userId: me.id }, orderBy: { day: "asc" } })
      .catch(() => [] as any[]); // tolerate a not-yet-migrated DB -> empty

    return ok({ challenge, milestones: challenge.milestones, leaderboard, myTrades, dayNotes, isParticipant, isOwner: challenge.creatorId === me.id });
  } catch (err) {
    return handleError(err, "journal:challenges:get-one");
  }
}

const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  startDate: z.number().finite().optional(),
  endDate: z.number().finite().optional(),
  startingCapital: z.number().positive().max(1_000_000_000).optional(),
  targetCapital: z.number().positive().nullable().optional(),
  maxRiskPerTradePct: z.number().positive().max(100).nullable().optional(),
  maxDailyLossPct: z.number().positive().max(100).nullable().optional(),
  maxWeeklyDrawdownPct: z.number().positive().max(100).nullable().optional(),
  customRules: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  visibility: z.enum(["private", "public", "community"]).optional(),
  status: z.enum(["active", "completed", "failed", "abandoned"]).optional(),
});

// PATCH /api/journal/challenges/[id] - creator-only edits.
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    if (!isCuid(params.id)) return fail("Invalid challenge id.", 400);
    const { success } = await rateLimit("journal", me.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const existing = await prisma.challenge.findUnique({ where: { id: params.id } });
    if (!existing || existing.creatorId !== me.id) return fail("Not found.", 404);

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.", 400);
    const { startDate, endDate, ...rest } = parsed.data;

    const challenge = await prisma.challenge.update({
      where: { id: params.id },
      data: {
        ...rest,
        ...(startDate !== undefined ? { startDate: new Date(startDate) } : {}),
        ...(endDate !== undefined ? { endDate: new Date(endDate) } : {}),
      },
    });

    if (rest.status === "completed" && existing.status !== "completed" && challenge.visibility !== "private") {
      prisma.journalActivity
        .create({ data: { userId: me.id, ...activityForChallengeCompleted(challenge.title) } })
        .then(() => broadcastEvent(userChannel(me.id), "journal_activity", {}))
        .catch(() => {}); // best-effort - never blocks the challenge update
    }

    return ok({ challenge });
  } catch (err) {
    return handleError(err, "journal:challenges:patch");
  }
}

// DELETE /api/journal/challenges/[id] - creator-only.
export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    if (!isCuid(params.id)) return fail("Invalid challenge id.", 400);
    // Same bucket as PATCH above - a delete is as much a write as an edit.
    const { success } = await rateLimit("journal", me.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    await prisma.challenge.deleteMany({ where: { id: params.id, creatorId: me.id } });
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err, "journal:challenges:delete");
  }
}
