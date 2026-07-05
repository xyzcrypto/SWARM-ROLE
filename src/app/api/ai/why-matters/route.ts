import { z } from "zod";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { aiEnabled, completeText, AI_MODEL_FAST } from "@/lib/ai";
import { buildWhyMattersPrompt } from "@/lib/ai-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  title: z.string().trim().min(4).max(300),
  summary: z.string().trim().max(1200).optional().default(""),
});

// POST /api/ai/why-matters — a short AI "why this matters" take on a news story.
// Logged-in only + rate-limited; graceful 503 when AI is off.
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in to use XYZ AI.", 401);
    if (!aiEnabled) return fail("XYZ AI is not configured yet.", 503);

    const { success } = await rateLimit("ai", me.id);
    if (!success) return fail("You're going too fast. Take a breath.", 429);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.", 400);

    const text = await completeText({
      model: AI_MODEL_FAST,
      prompt: buildWhyMattersPrompt(parsed.data.title, parsed.data.summary),
      maxTokens: 160,
    });
    if (!text) return fail("Couldn't generate that right now. Please try again.", 502);
    return ok({ text });
  } catch (err) {
    return handleError(err, "ai:why-matters");
  }
}
