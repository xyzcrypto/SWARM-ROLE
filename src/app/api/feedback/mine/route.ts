import { fail, getSessionUser } from "@/lib/api";
import { myFeedback } from "@modules/feedback/lib/feedback";
import { academyError, json, PRIVATE } from "@modules/academy/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/feedback/mine - the member's own feedback, XP earned and badges.
export async function GET() {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Sign in to see your feedback.", 401);
    return json(await myFeedback(me.id), PRIVATE);
  } catch (err) {
    return academyError(err, "feedback:mine");
  }
}
