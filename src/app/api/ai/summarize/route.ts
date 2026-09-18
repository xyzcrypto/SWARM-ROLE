import { z } from "zod";
import { NOT_TRASHED } from "@modules/research/lib/post-visibility";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ok, fail, handleError, requirePermission, isCuid } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { aiEnabled } from "@/lib/ai";
import { summarize } from "@/lib/ai-tasks";

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

const bodySchema = z.object({ postId: z.string() });

// POST /api/ai/summarize - (re)generate a post's AI TL;DR on demand. Admin only;
// useful to backfill summaries for posts published before this feature.
export async function POST(req: Request) {
  try {
    const actor = await requirePermission("post:publish");
    if (!actor) return fail("Forbidden", 403);
    if (!aiEnabled) return fail("XYZ AI is not configured yet.", 503);

    const { success } = await rateLimit("admin", clientIp(req));
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success || !isCuid(parsed.data.postId)) return fail("Invalid input.", 400);

    const post = await prisma.post.findFirst({
      where: { id: parsed.data.postId, ...NOT_TRASHED },
      select: { id: true, slug: true, title: true, content: true, premium: true },
    });
    if (!post) return fail("Post not found.", 404);
    // TL;DR is generated for FREE articles only (never tease premium content).
    if (post.premium) return fail("TL;DR is only generated for free articles.", 400);

    const summary = await summarize(post.title, post.content);
    if (!summary) return fail("Couldn't generate a summary. Please try again.", 502);

    await prisma.post.update({ where: { id: post.id }, data: { summary } });
    revalidatePath(`/research/${post.slug}`);
    return ok({ summary });
  } catch (err) {
    return handleError(err, "ai:summarize");
  }
}
