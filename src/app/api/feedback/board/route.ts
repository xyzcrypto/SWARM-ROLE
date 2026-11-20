import { topVoices } from "@modules/feedback/lib/feedback";
import { academyError, json, PUBLIC } from "@modules/academy/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // never read the DB at build time; the edge caches it via Cache-Control

// GET /api/feedback/board - "Top voices" on /feedback. Public and anonymous-safe
// (names and avatars only), edge-cached 5 min: it changes slowly and nobody
// polls it (fetched once per page view).
export async function GET() {
  try {
    return json({ voices: await topVoices() }, PUBLIC(300, 600));
  } catch (err) {
    return academyError(err, "feedback:board");
  }
}
