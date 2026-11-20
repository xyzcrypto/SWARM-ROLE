import { fail, getSessionUser } from "@/lib/api";
import { getMe } from "@modules/academy/lib/me";
import { academyError, json, PRIVATE } from "@modules/academy/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/academy/me - the signed-in member's dashboard: XP, level, streak,
// standing on all four boards, weekly XP, achievements, certificates, progress
// and what to learn next. Personal, never cached.
export async function GET() {
  try {
    const me = await getSessionUser();
    if (!me) {
      const res = fail("Please log in.", 401);
      res.headers.set("Cache-Control", PRIVATE);
      return res;
    }
    return json(await getMe(me.id), PRIVATE);
  } catch (err) {
    return academyError(err, "academy:me");
  }
}
