import { NextResponse, after } from "next/server";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getAdminSession } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { buildBoard, runIndex, type XWindow } from "@modules/creators/lib/x-index";
import { validHandle } from "@modules/creators/lib/twitterapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/creators/x?window=7d|30d|all - the Variational X leaderboard.
//
// Reads never call the paid API: the board is computed from stored posts and
// held for 5 min per window. The indexer (runIndex) is kicked AFTER the
// response is sent; it claims a lock and does nothing unless 30 min have
// passed, so traffic cannot multiply its cost - and every item it pays for is
// counted against TWITTERAPI_DAILY_ITEMS. Not polled by the client.
const BOARD_TTL = 300;

const cachedBoard = unstable_cache(async (win: XWindow) => buildBoard(win), ["creators-x-board-v2"], {
  revalidate: BOARD_TTL,
  tags: ["creators-x"],
});

export async function GET(req: Request) {
  try {
    const w = new URL(req.url).searchParams.get("window") || "all";
    if (w !== "7d" && w !== "30d" && w !== "all") return fail("Unknown window.", 400);
    const board = await cachedBoard(w);
    after(runIndex);
    return NextResponse.json(board, {
      headers: { "Cache-Control": `public, s-maxage=${BOARD_TTL}, stale-while-revalidate=3600` },
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
