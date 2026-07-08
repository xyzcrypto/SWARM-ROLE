import { prisma } from "@/lib/prisma";
import { ok, fail, handleError } from "@/lib/api";
import { env } from "@/lib/env";
import { pushEnabled, sendPush } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/push/dispatch - cron entrypoint (runs every ~10 min). Finds NEW
// high-impact news since the last run and pushes it to all subscriptions.
// Secured by CRON_SECRET (Vercel Cron sends it as a Bearer token). Idempotent +
// deduped via PushedStory, so a frequent schedule never re-sends a story.
const FRESH_MS = 2 * 60 * 60 * 1000; // only alert on stories from the last 2h
const MAX_PER_RUN = 3; // never send more than this many pushes per run

function authorized(req: Request): boolean {
  if (!env.CRON_SECRET) return false; // disabled unless a secret is configured
  const auth = req.headers.get("authorization");
  const qs = new URL(req.url).searchParams.get("secret");
  return auth === `Bearer ${env.CRON_SECRET}` || qs === env.CRON_SECRET;
}

export async function GET(req: Request) {
  try {
    if (!authorized(req)) return fail("Forbidden", 403);
    if (!pushEnabled) return ok({ skipped: "push not configured" });

    const origin = new URL(req.url).origin;
    const res = await fetch(`${origin}/api/news?pageSize=30`, { cache: "no-store" });
    if (!res.ok) return ok({ sent: 0, note: "news unavailable" });
    const { items } = (await res.json()) as { items: { url: string; title: string; category: string; impact: string; publishedAt: number }[] };

    const cutoff = Date.now() - FRESH_MS;
    const high = (items ?? []).filter((i) => i.impact === "High" && i.publishedAt >= cutoff);
    if (!high.length) return ok({ sent: 0 });

    const urls = high.map((i) => i.url);
    const existing = await prisma.pushedStory.findMany({ where: { url: { in: urls } }, select: { url: true } });
    const seen = new Set(existing.map((e) => e.url));
    const fresh = high.filter((i) => !seen.has(i.url));
    if (!fresh.length) return ok({ sent: 0 });

    // Record ALL fresh high-impact stories so we never re-push them (prevents a
    // flood on the first run), but only actually notify for the newest few.
    await prisma.pushedStory.createMany({ data: fresh.map((i) => ({ url: i.url })), skipDuplicates: true });
    const toSend = fresh.slice(0, MAX_PER_RUN);

    const subs = await prisma.pushSubscription.findMany();
    if (!subs.length) return ok({ sent: 0, subscribers: 0 });

    let sent = 0;
    const dead: string[] = [];
    for (const story of toSend) {
      const payload = { title: `🚨 ${story.category}`, body: story.title, url: story.url, tag: story.url };
      const results = await Promise.all(
        subs.map((s) => sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload))
      );
      results.forEach((r, i) => {
        if (r === "ok") sent++;
        else if (r === "gone") dead.push(subs[i].id);
      });
    }
    if (dead.length) await prisma.pushSubscription.deleteMany({ where: { id: { in: [...new Set(dead)] } } });

    return ok({ sent, stories: toSend.length, subscribers: subs.length });
  } catch (err) {
    return handleError(err, "push:dispatch");
  }
}
