import { z } from "zod";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { aiEnabled, completeText } from "@/lib/ai";
import { translationOrNull } from "@shared/utils/translation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ text: z.string().trim().min(1).max(500) });

const SYSTEM =
  "You convert a chat message between English and Hinglish. Follow these steps:\n" +
  "1. Detect the language. 'Hinglish' = Hindi/Urdu words written in Roman/Latin letters " +
  "(e.g. 'bhai kya kar rahe ho', 'paisa laga do'). Plain English = normal English sentences.\n" +
  "2. If the message is ENGLISH -> rewrite it in natural Hinglish (romanized Hindi, casual chat style).\n" +
  "3. If the message is HINGLISH or Hindi -> rewrite it in clear, natural ENGLISH.\n" +
  "HARD RULE: the output language MUST be different from the input. Never return English for " +
  "an English input, and never return Hinglish for a Hinglish input.\n" +
  "Keep @mentions, $TICKERS, emojis, numbers and URLs exactly as-is. " +
  "Return ONLY the converted sentence - no quotes, no explanations, no language labels.\n\n" +
  "Examples:\n" +
  "Input: 'When is the next airdrop?'  Output: 'Agla airdrop kab hai?'\n" +
  "Input: 'Bhai market abhi pump ho raha hai'  Output: 'Bro the market is pumping right now'\n" +
  "Input: 'gm everyone, big day today'  Output: 'gm sabko, aaj bada din hai'";

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
    // The model is told to strip wrappers and never echo the input; it mostly
    // obeys. When it doesn't, an echo shown as a "translation" looks like the
    // button is broken - so a non-answer is reported as one.
    const clean = translationOrNull(text, parsed.data.text);
    if (!clean) return fail("Couldn't translate that. Please try again.", 502);

    return ok({ text: clean });
  } catch (err) {
    return handleError(err, "chat:translate");
  }
}
