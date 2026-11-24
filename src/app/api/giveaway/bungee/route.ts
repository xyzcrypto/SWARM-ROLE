import { fail, getSessionUser } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { storeScreenshot } from "@modules/feedback/lib/feedback";
import { assertCanEnter, entryInput, myStatus, submitEntry } from "@modules/giveaway/lib/entry";
import { academyError, json, PRIVATE } from "@modules/academy/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/giveaway/bungee - the signed-in member's checklist: lessons
// completed, Bungee live quizzes played, and their entry if they made one.
// Personal, so never cached. The /bungee page itself is static.
export async function GET() {
  try {
    const me = await getSessionUser();
    if (!me) return json({ guest: true }, PRIVATE);
    return json(await myStatus(me.id), PRIVATE);
  } catch (err) {
    return academyError(err, "giveaway:bungee:get");
  }
}

// POST /api/giveaway/bungee - create or update the member's entry. Requires
// every Bungee lesson completed (verified on the server, not from the
// screenshot) and a unique Bungee UID.
export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    const ipOk = await rateLimit("giveawayIp", ip);
    if (!ipOk.success) return fail("Too many attempts from this network. Try again in a while.", 429);
    const me = await getSessionUser();
    if (!me) return fail("Sign in to your XYZ Crypto account to enter.", 401);
    const { success } = await rateLimit("giveaway", me.id);
    if (!success) return fail("Too many saves. Try again in a while.", 429);
    const parsed = entryInput.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the form.", 400);
    if (parsed.data.website) return json({ ok: true }, PRIVATE);
    // Refuse before uploading anything (closed, lessons incomplete, reviewed).
    await assertCanEnter(me.id);
    const proofUrl = parsed.data.proof ? await storeScreenshot(parsed.data.proof) : null;
    if (parsed.data.proof && !proofUrl) return fail("We could not save the screenshot. Try a smaller image.", 400);
    const res = await submitEntry(me.id, parsed.data, { ip, ua: req.headers.get("user-agent") ?? "" }, proofUrl);
    return json({ ok: true, ...res, status: await myStatus(me.id) }, PRIVATE);
  } catch (err) {
    return academyError(err, "giveaway:bungee:post");
  }
}
