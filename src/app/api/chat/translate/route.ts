import { z } from "zod";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { aiEnabled, completeText } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ text: z.string().trim().min(1).max(500) });

const SYSTEM =
  "You are a translator for a crypto community chat. If the message is in English, " +
  "translate it into natural Hinglish (Hindi written in Roman/Latin letters, the way people chat). " +
  "If the message is in Hindi or Hinglish, translate it into clear, natural English. " +
  "Keep @mentions, $TICKERS, emojis, numbers and URLs exactly as-is. " +
  "Return ONLY the translated text - no quotes, no notes, no labels.";

// POST /api/chat/translate - translate a chat message between English and
// Hinglish. Logged-in + rate-limited; graceful 503 when AI is off.
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    if (!aiEnabled) return fail("Translation is not available right now.", 503);

    const { success } = await rateLimit("ai", me.id);
    if (!success) return fail("You're going too fast. Take a breath.", 429);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.", 400);

    const text = await completeText({
      task: "summary",
      system: SYSTEM,
      prompt: parsed.data.text,
      maxTokens: 240,
      ctx: { userId: me.id },
    });
    if (!text) return fail("Couldn't translate that. Please try again.", 502);

    return ok({ text });
  } catch (err) {
    return handleError(err, "chat:translate");
  }
}
