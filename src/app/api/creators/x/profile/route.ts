import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { fail, handleError } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { buildBoard, buildProfile, scanHandle, SCAN_FRESH_MS, xConfigured, type VenueFilter } from "@modules/creators/lib/x-index";
import { validHandle, venueById } from "@modules/creators/lib/twitterapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The background indexer runs in after() on this request and needs the time.
export const maxDuration = 60;

// GET /api/creators/x/profile?handle=<handle>&venue=variational|entropy|all
//
// "Scan" a handle: if we have not read this account from X in the last 6h,
// pull its Variational posts from twitterapi.io (billed, budget-capped,
// rate-limited per IP), then return its profile from the stored data. A
// handle scanned recently is a pure DB read and is not rate-limited.
// Same function and key as the board route's cache, so a profile and the
// all-time board for its venue share one entry instead of computing twice.
const allTime = unstable_cache(async (venue: VenueFilter, win: "all", replies: boolean) => buildBoard(venue, win, replies), ["creators-x-board-v5"], {
  revalidate: 300,
  tags: ["creators-x"],
});

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const handle = validHandle(sp.get("handle") || "");
    if (!handle) return fail("Enter a valid X handle.", 400);
    const v = sp.get("venue") || "all";
    if (v !== "all" && !venueById(v)) return fail("Unknown venue.", 400);
    const venue = v as VenueFilter;
    const replies = sp.get("replies") === "1";

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
    const profile = await buildProfile(handle, venue, await allTime(venue, "all", replies).catch(() => null), replies);
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
