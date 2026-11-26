import { fail } from "@/lib/api";
import { challengeSummary } from "@modules/academy/lib/quiz";
import { challengeBoard } from "@modules/academy/lib/duel";
import { academyError, json, PUBLIC } from "@modules/academy/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/academy/quiz/:id/challenge - who set a "Challenge friends" link,
// what they scored, and the board of everyone who has played it. No questions,
// no answers. The board grows as friends play, so the edge holds it for 60s,
// not the hour a finished attempt alone could take.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [s, b] = await Promise.all([challengeSummary(id), challengeBoard(id)]);
    if (!s || !b) return fail("Challenge not found.", 404);
    return json({ ...s, takers: b.takers, beaten: b.beaten, board: b.board }, PUBLIC(60, 600));
  } catch (err) {
    return academyError(err, "academy:challenge");
  }
}
