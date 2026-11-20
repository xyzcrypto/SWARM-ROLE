import { z } from "zod";
import { fail, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { answerQuiz, finishQuiz, getQuizState, nextQuestion } from "@modules/academy/lib/quiz";
import { academyError, json, PRIVATE } from "@modules/academy/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/academy/quiz/:id - resume state. Answered questions come with their
// explanation; the open one never carries its answer.
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    const { id } = await params;
    return json(await getQuizState(me.id, id), PRIVATE);
  } catch (err) {
    return academyError(err, "academy:quiz:get");
  }
}

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("answer"), index: z.number().int().min(0).max(50), choice: z.number().int().min(-1).max(3) }),
  z.object({ action: z.literal("next") }),
  z.object({ action: z.literal("finish") }),
]);

// POST /api/academy/quiz/:id - answer | next | finish. The browser sends only
// which option was tapped; correctness, time and points are all decided here.
export async function POST(req: Request, { params }: Ctx) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    const { success } = await rateLimit("academy", me.id);
    if (!success) return fail("Slow down a little.", 429);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Invalid request.", 400);
    const { id } = await params;
    const body = parsed.data;
    if (body.action === "answer") return json(await answerQuiz(me.id, id, body.index, body.choice), PRIVATE);
    if (body.action === "next") return json(await nextQuestion(me.id, id), PRIVATE);
    return json(await finishQuiz(me.id, id), PRIVATE);
  } catch (err) {
    return academyError(err, "academy:quiz:post");
  }
}
