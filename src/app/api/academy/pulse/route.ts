import { getPulse } from "@modules/academy/lib/board";
import { academyError, json, PUBLIC } from "@modules/academy/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/academy/pulse - real community activity for the Academy hero
// (learners active in the last 10 minutes, quizzes today, live rooms, recent
// achievements and certificates). Refetched on the "academy" realtime ping,
// throttled client-side to once per 30s; the edge window matches.
export async function GET() {
  try {
    return json(await getPulse(), PUBLIC(30, 60));
  } catch (err) {
    return academyError(err, "academy:pulse");
  }
}
