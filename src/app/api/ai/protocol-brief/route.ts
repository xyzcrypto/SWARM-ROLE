import { z } from "zod";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { aiEnabled, completeText, aiErrorMessage } from "@/lib/ai";
import { aiPlanFor, AiCapacityError } from "@/lib/ai/gateway";
import { checkDailyLimit, dailyLimitMessage } from "@/lib/ai/limits";
import { buildProtocolBriefPrompt } from "@/lib/ai-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ⚠️ Declared, not defaulted. An AI call routinely runs longer than Vercel's
 * default function duration, and when the platform kills a function the caller
 * gets an opaque 504 instead of the graceful error this route is written to
 * return. The gateway's own budget is capped below this on purpose, so that when
 * something fails it is OUR message that reaches the reader.
 */
export const maxDuration = 60;

const bodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.string().trim().min(1).max(40),
  metric: z.enum(["volume", "fees"]),
  total24h: z.number().finite(),
  total7d: z.number().finite(),
  change7d: z.number().finite(),
  chains: z.array(z.string().trim().max(40)).max(12).optional().default([]),
});

// POST /api/ai/protocol-brief - a short, neutral AI "take" on a DeFi protocol
// (education, not advice). Logged-in + rate-limited + daily-capped; graceful.
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

    const text = await completeText({
      task: "digest",
      prompt: buildProtocolBriefPrompt(parsed.data),
      maxTokens: 260,
      ctx: { userId: me.id, plan },
    });
    if (!text) return fail("Couldn't generate that right now. Please try again.", 502);
    return ok({ text });
  } catch (err) {
    if (err instanceof AiCapacityError) return fail(aiErrorMessage(err), 503);
    return handleError(err, "ai:protocol-brief");
  }
}
