import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { journalLimitsFor } from "@/lib/journal-limits";
import { broadcastEvent, userChannel } from "@/lib/realtime";
import { activityForChallengeCreated } from "@/lib/journal-activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/journal/challenges - "mine" (created or joined) + "discover" (public/
// community, active, not yet joined) for the signed-in member.
export async function GET() {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);

    const [mine, discover] = await Promise.all([
      prisma.challenge
        .findMany({
          where: { OR: [{ creatorId: me.id }, { participants: { some: { userId: me.id } } }] },
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { participants: true, trades: true } } },
        })
        .catch(() => [] as any[]),
      prisma.challenge
        .findMany({
          where: {
            visibility: { in: ["public", "community"] },
            status: "active",
            NOT: { participants: { some: { userId: me.id } } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { _count: { select: { participants: true } } },
        })
        .catch(() => [] as any[]),
    ]);

    return ok({ mine, discover });
  } catch (err) {
    return handleError(err, "journal:challenges:get");
  }
}

const createSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().max(2000).optional(),
    startDate: z.number().finite(),
    endDate: z.number().finite(),
    startingCapital: z.number().positive().max(1_000_000_000),
    targetCapital: z.number().positive().optional(),
    maxRiskPerTradePct: z.number().positive().max(100).optional(),
    maxDailyLossPct: z.number().positive().max(100).optional(),
    maxWeeklyDrawdownPct: z.number().positive().max(100).optional(),
    customRules: z.array(z.string().trim().min(1).max(200)).max(20).optional().default([]),
    visibility: z.enum(["private", "public", "community"]).optional().default("private"),
  })
  .refine((d) => d.endDate > d.startDate, { message: "End date must be after the start date.", path: ["endDate"] });

// POST /api/journal/challenges - create a challenge; the creator is auto-added
// as an "owner" participant so leaderboard/detail queries stay uniform.
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in to create a challenge.", 401);
    const { success } = await rateLimit("journal", me.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.", 400);
    const d = parsed.data;

    const limits = journalLimitsFor(me.membership);
    if (Number.isFinite(limits.maxActiveChallenges)) {
      const activeCount = await prisma.challenge.count({ where: { creatorId: me.id, status: "active" } }).catch(() => 0);
      if (activeCount >= limits.maxActiveChallenges) {
        return fail(
          `Free members can run ${limits.maxActiveChallenges} active challenge at a time. Upgrade to Premium for unlimited challenges.`,
          403
        );
      }
    }

    const challenge = await prisma.challenge.create({
      data: {
        creatorId: me.id,
        title: d.title,
        description: d.description || null,
        startDate: new Date(d.startDate),
        endDate: new Date(d.endDate),
        startingCapital: d.startingCapital,
        targetCapital: d.targetCapital,
        maxRiskPerTradePct: d.maxRiskPerTradePct,
        maxDailyLossPct: d.maxDailyLossPct,
        maxWeeklyDrawdownPct: d.maxWeeklyDrawdownPct,
        customRules: d.customRules,
        visibility: d.visibility,
        participants: { create: { userId: me.id, role: "owner" } },
      },
      include: { participants: true },
    });

    if (challenge.visibility !== "private") {
      prisma.journalActivity
        .create({ data: { userId: me.id, ...activityForChallengeCreated(challenge.title) } })
        .then(() => broadcastEvent(userChannel(me.id), "journal_activity", {}))
        .catch(() => {}); // best-effort - never blocks challenge creation
    }

    return ok({ challenge }, 201);
  } catch (err) {
    return handleError(err, "journal:challenges:post");
  }
}
