import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/journal/trades - the signed-in member's own trades (newest first),
// with fills for P&L/stats derivation. Private by construction - always
// scoped to the caller, never another user's data.
export async function GET() {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    const trades = await prisma.trade
      .findMany({
        where: { userId: me.id },
        orderBy: { createdAt: "desc" },
        take: 1000,
        include: { fills: { orderBy: { executedAt: "asc" } } },
      })
      .catch(() => [] as any[]); // tolerate a not-yet-migrated DB -> empty
    return ok({ trades });
  } catch (err) {
    return handleError(err, "journal:trades:get");
  }
}

const fillSchema = z.object({
  kind: z.enum(["entry", "exit"]),
  price: z.number().positive(),
  size: z.number().positive(),
  fee: z.number().min(0).optional().default(0),
  executedAt: z.number().finite().optional(),
});

const createTradeSchema = z.object({
  symbol: z.string().trim().min(1).max(20),
  side: z.enum(["long", "short"]),
  type: z.enum(["spot", "futures", "perp", "custom"]).optional().default("perp"),
  platformId: z.string().max(60).optional(),
  leverage: z.number().positive().max(200).optional(),
  stopLoss: z.number().positive().optional(),
  takeProfit: z.number().positive().optional(),
  setup: z.string().max(60).optional(),
  marketCondition: z.string().max(60).optional(),
  session: z.string().max(60).optional(),
  timeframe: z.string().max(60).optional(),
  assetCategory: z.string().max(60).optional(),
  tags: z.array(z.string().trim().min(1).max(24)).max(10).optional().default([]),
  emotions: z.array(z.string().trim().min(1).max(24)).max(10).optional().default([]),
  mistakes: z.array(z.string().trim().min(1).max(24)).max(10).optional().default([]),
  lessons: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
  screenshots: z.array(z.string().url().max(800)).max(10).optional().default([]),
  visibility: z.enum(["private", "public", "anonymous"]).optional().default("private"),
  challengeId: z.string().max(60).optional(),
  fills: z.array(fillSchema).min(1).max(50),
});

// POST /api/journal/trades - create a trade with its initial fill(s).
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in to journal a trade.", 401);
    const { success } = await rateLimit("journal", me.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const parsed = createTradeSchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.", 400);
    const t = parsed.data;

    if (t.challengeId) {
      const challenge = await prisma.challenge.findUnique({
        where: { id: t.challengeId },
        include: { participants: { where: { userId: me.id } } },
      });
      if (!challenge || (challenge.creatorId !== me.id && challenge.participants.length === 0)) {
        return fail("You're not a participant of that challenge.", 403);
      }
    }

    const hasExit = t.fills.some((f) => f.kind === "exit");
    const entryTotal = t.fills.filter((f) => f.kind === "entry").reduce((s, f) => s + f.size, 0);
    const exitTotal = t.fills.filter((f) => f.kind === "exit").reduce((s, f) => s + f.size, 0);
    const status = !hasExit ? "open" : exitTotal >= entryTotal ? "closed" : "partial";

    const trade = await prisma.trade.create({
      data: {
        userId: me.id,
        symbol: t.symbol.toUpperCase(),
        side: t.side,
        type: t.type,
        status,
        platformId: t.platformId || null,
        leverage: t.leverage ?? 1,
        stopLoss: t.stopLoss,
        takeProfit: t.takeProfit,
        setup: t.setup || null,
        marketCondition: t.marketCondition || null,
        session: t.session || null,
        timeframe: t.timeframe || null,
        assetCategory: t.assetCategory || null,
        tags: t.tags,
        emotions: t.emotions,
        mistakes: t.mistakes,
        lessons: t.lessons || null,
        notes: t.notes || null,
        screenshots: t.screenshots,
        visibility: t.visibility,
        challengeId: t.challengeId || null,
        fills: {
          create: t.fills.map((f) => ({
            kind: f.kind,
            price: f.price,
            size: f.size,
            fee: f.fee,
            executedAt: f.executedAt ? new Date(f.executedAt) : new Date(),
          })),
        },
      },
      include: { fills: true },
    });
    return ok({ trade }, 201);
  } catch (err) {
    return handleError(err, "journal:trades:post");
  }
}
