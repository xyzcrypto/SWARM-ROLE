import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { pushEnabled } from "@/lib/push";
import { CATEGORIES } from "@/lib/news";
import { isPushServiceEndpoint, MAX_PUSH_SUBS_PER_USER } from "@core/push/endpoints";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID = new Set<string>(CATEGORIES);

const schema = z.object({
  subscription: z.object({
    // Only a real browser push service (audit F-07): never an arbitrary URL.
    endpoint: z.string().url().max(1000).refine(isPushServiceEndpoint),
    keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
  }),
  // Optional notification preference (Web3 News customization).
  notifyMode: z.enum(["off", "high", "foryou", "categories"]).optional(),
  notifyCategories: z.array(z.string()).max(40).optional(),
});

// GET /api/push/subscribe?endpoint=... - return this device's saved notification
// preference (so the UI can preselect it). Defaults when unset / pre-migration.
export async function GET(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    const endpoint = new URL(req.url).searchParams.get("endpoint") ?? "";
    if (!endpoint) return ok({ notifyMode: "high", notifyCategories: [] });
    // Scoped to the caller - without this, any logged-in user could read
    // another subscriber's saved topic preferences by passing their endpoint.
    const sub = await prisma.pushSubscription
      .findFirst({ where: { endpoint, userId: me.id }, select: { notifyMode: true, notifyCategories: true } })
      .catch(() => null);
    return ok({
      notifyMode: (sub as { notifyMode?: string } | null)?.notifyMode ?? "high",
      notifyCategories: (sub as { notifyCategories?: string[] } | null)?.notifyCategories ?? [],
    });
  } catch (err) {
    return handleError(err, "push:subscribe:get");
  }
}

// POST /api/push/subscribe - store this browser's push subscription for the
// signed-in member (upsert by endpoint) + optional notification preferences.
// Auth-gated. Re-POSTing the same endpoint just updates the prefs.
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    if (!pushEnabled) return fail("Push notifications aren't configured yet.", 503);

    const { success } = await rateLimit("profile", me.id);
    if (!success) return fail("Too many requests. Please slow down.", 429);

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return fail("Invalid subscription.", 400);
    const { subscription, notifyMode, notifyCategories } = parsed.data;
    const { endpoint, keys } = subscription;
    const cats = (notifyCategories ?? []).filter((c) => VALID.has(c));

    const base = { p256dh: keys.p256dh, auth: keys.auth, userId: me.id };
    const prefs = notifyMode ? { notifyMode, notifyCategories: cats } : {};

    // ⚠️ An endpoint already saved for ANOTHER account is only moved to this
    // one when the caller also holds its keys (the same browser, now signed in
    // as someone else). Before, knowing a victim's endpoint URL was enough to
    // re-bind their device to your account (audit F-08).
    const existing = await prisma.pushSubscription.findUnique({ where: { endpoint }, select: { userId: true, p256dh: true, auth: true } }).catch(() => null);
    if (existing && existing.userId !== me.id && (existing.p256dh !== keys.p256dh || existing.auth !== keys.auth)) {
      return fail("Invalid subscription.", 400);
    }
    // One account, at most MAX_PUSH_SUBS_PER_USER devices: a new one replaces
    // the oldest, so one account cannot register endpoints without limit and
    // multiply every notification it receives (audit F-07).
    if (!existing || existing.userId !== me.id) {
      const mine = await prisma.pushSubscription
        .findMany({ where: { userId: me.id }, orderBy: { createdAt: "asc" }, select: { endpoint: true } })
        .catch(() => [] as { endpoint: string }[]);
      const over = mine.length - (MAX_PUSH_SUBS_PER_USER - 1);
      if (over > 0) {
        await prisma.pushSubscription.deleteMany({ where: { userId: me.id, endpoint: { in: mine.slice(0, over).map((m) => m.endpoint) } } }).catch(() => null);
      }
    }

    // Try with prefs; if the pref columns aren't migrated yet, fall back to the
    // base upsert so subscribing still works (prefs apply once migrated).
    try {
      await prisma.pushSubscription.upsert({
        where: { endpoint },
        create: { endpoint, ...base, ...prefs },
        update: { ...base, ...prefs },
      });
    } catch {
      await prisma.pushSubscription
        .upsert({ where: { endpoint }, create: { endpoint, ...base }, update: base })
        .catch(() => null);
    }

    return ok({ ok: true });
  } catch (err) {
    return handleError(err, "push:subscribe");
  }
}
