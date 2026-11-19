import { z } from "zod";
import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser, getAdminSession } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import type { XPostRow } from "@modules/creators/lib/scoring";
import { canonicalTweetUrl, fetchTweet, mentionsVariational, parseTweetUrl, type Tweet } from "@modules/creators/lib/x";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The Variational X leaderboard. Posts enter by submission (the free X API
// cannot search), are checked against X's public embed data, and must mention
// Variational themselves. See src/modules/creators/lib/x.ts for why.

const STALE_MS = 6 * 3600_000; // counts older than this are refreshed lazily
const REFRESH_PER_REQUEST = 5; // bounded so one GET never fans out to hundreds of fetches

function toRow(p: any): XPostRow {
  return {
    id: p.id,
    tweetId: p.tweetId,
    url: p.url,
    authorHandle: p.authorHandle,
    authorName: p.authorName,
    authorAvatar: p.authorAvatar,
    verified: p.verified,
    text: p.text,
    tweetCreatedAt: new Date(p.tweetCreatedAt).toISOString(),
    likes: p.likes,
    replies: p.replies,
    fetchedAt: new Date(p.fetchedAt).toISOString(),
  };
}

function tweetData(t: Tweet) {
  return {
    url: canonicalTweetUrl(t.handle, t.id),
    authorHandle: t.handle,
    authorName: t.name.slice(0, 120),
    authorAvatar: t.avatar,
    verified: t.verified,
    text: t.text.slice(0, 4000),
    tweetCreatedAt: new Date(t.createdAt),
    likes: t.likes,
    replies: t.replies,
    fetchedAt: new Date(),
  };
}

/** Refresh the stalest few posts after the response is sent. Never throws. */
async function refreshStale() {
  try {
    const stale = await prisma.creatorPost.findMany({
      where: { status: "visible", fetchedAt: { lt: new Date(Date.now() - STALE_MS) } },
      orderBy: { fetchedAt: "asc" },
      take: REFRESH_PER_REQUEST,
      select: { id: true, tweetId: true },
    });
    for (const p of stale) {
      const r = await fetchTweet(p.tweetId);
      if (r.ok) {
        await prisma.creatorPost.update({ where: { id: p.id }, data: tweetData(r.tweet) });
      } else if (r.reason === "not_found") {
        // Deleted or protected on X: drop it from the board rather than keep
        // ranking counts nobody can verify.
        await prisma.creatorPost.update({ where: { id: p.id }, data: { status: "gone", fetchedAt: new Date() } });
      }
      // "unavailable": leave it; the next request retries.
    }
  } catch (err) {
    console.error("[creators:x:refresh]", err instanceof Error ? err.message : err);
  }
}

// GET /api/creators/x - every visible post; the client ranks, filters and searches.
// Identical for every visitor, so it is edge-cached publicly.
export async function GET() {
  try {
    const rows = await prisma.creatorPost.findMany({
      where: { status: "visible" },
      orderBy: { likes: "desc" },
      take: 1000,
    });
    after(refreshStale);
    return NextResponse.json(
      { posts: rows.map(toRow) },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } }
    );
  } catch (err) {
    return handleError(err, "creators:x:get");
  }
}

const submitSchema = z.object({ url: z.string().trim().min(10).max(300) });

// POST /api/creators/x - submit a post link. Members only, rate-limited per
// member and per IP, because each submission costs a fetch to X.
export async function POST(req: Request) {
  try {
    const { success } = await rateLimit("creatorSubmit", `ip:${clientIp(req)}`);
    if (!success) return fail("Too many submissions. Please try again in a few minutes.", 429);

    const me = await getSessionUser();
    if (!me) return fail("Please log in to submit a post.", 401);
    const { success: userOk } = await rateLimit("creatorSubmit", `u:${me.id}`);
    if (!userOk) return fail("Too many submissions. Please try again in a few minutes.", 429);

    const parsed = submitSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Paste a link to a post on X.", 400);
    const link = parseTweetUrl(parsed.data.url);
    if (!link) return fail("That isn't a link to a post on X. It should look like x.com/name/status/123...", 400);

    const existing = await prisma.creatorPost.findUnique({ where: { tweetId: link.id } });
    if (existing && existing.status === "hidden") return fail("This post was removed from the board by a moderator.", 409);
    if (existing && existing.status === "visible" && Date.now() - existing.fetchedAt.getTime() < 10 * 60_000) {
      return ok({ post: toRow(existing), already: true });
    }

    const r = await fetchTweet(link.id);
    if (!r.ok) {
      return r.reason === "not_found"
        ? fail("We couldn't find that post. It may be deleted or from a protected account.", 404)
        : fail("X didn't respond just now. Please try again in a minute.", 502);
    }
    if (!mentionsVariational(r.tweet)) {
      return fail("This board is for Variational posts. The post must mention Variational, tag a Variational account, or link variational.io.", 422);
    }

    const data = tweetData(r.tweet);
    const post = await prisma.creatorPost.upsert({
      where: { tweetId: r.tweet.id },
      create: { tweetId: r.tweet.id, ...data, submittedById: me.id },
      update: { ...data, status: "visible" },
    });
    return ok({ post: toRow(post), already: Boolean(existing) }, existing ? 200 : 201);
  } catch (err) {
    return handleError(err, "creators:x:post");
  }
}

// DELETE /api/creators/x?id=<post id> - admin hides a post (kept, so it cannot be re-submitted).
export async function DELETE(req: Request) {
  try {
    const { success } = await rateLimit("admin", clientIp(req));
    if (!success) return fail("Too many requests.", 429);
    const admin = await getAdminSession();
    if (!admin) return fail("Forbidden.", 403);
    const id = new URL(req.url).searchParams.get("id") || "";
    if (!id) return fail("Missing id.", 400);
    await prisma.creatorPost.update({ where: { id }, data: { status: "hidden" } });
    return ok({ hidden: true });
  } catch (err) {
    return handleError(err, "creators:x:delete");
  }
}
