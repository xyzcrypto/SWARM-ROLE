import { prisma } from "@/lib/prisma";
import { ok, fail, handleError } from "@/lib/api";
import { env } from "@/lib/env";
import { checkCronAuth, cronAuthFailure, type CronAuth } from "@/core/auth/cron-auth";
import { pushEnabled, sendPush } from "@/lib/push";
import { getNewsPage } from "@/lib/news-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/push/dispatch - cron entrypoint (runs every ~10 min). Finds NEW
// high-impact news since the last run and pushes it to all subscriptions.
// Secured by CRON_SECRET (Vercel Cron sends it as a Bearer token). Idempotent +
// deduped via PushedStory, so a frequent schedule never re-sends a story.
const FRESH_MS = 2 * 60 * 60 * 1000; // only alert on stories from the last 2h
const MAX_PER_RUN = 3; // never send more than this many pushes per run

// See `cron-auth.ts` for why an unset secret and a wrong token no longer answer
// the same thing: they are different problems, and blurring them is what left
// XYZ Sentinel dark for two weeks with no way to tell which one it was.
function authorized(req: Request): CronAuth {
  return checkCronAuth(
    env.CRON_SECRET,
    req.headers.get("authorization"),
    new URL(req.url).searchParams.get("secret")
  );
}

export async function GET(req: Request) {
  try {
    const auth = authorized(req);
    if (!auth.ok) {
      const { message, status } = cronAuthFailure(auth.reason);
      return fail(message, status);
    }
    if (!pushEnabled) return ok({ skipped: "push not configured" });

    // Call the news pipeline directly instead of fetching this app's own
    // /api/news route over HTTP - the self-fetch cost a second Vercel Function
    // invocation on every cron tick (up to ~144/day from the GitHub Actions
    // poller) for no benefit, since getNewsPage() already sits behind the same
    // NEWS_REVALIDATE cache /api/news itself reads from.
    const { items } = await getNewsPage({ pageSize: 30 }).catch(() => ({ items: [] as Awaited<ReturnType<typeof getNewsPage>>["items"] }));
    if (!items.length) return ok({ sent: 0, note: "news unavailable" });

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

    // Load subscriptions WITH their notification preferences. Falls back to the
    // old "send to everyone" behavior if the pref columns aren't migrated yet.
    type Sub = { id: string; endpoint: string; p256dh: string; auth: string; userId: string | null; notifyMode: string; notifyCategories: string[] };
    let subs: Sub[];
    try {
      subs = (await prisma.pushSubscription.findMany({
        where: { NOT: { notifyMode: "off" } },
        select: { id: true, endpoint: true, p256dh: true, auth: true, userId: true, notifyMode: true, notifyCategories: true },
      })) as Sub[];
    } catch {
      const rows = await prisma.pushSubscription.findMany();
      subs = rows.map((s) => ({ ...s, notifyMode: "high", notifyCategories: [] }));
    }
    if (!subs.length) return ok({ sent: 0, subscribers: 0 });

    // For "foryou" subs, look up each user's saved news interests once.
    const foryouUserIds = [...new Set(subs.filter((s) => s.notifyMode === "foryou" && s.userId).map((s) => s.userId as string))];
    const interests = new Map<string, string[]>();
    if (foryouUserIds.length) {
      const users = await prisma.user
        .findMany({ where: { id: { in: foryouUserIds } }, select: { id: true, newsInterests: true } })
        .catch(() => [] as { id: string; newsInterests: string[] }[]);
      users.forEach((u) => interests.set(u.id, u.newsInterests ?? []));
    }

    // Does this subscriber want this story? (story is already High-impact.)
    const wants = (sub: Sub, storyCats: string[]): boolean => {
      if (sub.notifyMode === "high") return true;
      if (sub.notifyMode === "categories") return storyCats.some((c) => sub.notifyCategories.includes(c));
      if (sub.notifyMode === "foryou") {
        const mine = (sub.userId && interests.get(sub.userId)) || [];
        return storyCats.some((c) => mine.includes(c));
      }
      return false;
    };

    let sent = 0;
    const dead: string[] = [];
    for (const story of toSend) {
      const storyCats = story.categories?.length ? story.categories : [story.category];
      const targets = subs.filter((s) => wants(s, storyCats));
      if (!targets.length) continue;
      const payload = { title: `🚨 ${story.category}`, body: story.title, url: story.url, tag: story.url };
      const results = await Promise.all(
        targets.map((s) => sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload))
      );
      results.forEach((r, i) => {
        if (r === "ok") sent++;
        else if (r === "gone") dead.push(targets[i].id);
      });
    }
    if (dead.length) await prisma.pushSubscription.deleteMany({ where: { id: { in: [...new Set(dead)] } } });

    return ok({ sent, stories: toSend.length, subscribers: subs.length });
  } catch (err) {
    return handleError(err, "push:dispatch");
  }
}
