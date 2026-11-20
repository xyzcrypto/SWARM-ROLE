import { z } from "zod";
import { fail, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { QUIZ_MODES, DIFFICULTIES } from "@modules/academy/lib/config";
import { startQuiz } from "@modules/academy/lib/quiz";
import { academyError, json, PRIVATE } from "@modules/academy/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  mode: z.enum(QUIZ_MODES as [string, ...string[]]),
  category: z.string().max(80).nullish(),
  moduleId: z.string().max(40).nullish(),
  difficulty: z.enum(["mixed", ...DIFFICULTIES] as [string, ...string[]]).optional(),
  count: z.number().int().optional(),
  challenge: z.string().max(40).nullish(),
});

// POST /api/academy/quiz - start (or resume) a quiz. The server picks the
// questions and their option order and keeps both; the browser gets an id.
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Log in to play and earn XP.", 401);
    const { success } = await rateLimit("academyStart", me.id);
    if (!success) return fail("Too many quizzes started. Take a breath and try again in a minute.", 429);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Invalid quiz settings.", 400);
    return json(await startQuiz(me.id, parsed.data as Parameters<typeof startQuiz>[1]), PRIVATE);
  } catch (err) {
    return academyError(err, "academy:quiz:start");
  }
}
