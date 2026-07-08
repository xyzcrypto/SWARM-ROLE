import { z } from "zod";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { aiEnabled, completeText, aiErrorMessage } from "@/lib/ai";
import { aiPlanFor, AiCapacityError } from "@/lib/ai/gateway";
import { checkDailyLimit, dailyLimitMessage } from "@/lib/ai/limits";
import { buildWhyMattersPrompt, buildNewsDigestPrompt, buildNewsBriefingPrompt, buildHinglishPrompt } from "@/lib/ai-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  title: z.string().trim().min(4).max(300),
  summary: z.string().trim().max(1200).optional().default(""),
  // "why" = a 2-sentence take; "digest" = a fuller paragraph; "briefing" = a full
  // article-length on-site read; "hinglish" = translate a supplied briefing to Hinglish.
  mode: z.enum(["why", "digest", "briefing", "hinglish"]).optional().default("why"),
  // For mode "hinglish": the already-generated English briefing to translate.
  text: z.string().trim().max(6000).optional().default(""),
});

// POST /api/ai/why-matters - an AI take on a news story: a short "why this
// matters" (default) or a fuller on-site "digest" summary.
// Logged-in only + rate-limited; graceful 503 when AI is off.
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in to use XYZ AI.", 401);
    if (!aiEnabled) return fail("XYZ AI is not configured yet.", 503);

    const { success } = await rateLimit("ai", me.id);
    if (!success) return fail("You're going too fast. Take a breath.", 429);

    const plan = aiPlanFor(me);
    const lim = await checkDailyLimit(me.id, plan);
    if (!lim.allowed) return fail(dailyLimitMessage(lim, plan), 429);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.", 400);

    const { title, summary, mode } = parsed.data;
    if (mode === "hinglish" && !parsed.data.text) return fail("Nothing to translate.", 400);
    const prompt =
      mode === "hinglish" ? buildHinglishPrompt(parsed.data.text)
      : mode === "briefing" ? buildNewsBriefingPrompt(title, summary)
      : mode === "digest" ? buildNewsDigestPrompt(title, summary)
      : buildWhyMattersPrompt(title, summary);
    const text = await completeText({
      task: mode === "why" ? "why" : "digest",
      prompt,
      maxTokens: mode === "briefing" ? 1400 : mode === "hinglish" ? 1500 : mode === "digest" ? 320 : 160,
      ctx: { userId: me.id, plan },
    });
    if (!text) return fail("Couldn't generate that right now. Please try again.", 502);
    return ok({ text });
  } catch (err) {
    if (err instanceof AiCapacityError) return fail(aiErrorMessage(err), 503);
    return handleError(err, "ai:why-matters");
  }
}
