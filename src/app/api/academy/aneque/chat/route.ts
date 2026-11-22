import { z } from "zod";
import { fail, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { aiEnabled, completeTextWithMeta } from "@/lib/ai";
import { aiPlanFor } from "@/lib/ai/gateway";
import { checkDailyLimit, dailyLimitMessage } from "@/lib/ai/limits";
import { acquireSlot } from "@/lib/ai/concurrency";
import { anequeSystemPrompt, cleanReply } from "@modules/academy/lib/aneque";
import { learnerSnapshot, lessonNotes } from "@modules/academy/lib/aneque-knowledge";
import { academyError, json, PRIVATE } from "@modules/academy/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) }))
    .min(1)
    .max(24),
  context: z
    .object({
      page: z.string().max(120).optional(),
      lesson: z.string().max(200).nullish(),
      topic: z.string().max(120).nullish(),
      questionOpen: z.boolean().optional(),
      question: z.string().max(500).nullish(),
      language: z.enum(["english", "hinglish"]).optional(),
    })
    .default({}),
});

// POST /api/academy/aneque/chat - one spoken turn with AneQue. Same AI
// gateway, plans and daily limits as XYZ AI; short answers because they are
// read aloud. While a quiz question is open the prompt forbids giving it away.
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Sign in to talk with AneQue.", 401);
    if (!aiEnabled) return fail("AneQue's live talk isn't available right now.", 503);
    const { success } = await rateLimit("ai", me.id);
    if (!success) return fail("One moment, I'm still thinking about the last one.", 429);
    const plan = aiPlanFor(me);
    const lim = await checkDailyLimit(me.id, plan);
    if (!lim.allowed) return fail(dailyLimitMessage(lim, plan), 429);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Invalid request.", 400);
    const turns = parsed.data.messages.slice(-12);
    if (turns[turns.length - 1]?.role !== "user") return fail("Say something first.", 400);
    const slot = await acquireSlot(me.id);
    if (!slot) return fail("I'm answering another question. Give me a second.", 429);
    try {
      // Ground the answer: the lesson passages that match what was asked
      // (with the previous question too, so a follow-up still finds them) and
      // the learner's own level and weak topics. Both are built here on the
      // server; the client cannot inject either.
      const ctx = parsed.data.context;
      const lastUser = turns[turns.length - 1].content;
      const prevUser = [...turns].reverse().find((m, i) => i > 0 && m.role === "user")?.content ?? "";
      const [notes, learner] = await Promise.all([
        lessonNotes(`${lastUser} ${lastUser} ${prevUser} ${ctx.topic ?? ""} ${ctx.lesson ?? ""}`, { lesson: ctx.lesson, topic: ctx.topic }),
        learnerSnapshot(me.id),
      ]);
      const system = await anequeSystemPrompt({ ...ctx, notes, learner });
      const prompt = turns.map((m) => `${m.role === "user" ? "Learner" : "AneQue"}: ${m.content}`).join("\n") + "\nAneQue:";
      const res = await completeTextWithMeta({
        task: "assistant",
        system,
        prompt,
        maxTokens: 320,
        ctx: { userId: me.id, plan, isAdmin: me.isSuperAdmin },
      });
      const text = cleanReply(res?.text ?? "", res?.meta.finishReason === "length");
      if (!text) return fail("I lost my train of thought. Ask me again?", 502);
      return json({ text }, PRIVATE);
    } finally {
      await slot.release();
    }
  } catch (err) {
    return academyError(err, "academy:aneque:chat");
  }
}
