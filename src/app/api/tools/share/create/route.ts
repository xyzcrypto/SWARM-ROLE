import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";

// POST /api/tools/share/create - persists a small snapshot behind a short id,
// so /tools/share/<kind>/<id> stays short instead of a long query string.
// Anonymous (no login required, same as the calculator itself) but IP
// rate-limited against abuse. Only whitelisted "kind"s are accepted, each
// with its own tight schema - never an arbitrary JSON blob from the client.
export const runtime = "nodejs";

const pointsValueSchema = z.object({
  kind: z.literal("points-value"),
  data: z.object({
    platform: z.string().trim().min(1).max(40),
    domain: z.string().trim().max(253).optional().default(""),
    sharePct: z.number().finite(),
    tokens: z.number().finite(),
    usd: z.number().finite(),
    fdv: z.number().finite(),
  }),
});

export async function POST(req: Request) {
  try {
    const { success } = await rateLimit("shareCreate", clientIp(req));
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const parsed = pointsValueSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.", 400);

    const row = await prisma.sharedCard.create({
      data: { kind: parsed.data.kind, data: parsed.data.data },
      select: { id: true },
    });

    return ok({ id: row.id }, 201);
  } catch (err) {
    return handleError(err, "tools:share:create");
  }
}
