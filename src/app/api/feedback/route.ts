import { after } from "next/server";
import { fail, getSessionUser } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { prisma } from "@/lib/prisma";
import { pingBoards } from "@modules/academy/lib/xp";
import { alertOwner, feedbackInput, storeScreenshot, submitFeedback } from "@modules/feedback/lib/feedback";
import { academyError, json, PRIVATE } from "@modules/academy/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/feedback - members and guests. Members earn Academy XP (once per
// UTC day, plus a first-time bonus). The owner gets an email + Telegram alert
// after the response is sent (to the owner's own inbox only, so it carries
// the member's real email for a reply), and staff see it on /dashboard/feedback.
export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    const ipOk = await rateLimit("feedbackIp", ip);
    if (!ipOk.success) return fail("Thanks! That's a lot of feedback for one hour. Try again a bit later.", 429);
    const me = await getSessionUser();
    if (me) {
      const { success } = await rateLimit("feedback", me.id);
      if (!success) return fail("Thanks! That's a lot of feedback for one hour. Try again a bit later.", 429);
    }
    const parsed = feedbackInput.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid feedback.", 400);
    // Honeypot filled: answer like a success so the bot learns nothing.
    if (parsed.data.website) return json({ ok: true, xp: 0, first: false }, PRIVATE);

    const image = await storeScreenshot(parsed.data.image);
    const res = await submitFeedback(me?.id ?? null, parsed.data, Date.now(), image);
    after(async () => {
      let who = { name: parsed.data.name || "Guest", email: parsed.data.contact || null } as { name: string; email: string | null };
      if (me) {
        const u = await prisma.user.findUnique({ where: { id: me.id }, select: { name: true, username: true, email: true } }).catch(() => null);
        who = { name: `${u?.name || "Member"}${u?.username ? ` (@${u.username})` : ""}`, email: u?.email ?? null };
      }
      await alertOwner(res.id, parsed.data, who, image);
      if (res.xp) await pingBoards("xp").catch(() => undefined);
    });
    return json({ ok: true, ...res }, PRIVATE);
  } catch (err) {
    return academyError(err, "feedback:post");
  }
}
