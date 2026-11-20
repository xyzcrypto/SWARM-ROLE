import { listLive } from "@modules/academy/lib/live";
import { academyError, json, PUBLIC } from "@modules/academy/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/academy/live - upcoming, live and recent live quizzes. Not polled
// (the page refetches on the "academy" ping and when a countdown hits zero).
export async function GET() {
  try {
    return json({ quizzes: await listLive() }, PUBLIC(10, 30));
  } catch (err) {
    return academyError(err, "academy:live:list");
  }
}
