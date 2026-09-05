import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { aiEnabled, streamAssistant, aiErrorMessage, type AiMessage } from "@/lib/ai";
import { aiPlanFor } from "@/lib/ai/gateway";
import { checkDailyLimit, dailyLimitMessage } from "@/lib/ai/limits";
import { acquireSlot } from "@/lib/ai/concurrency";
import { buildAssistantSystemPrompt, type GroundingPost } from "@/lib/ai-ground";
import { formatLiveContext, type LiveSnapshot } from "@/lib/ai-live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Keep the request bounded: only the tail of the conversation is sent to the
// model (older turns rarely matter for a research Q&A and only cost tokens).
const MAX_TURNS = 12;

// Pull the cached market + news snapshots so the assistant can answer with
// current numbers/headlines. Best-effort with a tight timeout - if anything is
// slow or down we simply omit the live block (the answer still works).
/** How long a live-grounding fetch may delay the first token. See below. */
const LIVE_TIMEOUT_MS = 900;

async function fetchLiveSnapshot(origin: string): Promise<LiveSnapshot> {
  const get = async (path: string) => {
    const ctrl = new AbortController();
    // 1800ms -> 900ms. This is a hard ceiling on how long optional context may
    // hold up the answer, and it is paid on EVERY message. The three routes
    // behind it are all edge-cached and answer in tens of milliseconds when
    // warm, so the old budget only ever bought something on a cold cache - and
    // in exactly that case the block it produces is the least useful, because a
    // cold route is usually a route that is failing. Dropping the block costs a
    // sentence of market colour; waiting nearly two seconds costs the reader.
    const timer = setTimeout(() => ctrl.abort(), LIVE_TIMEOUT_MS);
    try {
      const res = await fetch(`${origin}${path}`, { signal: ctrl.signal, cache: "no-store" });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };
  const [global, coins, news] = await Promise.all([
    get("/api/markets/global"),
    get("/api/markets/coins"),
    get("/api/news?pageSize=6"),
  ]);
  return {
    global: global ?? null,
    coins: Array.isArray(coins?.list)
      ? coins.list.slice(0, 8).map((c: { symbol?: string; price?: number; change24h?: number }) => ({
          symbol: String(c.symbol ?? ""),
          price: Number(c.price) || 0,
          change24h: Number(c.change24h) || 0,
        }))
      : [],
    headlines: Array.isArray(news?.items)
      ? news.items.slice(0, 6).map((i: { title?: string; source?: string; category?: string }) => ({
          title: String(i.title ?? ""),
          source: String(i.source ?? ""),
          category: i.category ? String(i.category) : undefined,
        }))
      : [],
  };
}

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

// POST /api/ai/assistant - streamed answer from "XYZ AI", grounded in the site's
// published research. Premium-gated (admins always allowed). Streams text/plain
// deltas the client appends live.
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in to use XYZ AI.", 401);

    if (!aiEnabled) return fail("XYZ AI is not configured yet. Please check back soon.", 503);

    const { success } = await rateLimit("ai", me.id);
    if (!success) return fail("You're sending messages too fast. Take a breath.", 429);

    const plan = aiPlanFor(me);
    const lim = await checkDailyLimit(me.id, plan);
    // Report the remaining budget on every answer so the client can warn the
    // member *before* they hit the wall. Headers rather than a separate GET:
    // the widget learns the number from the request it was already making, so
    // showing a quota costs no extra round trip and adds no polled route.
    // `remaining` here is the count *before* this request is spent.
    const quotaHeaders = {
      "X-Ai-Remaining": String(Math.max(0, lim.remaining - (lim.allowed ? 1 : 0))),
      "X-Ai-Limit": String(lim.limit),
      "X-Ai-Plan": plan,
    };
    if (!lim.allowed) {
      return NextResponse.json({ error: dailyLimitMessage(lim, plan) }, { status: 429, headers: quotaHeaders });
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid request.", 400);
    }

    const history: AiMessage[] = parsed.data.messages.slice(-MAX_TURNS);
    const lastUser = [...history].reverse().find((m) => m.role === "user");
    if (!lastUser) return fail("Ask a question to start.", 400);

    // Caps in-flight AI requests per member (abuse/cost guard; fail-open w/o
    // Redis). The cap is 2, not 1 - `MAX_CONCURRENT` in concurrency.ts - which
    // is deliberate, because a member with the site open in two tabs is a
    // normal thing and not abuse. The message used to say "one at a time",
    // which described neither the code nor what a reader hitting it had done.
    const slot = await acquireSlot(me.id);
    if (!slot) return fail("Too many XYZ AI requests at once - let one finish first.", 429);

    // Grounding corpus: latest published research. The assistant is open to all
    // logged-in members (incl. free), so **premium article bodies must never enter
    // the prompt** - a free user could otherwise ask the model to reproduce paid
    // content. For premium posts we pass only the public title + excerpt (already
    // shown on cards); free posts contribute their body.
    // ⚠️ These two run TOGETHER, and that is the point.
    //
    // They used to be two sequential `await`s: the research query, and then
    // three self-origin HTTP round trips for the live snapshot. Neither needs
    // the other's result, so the second was waiting on the first for nothing -
    // and every millisecond here is time-to-first-token, before the model has
    // even been called. The assistant streams correctly; what made it feel slow
    // was everything queued up in front of the stream.
    const origin = new URL(req.url).origin;
    const [rows, live] = await Promise.all([
      prisma.post
        .findMany({
          where: { published: true },
          orderBy: { createdAt: "desc" },
          take: 30,
          select: { title: true, slug: true, excerpt: true, content: true, premium: true },
        })
        .catch(() => []),
      // Live market + news grounding. Best-effort by design: `formatLiveContext`
      // renders nothing for an empty snapshot and the answer is still correct
      // without it, so this must never be the reason a reply is late.
      fetchLiveSnapshot(origin).catch(() => ({} as LiveSnapshot)),
    ]);

    const posts: GroundingPost[] = rows.map((p) => ({
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      premium: p.premium,
      content: p.premium ? "" : p.content, // redact premium bodies from the corpus
    }));

    const system = buildAssistantSystemPrompt(posts, lastUser.content, formatLiveContext(live));

    const stream = streamAssistant({
      system,
      messages: history,
      ctx: { userId: me.id, plan: aiPlanFor(me), isAdmin: me.isSuperAdmin },
    });
    if (!stream) {
      await slot.release();
      return fail("XYZ AI is not configured yet. Please check back soon.", 503);
    }

    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          // `stream` is a provider-agnostic async iterable of text deltas.
          for await (const text of stream) {
            if (text) controller.enqueue(encoder.encode(text));
          }
        } catch (err) {
          // Mid-stream failure: surface a specific reason rather than a silent cut.
          console.error("[ai:assistant] stream error", err);
          controller.enqueue(encoder.encode(`\n\n_${aiErrorMessage(err)}_`));
        } finally {
          await slot.release(); // free the concurrency slot when the answer ends
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no", // don't let proxies buffer the stream
        ...quotaHeaders,
      },
    });
  } catch (err) {
    return handleError(err, "ai:assistant");
  }
}
