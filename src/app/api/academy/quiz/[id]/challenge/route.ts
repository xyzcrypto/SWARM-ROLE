import { fail } from "@/lib/api";
import { challengeSummary } from "@modules/academy/lib/quiz";
import { academyError, json, PUBLIC } from "@modules/academy/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/academy/quiz/:id/challenge - who set a "Challenge friends" link and
// what they scored. No questions, no answers. A finished attempt never changes.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const s = await challengeSummary(id);
    if (!s) return fail("Challenge not found.", 404);
    return json(s, PUBLIC(3600, 86400));
  } catch (err) {
    return academyError(err, "academy:challenge");
  }
}
