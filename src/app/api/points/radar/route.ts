import { NextResponse } from "next/server";
import { getNewsPage, NEWS_REVALIDATE } from "@modules/news/lib/news-fetch";
import { toRadar } from "@modules/points/lib/airdrop-radar";

/**
 * Airdrop / perp DEX stories, from the sources the site already trusts.
 *
 * ⚠️ WINDOW: 120, and it is not a free choice. `getNewsPage` wraps its work in an
 * `unstable_cache` keyed to `NEWS_REVALIDATE` (120s), and **Next takes the
 * MINIMUM revalidate across a route segment** - so declaring anything longer
 * here would be silently truncated to 120 and this file would disagree with the
 * route table. That is trap 1b in the cost-check skill, which has shipped on
 * this project twice. The literal below is checked against `NEWS_REVALIDATE` by
 * `points-radar.test.ts`.
 *
 * ⚠️ NOT POLLED. The client fetches on mount, on wake, and on an explicit
 * refresh - deliberately absent from `TARGETS` in
 * markets-poll-alignment.test.ts. **If a poll is ever added, add it there**, and
 * note that a 120s window needs a poll comfortably under 120s, which is an
 * expensive shape. Prefer leaving it unpolled: `getNewsPage` is shared with
 * /news, so this route adds no upstream traffic at all - it re-reads a cache
 * that page already pays for.
 */
export const revalidate = 120; // must equal NEWS_REVALIDATE - pinned by a test

export async function GET() {
  try {
    // One page, large, then narrowed here. The pipeline dedupes and ranks
    // across every source before this sees it, so filtering afterwards cannot
    // reintroduce a duplicate.
    const page = await getNewsPage({ pageSize: 200 });
    const items = toRadar(page.items);

    return NextResponse.json(
      { items, live: page.live, ts: Date.now() },
      {
        headers: {
          // Literal, not a template. The edge honours THIS header rather than
          // the export above (cost-check trap 0), and a template literal is
          // invisible to the check that verifies it.
          "Cache-Control": items.length
            ? "public, s-maxage=120, stale-while-revalidate=300"
            : // Nothing matched: keep the window short so a quiet hour does not
              // cache an empty radar for two minutes past the story landing.
              "public, s-maxage=30",
        },
      }
    );
  } catch (err) {
    // An empty radar is a survivable state - the desk's own posts are the lane
    // that matters - so this degrades rather than 500s.
    return NextResponse.json(
      { items: [], live: false, error: (err as Error)?.name ?? "failed", ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=30" } }
    );
  }
}
