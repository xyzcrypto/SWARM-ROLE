import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { fail, handleError } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { buildBoard, buildProfile, scanHandle, SCAN_FRESH_MS, xConfigured } from "@modules/creators/lib/x-index";
import { validHandle } from "@modules/creators/lib/twitterapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/creators/x/profile?handle=<handle>
//
// "Scan" a handle: if we have not read this account from X in the last 6h,
// pull its Variational posts from twitterapi.io (billed, budget-capped,
// rate-limited per IP), then return its profile from the stored data. A
// handle scanned recently is a pure DB read and is not rate-limited.
const allTime = unstable_cache(async () => buildBoard("all"), ["creators-x-board-v2", "all"], {
  revalidate: 300,
  tags: ["creators-x"],
});

export async function GET(req: Request) {
  try {
    const handle = validHandle(new URL(req.url).searchParams.get("handle") || "");
    if (!handle) return fail("Enter a valid X handle.", 400);

    const acct = await prisma.xAccount.findUnique({ where: { handleLower: handle.toLowerCase() }, select: { scannedAt: true, hidden: true } });
    if (acct?.hidden) return fail("This account isn't on the board.", 404);

    let scan: string = "fresh";
    const stale = !acct?.scannedAt || Date.now() - acct.scannedAt.getTime() >= SCAN_FRESH_MS;
    if (stale && xConfigured()) {
      const { success } = await rateLimit("creatorScan", clientIp(req));
      if (!success) {
        scan = "limited";
      } else {
        scan = (await scanHandle(handle)).status;
      }
    } else if (!xConfigured()) {
      scan = "unconfigured";
    }

    if (scan === "not_found") return fail("No X account with that handle.", 404);
    const profile = await buildProfile(handle, await allTime().catch(() => null));
    if (!profile) {
      return NextResponse.json(
        { profile: null, scan },
        { status: scan === "unconfigured" ? 503 : 404, headers: { "Cache-Control": "private, no-store" } }
      );
    }
    return NextResponse.json(
      { profile, scan },
      // A finished profile is the same for every visitor; a degraded one
      // (limited / budget / error) must not be pinned at the edge.
      { headers: { "Cache-Control": scan === "fresh" || scan === "scanned" ? "public, s-maxage=600, stale-while-revalidate=3600" : "private, no-store" } }
    );
  } catch (err) {
    return handleError(err, "creators:x:profile");
  }
}
