import { NextResponse, after } from "next/server";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getAdminSession } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { buildBoard, runIndex, type VenueFilter, type XWindow } from "@modules/creators/lib/x-index";
import { validHandle, venueById } from "@modules/creators/lib/twitterapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/creators/x?venue=variational|entropy|all&window=7d|30d|all - the X leaderboard.
//
// Reads never call the paid API: the board is computed from stored posts and
// held for 5 min per window. The indexer (runIndex) is kicked AFTER the
// response is sent; it claims a lock and does nothing unless 30 min have
// passed, so traffic cannot multiply its cost - and every item it pays for is
// counted against TWITTERAPI_DAILY_ITEMS. Polled by /creators every X_POLL_MS
// (240s, visible tab only) against this 300s window - listed in TARGETS in
// markets-poll-alignment.test.ts.
const BOARD_TTL = 300;

// The key carries a version. The data cache outlives deploys, so whenever the
// Board shape changes the version MUST change too, or the new client gets the
// old shape for up to BOARD_TTL after a deploy (v3 -> v4 added move/topics/latest).
const cachedBoard = unstable_cache(async (venue: VenueFilter, win: XWindow) => buildBoard(venue, win), ["creators-x-board-v4"], {
  revalidate: BOARD_TTL,
  tags: ["creators-x"],
});

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const w = sp.get("window") || "all";
    const v = sp.get("venue") || "variational";
    if (w !== "7d" && w !== "30d" && w !== "all") return fail("Unknown window.", 400);
    if (v !== "all" && !venueById(v)) return fail("Unknown venue.", 400);
    const board = await cachedBoard(v as VenueFilter, w);
    after(runIndex);
    return NextResponse.json(board, {
      // Literal on purpose: markets-poll-alignment.test.ts reads it. Keep equal to BOARD_TTL.
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
    });
  } catch (err) {
    return handleError(err, "creators:x:get");
  }
}

// DELETE /api/creators/x?handle=<handle> - admin removes an account (spam,
// impersonation) from the board. Kept, flagged, so a re-index cannot bring it back.
export async function DELETE(req: Request) {
  try {
    const { success } = await rateLimit("admin", clientIp(req));
    if (!success) return fail("Too many requests.", 429);
    const admin = await getAdminSession();
    if (!admin) return fail("Forbidden.", 403);
    const handle = validHandle(new URL(req.url).searchParams.get("handle") || "");
    if (!handle) return fail("Missing handle.", 400);
    await prisma.xAccount.update({ where: { handleLower: handle.toLowerCase() }, data: { hidden: true } });
    return ok({ hidden: true });
  } catch (err) {
    return handleError(err, "creators:x:delete");
  }
}
