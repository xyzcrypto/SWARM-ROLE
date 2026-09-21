import { NextResponse } from "next/server";
import { getClassifiedPool, NEWS_REVALIDATE } from "@modules/news/lib/news-fetch";
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
 * ⚠️ POLLED, at 90s (`RADAR_POLL_MS` in LiveWire.tsx), and registered in
 * `TARGETS` in markets-poll-alignment.test.ts. This header used to say the
 * opposite and to argue for leaving it unpolled - but half the band was live
 * (the desk lane broadcasts on write) and half was as old as the page, with
 * nothing telling a reader which. A band called "Latest updates" has to be one.
 *
 * 90 against 120 is the same margin `/api/news` has run since #236, and
 * deliberately not equal: equal lets jitter decide whether every poll
 * regenerates the route. The cost is small because `getNewsPage` is shared with
 * /news - this route adds no upstream traffic, it re-reads a cache that page
 * already pays for.
 */
export const revalidate = 120; // must equal NEWS_REVALIDATE - pinned by a test

export async function GET() {
  try {
    /**
     * ⚠️ THE WHOLE POOL, not a page of it. This line is why the band reported
     * "0 tracked" against a perfectly healthy feed.
     *
     * It used to call `getNewsPage({ pageSize: 200 })`. `getNewsPage` clamps
     * that - `Math.min(30, ...)` - so 200 silently became **30**, and those 30
     * are RANKED first by general news impact, meaning they are the day's
     * biggest crypto stories. Filtering that set for perp DEX and airdrop news
     * is a narrow filter over a sample chosen for something else, and it
     * legitimately matches nothing on a day dominated by ETF and macro
     * headlines. No error, no warning - just an empty radar.
     *
     * `findNewsByUrl` in the same file exists because of the identical clamp.
     * The pool is the same cached entry `/news` already pays for, so reading
     * all of it costs nothing extra.
     */
    const pool = await getClassifiedPool();
    const items = toRadar(pool.items);

    return NextResponse.json(
      {
        items,
        live: pool.live,
        ts: Date.now(),
        /**
         * ⚠️ Diagnostics travel with the answer, because the last two bugs on
         * this page were both "a number is wrong and nothing says why", and
         * both were only solved once production could state its own case. An
         * empty radar now says whether the pool was empty (upstream down) or
         * whether the pool was full and nothing matched (genuinely quiet).
         */
        diag: { pool: pool.items.length, matched: items.length },
      },
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
      { items: [], live: false, error: (err as Error)?.name ?? "failed", diag: { pool: 0, matched: 0 }, ts: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=30" } }
    );
  }
}
