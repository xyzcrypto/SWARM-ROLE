import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { aiEnabled, streamAssistant, type AiMessage } from "@/lib/ai";
import { buildAssistantSystemPrompt, type GroundingPost } from "@/lib/ai-ground";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Keep the request bounded: only the tail of the conversation is sent to the
// model (older turns rarely matter for a research Q&A and only cost tokens).
const MAX_TURNS = 12;

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(4000),
      })
    )
    .min(1, "Ask a question to start.")
    .max(40),
});

// POST /api/ai/assistant — streamed answer from "XYZ AI", grounded in the site's
// published research. Premium-gated (admins always allowed). Streams text/plain
// deltas the client appends live.
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in to use XYZ AI.", 401);

    // Premium feature: only Premium members (and staff/admins) may use it.
    const allowed = me.membership === "Premium" || me.isSuperAdmin;
    if (!allowed) return fail("XYZ AI is a Premium feature. Upgrade to unlock it.", 403);

    if (!aiEnabled) return fail("XYZ AI is not configured yet. Please check back soon.", 503);

    const { success } = await rateLimit("ai", me.id);
    if (!success) return fail("You're sending messages too fast. Take a breath.", 429);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid request.", 400);
    }

    const history: AiMessage[] = parsed.data.messages.slice(-MAX_TURNS);
    const lastUser = [...history].reverse().find((m) => m.role === "user");
    if (!lastUser) return fail("Ask a question to start.", 400);

    // Grounding corpus: latest published research (title/excerpt/body). Only
    // Premium/admin reach this route, so including premium bodies is safe.
    const posts = (await prisma.post
      .findMany({
        where: { published: true },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { title: true, slug: true, excerpt: true, content: true, premium: true },
      })
      .catch(() => [])) as GroundingPost[];

    const system = buildAssistantSystemPrompt(posts, lastUser.content);

    const stream = streamAssistant({ system, messages: history });
    if (!stream) return fail("XYZ AI is not configured yet. Please check back soon.", 503);

    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta" &&
              event.delta.text
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
        } catch (err) {
          // Mid-stream failure: surface a short line rather than a silent cut.
          console.error("[ai:assistant] stream error", err);
          controller.enqueue(
            encoder.encode("\n\n_XYZ AI ran into an issue finishing that answer. Please try again._")
          );
        } finally {
          controller.close();
        }
      },
      cancel() {
        // Client navigated away / aborted — stop the upstream request.
        stream.abort();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no", // don't let proxies buffer the stream
      },
    });
  } catch (err) {
    return handleError(err, "ai:assistant");
  }
}
