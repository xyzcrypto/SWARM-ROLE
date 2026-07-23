import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser, isCuid } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { deriveStatus, realizedPnl, type Fill } from "@/lib/journal";
import { broadcastEvent, userChannel } from "@/lib/realtime";
import { activityForTradeClosed } from "@/lib/journal-activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fillSchema = z.object({
  kind: z.enum(["entry", "exit"]),
  price: z.number().positive(),
  size: z.number().positive(),
  fee: z.number().min(0).optional().default(0),
  executedAt: z.number().finite().optional(),
});

const patchSchema = z.object({
  side: z.enum(["long", "short"]).optional(),
  type: z.enum(["spot", "futures", "perp", "custom"]).optional(),
  status: z.enum(["open", "closed", "partial", "canceled", "invalid"]).optional(),
  platformId: z.string().max(60).nullable().optional(),
  leverage: z.number().positive().max(200).optional(),
  stopLoss: z.number().positive().nullable().optional(),
  takeProfit: z.number().positive().nullable().optional(),
  setup: z.string().max(60).nullable().optional(),
  marketCondition: z.string().max(60).nullable().optional(),
  session: z.string().max(60).nullable().optional(),
  timeframe: z.string().max(60).nullable().optional(),
  assetCategory: z.string().max(60).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(24)).max(10).optional(),
  emotions: z.array(z.string().trim().min(1).max(24)).max(10).optional(),
  mistakes: z.array(z.string().trim().min(1).max(24)).max(10).optional(),
  lessons: z.string().max(2000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  screenshots: z.array(z.string().url().max(800)).max(10).optional(),
  visibility: z.enum(["private", "public", "anonymous"]).optional(),
  addFills: z.array(fillSchema).max(20).optional(),
});

// PATCH /api/journal/trades/[id] - edit a trade's fields and/or append new
// fills (scaling in/out, closing). Writes a TradeRevision capturing the diff.
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    if (!isCuid(params.id)) return fail("Invalid trade id.", 400);
    const { success } = await rateLimit("journal", me.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const existing = await prisma.trade.findUnique({ where: { id: params.id }, include: { fills: true } });
    if (!existing || existing.userId !== me.id) return fail("Not found.", 404);

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.", 400);
    const { addFills, ...fields } = parsed.data;

    const diff: Record<string, { from: any; to: any }> = {};
    for (const [key, value] of Object.entries(fields)) {
      const before = (existing as any)[key];
      if (value !== undefined && JSON.stringify(before) !== JSON.stringify(value)) {
        diff[key] = { from: before, to: value };
      }
    }
    if (addFills?.length) diff.fills = { from: existing.fills.length, to: existing.fills.length + addFills.length };

    const allFills: Fill[] = [
      ...existing.fills.map((f) => ({ kind: f.kind as "entry" | "exit", price: f.price, size: f.size, fee: f.fee })),
      ...(addFills ?? []).map((f) => ({ kind: f.kind, price: f.price, size: f.size, fee: f.fee ?? 0 })),
    ];
    const autoStatus = deriveStatus(allFills);
    const nextStatus = fields.status ?? (addFills?.length ? autoStatus : existing.status);

    const trade = await prisma.trade.update({
      where: { id: params.id },
      data: {
        ...fields,
        status: nextStatus,
        ...(addFills?.length
          ? {
              fills: {
                create: addFills.map((f) => ({
                  kind: f.kind,
                  price: f.price,
                  size: f.size,
                  fee: f.fee,
                  executedAt: f.executedAt ? new Date(f.executedAt) : new Date(),
                })),
              },
            }
          : {}),
      },
      include: { fills: { orderBy: { executedAt: "asc" } } },
    });

    if (Object.keys(diff).length > 0) {
      await prisma.tradeRevision
        .create({ data: { tradeId: params.id, diff, editedBy: me.id } })
        .catch(() => {}); // best-effort - never block the update on history logging
    }

    broadcastEvent(userChannel(me.id), "journal_trade", { id: trade.id });

    const effectiveVisibility = fields.visibility ?? existing.visibility;
    if (nextStatus === "closed" && existing.status !== "closed" && effectiveVisibility === "public") {
      const tradeFills = trade.fills.map((f) => ({ kind: f.kind as "entry" | "exit", price: f.price, size: f.size, fee: f.fee }));
      const win = realizedPnl(trade.side, tradeFills) >= 0;
      prisma.journalActivity
        .create({ data: { userId: me.id, ...activityForTradeClosed(trade.symbol, trade.side, win) } })
        .then(() => broadcastEvent(userChannel(me.id), "journal_activity", {}))
        .catch(() => {}); // best-effort - never blocks the trade update
    }

    return ok({ trade });
  } catch (err) {
    return handleError(err, "journal:trades:patch");
  }
}

// DELETE /api/journal/trades/[id] - remove a trade (cascades fills/revisions).
export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    if (!isCuid(params.id)) return fail("Invalid trade id.", 400);
    await prisma.trade.deleteMany({ where: { id: params.id, userId: me.id } });
    broadcastEvent(userChannel(me.id), "journal_trade", { id: params.id, deleted: true });
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err, "journal:trades:delete");
  }
}
