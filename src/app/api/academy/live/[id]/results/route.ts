import { liveResults } from "@modules/academy/lib/live";
import { academyError, json, PUBLIC } from "@modules/academy/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/academy/live/:id/results - the answer review of a FINISHED live
// quiz (every question, its correct answer, the vote split, % right, the
// fastest correct player, the explanation) and the final standings. 409 until
// the quiz has ended, so an answer can never leak while it is running. A
// finished quiz never changes, so the edge keeps it for an hour: everyone who
// opens the results costs one origin request per hour, not one each.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return json(await liveResults(id), PUBLIC(3600, 86_400));
  } catch (err) {
    return academyError(err, "academy:live:results");
  }
}
