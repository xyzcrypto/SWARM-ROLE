import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser, isCuid } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { journalLimitsFor } from "@/lib/journal-limits";
import { rankStandings, type LeaderboardEntry, type Standing } from "@modules/tools/lib/challenge";
import { challengeStandings } from "@modules/journal/lib/challenge-board";
import { broadcastEvent, userChannel } from "@/lib/realtime";
import { activityForChallengeCompleted, challengeActivitySource, challengeActivityWhere } from "@/lib/journal-activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/journal/challenges/[id] - challenge detail + a leaderboard.
// PRIVACY: other participants' raw trade fills never leave the server - only
// the aggregated {capital, returnPct, trades count} summed by
// challengeStandings() is returned. The caller's OWN trades come back in full.
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    if (!isCuid(params.id)) return fail("Invalid challenge id.", 400);

    // No participant list here any more: it was every participant with their
    // name, sent to every viewer, on top of every participant's every fill
    // (review M10). Membership is one indexed lookup; the board is summed in SQL.
    const [challenge, membership] = await Promise.all([
      prisma.challenge.findUnique({
        where: { id: params.id },
        include: {
          milestones: { orderBy: { createdAt: "asc" } },
          _count: { select: { participants: true } },
        },
      }),
      prisma.challengeParticipant.findUnique({ where: { challengeId_userId: { challengeId: params.id, userId: me.id } }, select: { id: true } }),
    ]);
    if (!challenge) return fail("Not found.", 404);

    const isParticipant = challenge.creatorId === me.id || !!membership;
    if (challenge.visibility === "private" && !isParticipant) return fail("Not found.", 404);

    // These three are mutually independent - each keys off `challenge.id` (and
    // `me.id`) and none reads another's result - but they were awaited one after
    // the other, so this handler paid three full round trips to Mumbai in series
    // where one wall-clock trip would do. Only the `challenge` lookup above has
    // to come first, because the visibility gate depends on it.
    const [standings, myTrades, dayNotes] = await Promise.all([
      challengeStandings(challenge.id).catch(() => [] as Standing[]),
      prisma.trade
        .findMany({
          where: { challengeId: challenge.id, userId: me.id },
          include: { fills: { orderBy: { executedAt: "asc" } } },
          orderBy: { createdAt: "desc" },
        })
        .catch(() => [] as any[]),
      prisma.challengeDayNote
        .findMany({ where: { challengeId: challenge.id, userId: me.id }, orderBy: { day: "asc" } })
        .catch(() => [] as any[]), // tolerate a not-yet-migrated DB -> empty
    ]);

    // Top LEADERBOARD_MAX plus the caller's own row; names only for those.
    const { entries, total } = rankStandings(standings, challenge.startingCapital, me.id);
    const users = entries.length
      ? await prisma.user.findMany({ where: { id: { in: entries.map((e) => e.userId) } }, select: { id: true, name: true, username: true } })
      : [];
    const nameOf = new Map(users.map((u) => [u.id, u.name || u.username || "Trader"]));
    const leaderboard: LeaderboardEntry[] = entries.map((e) => ({ ...e, name: nameOf.get(e.userId) ?? "Trader" }));

    return ok({ challenge, milestones: challenge.milestones, leaderboard, leaderboardTotal: total, myTrades, dayNotes, isParticipant, isOwner: challenge.creatorId === me.id });
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

    // Re-activating counts against the plan's active-challenge limit exactly
    // like creating does. Without this a Free member could create A, mark it
    // completed, create B, then PATCH A back to active (audit F-12).
    if (rest.status === "active" && existing.status !== "active") {
      const limits = journalLimitsFor(me.membership);
      if (Number.isFinite(limits.maxActiveChallenges)) {
        const activeCount = await prisma.challenge.count({ where: { creatorId: me.id, status: "active" } }).catch(() => 0);
        if (activeCount >= limits.maxActiveChallenges) {
          return fail(`Free members can run ${limits.maxActiveChallenges} active challenge at a time. Upgrade to Premium for unlimited challenges.`, 403);
        }
      }
    }

    const challenge = await prisma.challenge.update({
      where: { id: params.id },
      data: {
        ...rest,
        ...(startDate !== undefined ? { startDate: new Date(startDate) } : {}),
        ...(endDate !== undefined ? { endDate: new Date(endDate) } : {}),
      },
    });

    // Publishing has to be revocable. Making a challenge private must withdraw
    // everything it published - and NOT only the owner's rows: participants'
    // "Joined <title>" and milestone rows embed the challenge title too, so they
    // are revoked by sourceId across all users (see challengeActivityWhere).
    if (rest.visibility === "private" && existing.visibility !== "private") {
      await prisma.journalActivity
        .deleteMany({ where: challengeActivityWhere(challenge.id) })
        .then(() => broadcastEvent(userChannel(me.id), "journal_activity", {}))
        .catch(() => {}); // best-effort - never blocks the challenge update
    }

    if (rest.status === "completed" && existing.status !== "completed" && challenge.visibility !== "private") {
      prisma.journalActivity
        .create({ data: { userId: me.id, ...activityForChallengeCompleted(challenge.title), ...challengeActivitySource(challenge.id) } })
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

    const removed = await prisma.challenge.deleteMany({ where: { id: params.id, creatorId: me.id } });
    // Only revoke if we actually owned and deleted it - deleteMany reports 0 for
    // someone else's challenge, and that must not let a caller wipe the activity
    // rows of a challenge they don't own.
    if (removed.count > 0) {
      await prisma.journalActivity
        .deleteMany({ where: challengeActivityWhere(params.id) })
        .catch(() => {}); // best-effort - the challenge is already gone
      broadcastEvent(userChannel(me.id), "journal_activity", {});
    }
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err, "journal:challenges:delete");
  }
}
