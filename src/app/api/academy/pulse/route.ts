import { getPulse } from "@modules/academy/lib/board";
import { listLive } from "@modules/academy/lib/live";
import { academyError, json, PUBLIC } from "@modules/academy/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/academy/pulse - real community activity for the Academy hero
// (learners active in the last 10 minutes, quizzes today, live rooms, recent
// achievements and certificates). Refetched on the "academy" realtime ping,
// throttled client-side to once per 30s; the edge window matches.
export async function GET() {
  try {
    // "Live now" comes from each quiz's own schedule (the state the Live page
    // shows), not the stored status: a quiz that ended while nobody was
    // watching stays "live" in the table until someone opens it, and the hero
    // kept counting it.
    const [pulse, live] = await Promise.all([getPulse(), listLive()]);
    const running = live.filter((l) => l.state === "live");
    return json({ ...pulse, liveNow: running.length, liveParticipants: running.reduce((s, l) => s + l.participants, 0) }, PUBLIC(30, 60));
  } catch (err) {
    return academyError(err, "academy:pulse");
  }
}
