import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { fetchPublicHtml, isFetchableUrl } from "@core/net/safe-fetch";
import { parsePreview, type LinkPreview } from "@modules/community/lib/link-preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A day: page titles do not change by the minute, and every miss costs a fetch. */
const TTL = 86_400;

// The REDUCED value is what gets cached - a few hundred bytes - not the page.
// (A page body can blow Next's 2 MB data-cache limit and make a cache inert;
// see the cost-check skill, trap 2.)
const previewFor = unstable_cache(
  async (url: string): Promise<LinkPreview | null> => {
    const page = await fetchPublicHtml(url);
    return page ? parsePreview(page.html, page.url) : null;
  },
  ["link-preview-v1"],
  { revalidate: TTL }
);

const json = (body: unknown, status: number, cache: string) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": cache } });

// GET /api/link-preview?url=... - title/description for a link in a message.
//
// Signed-in only, so this is not an open fetch-anything proxy for the internet.
// The answer is the same for everyone who asks about the same URL, so it is
// cached at the edge; only successes are, so a transient failure is retried.
export async function GET(req: Request) {
  const me = await getSessionUser();
  if (!me) return json({ error: "Please log in." }, 401, "private, no-store");

  const raw = new URL(req.url).searchParams.get("url") ?? "";
  const target = raw.length <= 2048 ? isFetchableUrl(raw) : null;
  if (!target) return json({ preview: null }, 200, "public, s-maxage=86400");

  // Only a MISS reaches here, but a miss is an outbound fetch, so it is
  // limited on both keys like anything else a person can make the server do.
  {
    const { success } = await rateLimit("linkPreview", `preview-${me.id}`);
    if (!success) return json({ error: "Slow down." }, 429, "private, no-store");
  }
  {
    const { success } = await rateLimit("linkPreview", `preview-ip-${clientIp(req)}`);
    if (!success) return json({ error: "Slow down." }, 429, "private, no-store");
  }

  const preview = await previewFor(target.toString()).catch(() => null);
  return json(
    { preview },
    200,
    preview ? `public, s-maxage=${TTL}, stale-while-revalidate=${TTL * 7}` : "public, s-maxage=3600"
  );
}
