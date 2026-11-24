import { z } from "zod";
import { fail, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { answerLive, blurLive, joinLive, myLiveState } from "@modules/academy/lib/live";
import { academyError, json, PRIVATE } from "@modules/academy/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/academy/live/:id/me - your seat (joined, score, rank, answers) plus
// the server's clock, which the arena uses to line its timers up with the
// server's. Rejoining after a disconnect is just this call.
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const me = await getSessionUser();
    const { id } = await params;
    if (!me) return json({ serverNow: Date.now(), userId: null, joined: false, score: 0, correct: 0, rank: null, answers: [], guest: true }, PRIVATE);
    return json(await myLiveState(id, me.id), PRIVATE);
  } catch (err) {
    return academyError(err, "academy:live:me");
  }
}

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("join") }),
  z.object({ action: z.literal("answer"), index: z.number().int().min(0).max(100), choice: z.number().int().min(-1).max(3) }),
  // The player left the tab while a question was open (anti-cheat signal for staff).
  z.object({ action: z.literal("blur"), index: z.number().int().min(0).max(100) }),
]);

// POST /api/academy/live/:id/me - join, or answer the open question. One answer
// per question (primary key), timed by the server, scored on the reveal.
export async function POST(req: Request, { params }: Ctx) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Log in to join the live quiz.", 401);
    const { success } = await rateLimit("academy", me.id);
    if (!success) return fail("Slow down a little.", 429);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Invalid request.", 400);
    const { id } = await params;
    if (parsed.data.action === "join") return json(await joinLive(id, me.id), PRIVATE);
    if (parsed.data.action === "blur") return json(await blurLive(id, me.id, parsed.data.index), PRIVATE);
    return json(await answerLive(id, me.id, parsed.data.index, parsed.data.choice), PRIVATE);
  } catch (err) {
    return academyError(err, "academy:live:post");
  }
}
