import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handleError } from "@/lib/api";

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

export async function GET(_req: Request, { params }: { params: { userId: string } }) {
  try {
    try {
      const items = await prisma.journalActivity.findMany({
        where: { userId: params.userId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, type: true, title: true, win: true, createdAt: true },
      });
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
