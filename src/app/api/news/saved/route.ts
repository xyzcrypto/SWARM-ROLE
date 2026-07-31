import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { categorize, sentiment, impact, relatedTokens, type NewsItem } from "@/lib/news";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rebuild a full NewsItem from a stored row so the Saved tab renders identically
// to the live feed (classification is pure + recomputed from title + summary).
function hydrate(r: any): NewsItem {
  const text = `${r.title} ${r.summary ?? ""}`;
  const { primary, all } = categorize(text);
  return {
    id: r.url,
    title: r.title,
    url: r.url,
    summary: r.summary ?? "",
    source: r.source ?? "Saved",
    sourceIcon: null,
    image: r.image ?? null,
    publishedAt: r.publishedAt ? new Date(r.publishedAt).getTime() : 0,
    category: r.category ?? primary,
    categories: all,
    sentiment: sentiment(text),
    impact: impact(text),
    tokens: relatedTokens(text),
  };
}

// GET /api/news/saved - the signed-in member's saved stories (newest first).
export async function GET() {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    const rows = await prisma.savedStory
      .findMany({ where: { userId: me.id }, orderBy: { createdAt: "desc" }, take: 300 })
      .catch(() => [] as any[]); // tolerate a not-yet-migrated DB → empty
    return ok({ items: rows.map(hydrate) });
  } catch (err) {
    return handleError(err, "news:saved:get");
  }
}

const saveSchema = z.object({
  url: z.string().url().max(600),
  title: z.string().trim().min(1).max(400),
  summary: z.string().max(2000).optional().default(""),
  source: z.string().max(120).optional().default(""),
  image: z.string().url().max(800).nullable().optional(),
  category: z.string().max(60).optional().default(""),
  publishedAt: z.number().finite().optional(),
});

// POST /api/news/saved - save (upsert) a story for the member.
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in to save stories.", 401);
    const { success } = await rateLimit("like", me.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const parsed = saveSchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.", 400);
    const s = parsed.data;
    const data = {
      title: s.title,
      summary: s.summary || null,
      source: s.source || null,
      image: s.image || null,
      category: s.category || null,
      publishedAt: s.publishedAt ? new Date(s.publishedAt) : null,
    };
    await prisma.savedStory.upsert({
      where: { userId_url: { userId: me.id, url: s.url } },
      create: { userId: me.id, url: s.url, ...data },
      update: data,
    });
    return ok({ saved: true });
  } catch (err) {
    return handleError(err, "news:saved:post");
  }
}

// DELETE /api/news/saved?url=… - remove a saved story.
export async function DELETE(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    // Same bucket as POST above. The save/unsave pair is one toggle to a user,
    // so throttling only the write half left the other half free to churn.
    const { success } = await rateLimit("like", me.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const url = new URL(req.url).searchParams.get("url") || "";
    if (!url) return fail("Missing url.", 400);
    await prisma.savedStory.deleteMany({ where: { userId: me.id, url } });
    return ok({ saved: false });
  } catch (err) {
    return handleError(err, "news:saved:delete");
  }
}
