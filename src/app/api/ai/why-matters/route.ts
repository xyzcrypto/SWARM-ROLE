import { z } from "zod";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { aiEnabled, completeTextWithMeta, streamBriefing, aiErrorMessage } from "@/lib/ai";
import { aiPlanFor, AiCapacityError } from "@/lib/ai/gateway";
import { checkDailyLimit, dailyLimitMessage } from "@/lib/ai/limits";
import { buildWhyMattersPrompt, buildNewsDigestPrompt, buildNewsBriefingPrompt, buildHinglishPrompt, buildPointsRoundupPrompt } from "@/lib/ai-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ⚠️ Declared, not defaulted. A full briefing asks the model for well over a
 * thousand tokens, which takes far longer than Vercel's DEFAULT function
 * duration - so the platform killed the request mid-generation and the caller
 * got an opaque 504, not the graceful 502 this route is written to return.
 *
 * 60s is the Hobby plan's maximum. The gateway's own budget is capped below it
 * (`MAX_COMPLETE_TIMEOUT_MS`) so that when something does go wrong, the app's
 * error message wins the race against the platform's.
 */
export const maxDuration = 60;

const bodySchema = z.object({
  title: z.string().trim().min(4).max(300),
  // ⚠️ 4000, not 1200. A roundup sends several headlines with their summaries,
  // and 1200 truncated that list MID-ITEM - the model was being asked to brief
  // on a half-sentence. A single-story excerpt never approaches this.
  summary: z.string().trim().max(4000).optional().default(""),
  // "why" = a 2-sentence take; "digest" = a fuller paragraph; "briefing" = a full
  // article-length on-site read; "hinglish" = translate a supplied briefing to Hinglish.
  // "roundup" = several headlines at once, which is a different shape of answer
  // from a single-story briefing and needs its own prompt.
  mode: z.enum(["why", "digest", "briefing", "hinglish", "roundup"]).optional().default("why"),
  // For mode "hinglish": the already-generated English briefing to translate.
  text: z.string().trim().max(6000).optional().default(""),
  /**
   * Stream the answer back as plain text instead of one JSON blob.
   *
   * ⚠️ Opt-in, so every existing caller keeps the JSON contract (and its
   * `meta`) unchanged. Only the surfaces that render progressively ask for it.
   */
  stream: z.boolean().optional().default(false),
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
      mode === "roundup" ? buildPointsRoundupPrompt(summary)
      : mode === "hinglish" ? buildHinglishPrompt(parsed.data.text)
      : mode === "briefing" ? buildNewsBriefingPrompt(title, summary)
      : mode === "digest" ? buildNewsDigestPrompt(title, summary)
      : buildWhyMattersPrompt(title, summary);
    /**
     * ── The streamed path ────────────────────────────────────────────────
     *
     * ⚠️ This is the fix for "the briefing is slow AND incomplete", which were
     * never two problems. One-shot generation forces a trade: a ceiling high
     * enough to finish is a wait long enough to feel broken, and a ceiling low
     * enough to be quick is an answer that stops mid-section. Four rounds were
     * spent moving along that curve.
     *
     * Streaming removes the trade. First words in about a second, a generous
     * ceiling because the wait no longer scales with it, and no large idle
     * response for the platform to cut at `maxDuration` - bytes are flowing the
     * whole time.
     *
     * Plain text, not SSE: the client appends deltas straight into the panel,
     * exactly as `/api/ai/assistant` already does, so there is one streaming
     * shape on this site rather than two.
     */
    if (parsed.data.stream) {
      const stream = streamBriefing({
        prompt,
        maxTokens: mode === "roundup" ? 1600 : mode === "briefing" ? 1800 : 600,
        ctx: { userId: me.id, plan },
      });
      if (!stream) return fail("XYZ AI is not configured yet.", 503);

      const encoder = new TextEncoder();
      const readable = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const delta of stream) {
              if (delta) controller.enqueue(encoder.encode(delta));
            }
          } catch (err) {
            // ⚠️ A mid-stream failure must SAY so. Closing the stream quietly
            // is indistinguishable from a finished briefing that happens to
            // end early - which is precisely the ambiguity that made the
            // earlier versions so hard to diagnose.
            console.error("[ai:why-matters] stream error", err);
            controller.enqueue(encoder.encode(`\n\n_${aiErrorMessage(err)}_`));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Accel-Buffering": "no", // proxies must not buffer, or it is not a stream
        },
      });
    }

    const first = await completeTextWithMeta({
      // A briefing is its own task so it can be ROUTED as one - see routing.ts.
      // Sharing `digest` sent a 900-word explainer to the fast model.
      task:
        mode === "briefing" || mode === "hinglish" || mode === "roundup"
          ? "briefing"
          : mode === "why"
            ? "why"
            : "digest",
      prompt,
      // ⚠️ 1400, not 2000. The briefing prompt asks for 650-900 words, which is
      // roughly 900-1250 tokens - so 2000 was never the length of the answer,
      // only the size of the window it was allowed to take. Lowering the ceiling
      // removes nothing from the output and brings the worst case inside both
      // the gateway budget and the function's 60s duration.
      maxTokens:
        mode === "briefing" ? 1400 : mode === "hinglish" ? 1500 : mode === "roundup" ? 1100 : mode === "digest" ? 320 : 160,
      ctx: { userId: me.id, plan },
    });
    if (!first) return fail("Couldn't generate that right now. Please try again.", 502);

    let { text } = first;
    const meta = first.meta;
    let continued = false;

    /**
     * ⚠️ A briefing that stopped at the ceiling gets FINISHED, not served half.
     *
     * The reader was shown a TL;DR that ended mid-sentence and nothing said why.
     * A model asked for nine sections will sometimes run past its budget; the
     * right answer is to ask it to carry on from where it stopped, not to hand
     * over a fragment and call it a briefing.
     *
     * Exactly ONE continuation. Two would be a loop with a bill attached, and if
     * one more pass is not enough the honest thing is to say it was cut short
     * rather than keep spending.
     *
     * Only for `briefing` - a "why this matters" is two sentences by design and
     * stopping at its ceiling means something else is wrong.
     */
    if ((mode === "briefing" || mode === "roundup") && meta.finishReason === "length") {
      const tail = text.slice(-600);
      const more = await completeTextWithMeta({
        task: "briefing",
        prompt:
          "Continue this briefing from exactly where it stops. Do not repeat anything already written, " +
          "do not re-introduce the story, and do not add a preamble - carry straight on, keeping the same " +
          "markdown headings and tone, and finish the remaining sections.\n\n" +
          `Headline: ${title}\n\nWritten so far (last part):\n${tail}`,
        maxTokens: 900,
        ctx: { userId: me.id, plan },
      });
      if (more?.text) {
        // A newline join rather than a bare concatenation: the model resumes at
        // a heading or a bullet far more often than mid-word.
        text = `${text}\n\n${more.text}`;
        continued = true;
      }
    }

    // ⚠️ `meta` travels with the answer. A short briefing and a truncated one
    // look identical in the text, and three attempts were made to fix this one
    // without that distinction being visible anywhere. `truncated` stays true
    // when even the continuation ran out, so the UI can say so instead of
    // presenting a fragment as finished.
    return ok({
      text,
      meta: {
        ...meta,
        continued,
        truncated: meta.finishReason === "length" && !continued,
      },
    });
  } catch (err) {
    if (err instanceof AiCapacityError) return fail(aiErrorMessage(err), 503);
    return handleError(err, "ai:why-matters");
  }
}
