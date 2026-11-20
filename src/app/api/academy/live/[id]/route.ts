import { publicLiveState } from "@modules/academy/lib/live";
import { academyError, json, PUBLIC } from "@modules/academy/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/academy/live/:id - what every participant sees: the phase, the open
// question WITHOUT its answer (the answer and the vote split only appear in the
// reveal phase), the room and the round leaderboard.
//
// Every participant fetches this at the same moment (each phase change), so a
// 2s edge window collapses a full room into one origin request per phase. The
// clock itself is NOT read from here - a cached `serverNow` would be stale - but
// from the private /me route.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return json(await publicLiveState(id), PUBLIC(2, 2));
  } catch (err) {
    return academyError(err, "academy:live:get");
  }
}
