import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { DAILY_GOALS } from "@modules/academy/lib/engine";
import { getMe } from "@modules/academy/lib/me";
import { academyError, json, PRIVATE } from "@modules/academy/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/academy/me - the signed-in member's dashboard: XP, level, streak,
// standing on all four boards, weekly XP, achievements, certificates, progress
// and what to learn next. Personal, never cached.
export async function GET() {
  try {
    const me = await getSessionUser();
    if (!me) {
      const res = fail("Please log in.", 401);
      res.headers.set("Cache-Control", PRIVATE);
      return res;
    }
    return json(await getMe(me.id), PRIVATE);
  } catch (err) {
    return academyError(err, "academy:me");
  }
}

const goalSchema = z.object({ dailyGoal: z.number().int().refine((n) => (DAILY_GOALS as readonly number[]).includes(n), "Pick one of the daily goals.") });

// PATCH /api/academy/me - set the daily XP goal (one of DAILY_GOALS).
export async function PATCH(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    const { success } = await rateLimit("academy", me.id);
    if (!success) return fail("Slow down a little.", 429);
    const parsed = goalSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Pick one of the daily goals.", 400);
    await prisma.academyProfile.upsert({ where: { userId: me.id }, create: { userId: me.id, dailyGoal: parsed.data.dailyGoal }, update: { dailyGoal: parsed.data.dailyGoal } });
    return json({ dailyGoal: parsed.data.dailyGoal }, PRIVATE);
  } catch (err) {
    return academyError(err, "academy:me:goal");
  }
}
