import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handleError, isCuid } from "@/lib/api";
import { publicJournalActivity } from "@modules/journal/lib/public-activity";

export const runtime = "nodejs";

// GET /api/journal/share/activity/[userId] - the last 20 public Journal
// Activity rows for a member, keyed by userId (grouped with the other
// share/* routes: no session gate by design - this data was already decided
// safe-to-show at write time, so anyone including link-preview bots can read
// it). Cached briefly (same recipe as the other share/* routes) so repeat
// polls from JournalActivityFeed's 60s fallback interval - across every
// visitor to a profile page - are served from the CDN, not the origin.
// Degrades to an empty list if the table hasn't been migrated yet.
const CACHE = { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } };

export async function GET(_req: Request, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
  try {
    // ⚠️ A PRIVATE profile shows nothing but a name and photo, and that must
    // hold here too: this route served the last 20 activity rows of ANY user
    // id, so a member who went private still leaked their wins and losses to
    // anyone who had their id (it travels in chat payloads). Private (or
    // unknown) members get an empty list, the same answer for every caller,
    // so the response stays safely CDN-cacheable (audit F-04).
    if (!isCuid(params.userId)) return NextResponse.json({ items: [] }, CACHE);
    const owner = await prisma.user.findUnique({ where: { id: params.userId }, select: { profileVisibility: true } }).catch(() => null);
    if (!owner || owner.profileVisibility === "private") return NextResponse.json({ items: [] }, CACHE);
    try {
      // Only rows whose source trade/challenge is STILL public (checked here,
      // not trusted from write time - see publicJournalActivity).
      const items = await publicJournalActivity(params.userId, 20);
      return NextResponse.json({ items }, CACHE);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2021" || err.code === "P2022")) {
        return NextResponse.json({ items: [] }, CACHE);
      }
      throw err;
    }
  } catch (err) {
    return handleError(err, "journal:share:activity");
  }
}
