import { after } from "next/server";
import { finalizeDuePeriods, getBoard, searchBoard } from "@modules/academy/lib/board";
import { PERIODS, type Period } from "@modules/academy/lib/engine";
import { academyError, json, PUBLIC } from "@modules/academy/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/academy/leaderboard?period=daily|weekly|monthly|alltime&page=1[&q=name]
//
// Public and identical for everyone (the caller's own row comes from
// /api/academy/me), so the edge caches it for 5s (near real time; the edge
// still collapses every viewer into at most one origin read per 5s per board). Boards refetch on the
// "academy" realtime ping rather than on a timer, so the edge window bounds
// origin traffic no matter how many tabs are open.
//
// Also the trigger for closing finished periods (there is no cron): after the
// response, any ended day/week/month without winners gets them.
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const p = url.searchParams.get("period") ?? "weekly";
    const period: Period = (PERIODS as string[]).includes(p) ? (p as Period) : "weekly";
    const page = Math.max(1, Math.min(200, Number(url.searchParams.get("page")) || 1));
    const q = (url.searchParams.get("q") ?? "").trim();
    after(() => finalizeDuePeriods().catch((err) => console.error("[academy] finalize", err)));
    if (q) return json({ period, results: await searchBoard(period, q) }, PUBLIC(5, 10));
    return json(await getBoard(period, page), PUBLIC(5, 10));
  } catch (err) {
    return academyError(err, "academy:leaderboard");
  }
}
