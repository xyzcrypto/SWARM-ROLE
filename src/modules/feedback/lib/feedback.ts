import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { notifyOwner } from "@modules/notifications/lib/notify-owner";
import { grant, pingBoards } from "@modules/academy/lib/xp";
import { badgesFor, CATEGORIES, CATEGORY_IDS, MAX_MESSAGE, MIN_MESSAGE, STATUSES, XP_DAILY, XP_FIRST, XP_SHIPPED } from "./shared";

const clean = (s: string) =>
  // No NUL or lone surrogates (Postgres rejects them), trimmed.
  s.replace(/\u0000/g, "").replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "").trim();

export const feedbackInput = z.object({
  category: z.enum(CATEGORY_IDS),
  rating: z.number().int().min(1).max(5),
  message: z
    .string()
    .transform(clean)
    .pipe(z.string().min(MIN_MESSAGE, `Tell us a little more (at least ${MIN_MESSAGE} characters).`).max(MAX_MESSAGE)),
  page: z.string().max(200).optional().default(""),
  name: z.string().max(60).optional().transform((v) => (v ? clean(v) : undefined)),
  contact: z.string().max(120).optional().transform((v) => (v ? clean(v) : undefined)),
  // Honeypot: a hidden field a person never fills.
  website: z.string().max(200).optional(),
});
export type FeedbackInput = z.infer<typeof feedbackInput>;

const utcDay = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Stores the feedback and pays the member's XP. Returns what was paid. */
export async function submitFeedback(userId: string | null, input: FeedbackInput, now = Date.now()) {
  return prisma.$transaction(async (tx) => {
    let xp = 0;
    let first = false;
    if (userId) {
      const day = utcDay(now);
      xp += await grant(tx, { userId, amount: XP_DAILY, reason: "feedback", key: `feedback:${userId}:${day}`, label: "Feedback" });
      const firstPaid = await grant(tx, { userId, amount: XP_FIRST, reason: "feedback", key: `feedback-first:${userId}`, label: "First feedback bonus" });
      first = firstPaid > 0;
      xp += firstPaid;
    }
    const row = await tx.feedback.create({
      data: {
        userId,
        name: userId ? null : input.name || null,
        contact: userId ? null : input.contact || null,
        category: input.category,
        rating: input.rating,
        message: input.message,
        page: input.page ?? "",
        xp,
      },
      select: { id: true, createdAt: true },
    });
    return { id: row.id, xp, first };
  });
}

/** Owner alert: email (site.email) + Telegram. Best-effort, never throws. */
export async function alertOwner(id: string, input: FeedbackInput, who: { name: string; email?: string | null }) {
  const cat = CATEGORIES.find((c) => c.id === input.category);
  const stars = "★".repeat(input.rating) + "☆".repeat(5 - input.rating);
  const subject = `${cat?.emoji ?? ""} New ${cat?.label ?? "feedback"} feedback ${stars}`.trim();
  const text = [
    `From: ${who.name}${who.email ? ` <${who.email}>` : ""}`,
    `Category: ${cat?.label ?? input.category} · Rating: ${input.rating}/5`,
    input.page ? `Page: ${input.page}` : "",
    "",
    input.message,
    "",
    `Triage: https://xyzcrypto.io/dashboard/feedback#${id}`,
  ]
    .filter((l, i, a) => l !== "" || (i > 0 && a[i - 1] !== ""))
    .join("\n");
  await notifyOwner({ subject, text }).catch(() => undefined);
}

export async function myFeedback(userId: string) {
  const rows = await prisma.feedback.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, category: true, rating: true, message: true, status: true, xp: true, createdAt: true },
  });
  const [count, xp] = await Promise.all([
    prisma.feedback.count({ where: { userId } }),
    prisma.academyXp.aggregate({ where: { userId, reason: "feedback" }, _sum: { amount: true } }),
  ]);
  const today = utcDay(Date.now());
  const paidToday = await prisma.academyXp.count({ where: { userId, key: `feedback:${userId}:${today}` } });
  return {
    count,
    xp: xp._sum.amount ?? 0,
    rewardAvailable: paidToday === 0,
    badges: badgesFor(rows),
    items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  };
}

// ── Admin ───────────────────────────────────────────────────────────────

export const adminPatch = z.object({ id: z.string().min(1).max(40), status: z.enum(STATUSES) });

export async function adminList(status: string | null, cursor: string | null) {
  const where = status && (STATUSES as readonly string[]).includes(status) ? { status } : {};
  const rows = await prisma.feedback.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 51,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true, category: true, rating: true, message: true, page: true, status: true, xp: true, createdAt: true, name: true, contact: true,
      user: { select: { id: true, name: true, email: true, username: true, image: true } },
    },
  });
  const [byStatus, avg] = await Promise.all([
    prisma.feedback.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.feedback.aggregate({ _avg: { rating: true }, _count: { _all: true } }),
  ]);
  const counts = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all]));
  return {
    items: rows.slice(0, 50).map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      user: r.user ? { ...r.user, image: r.user.image?.startsWith("data:") ? null : r.user.image } : null,
    })),
    next: rows.length > 50 ? rows[49].id : null,
    stats: { total: avg._count._all, avgRating: avg._avg.rating ?? 0, new: counts.new ?? 0, seen: counts.seen ?? 0, done: counts.done ?? 0 },
  };
}

/** Sets a status. Marking a member's feedback "done" pays XP_SHIPPED once. */
export async function adminSetStatus(staffId: string, id: string, status: (typeof STATUSES)[number]) {
  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.feedback.update({ where: { id }, data: { status }, select: { id: true, userId: true, status: true } });
    let paid = 0;
    if (status === "done" && row.userId) {
      paid = await grant(tx, { userId: row.userId, amount: XP_SHIPPED, reason: "feedback", key: `feedback-done:${id}`, label: "Your feedback shipped" });
    }
    return { id: row.id, status: row.status, paid, userId: row.userId };
  });
  // Outside the transaction: a failed insert there would abort the status change.
  await prisma.adminAudit
    .create({ data: { actorId: staffId, action: "feedback.status", targetId: result.userId, detail: JSON.stringify({ id, status }) } })
    .catch(() => undefined);
  if (result.paid) await pingBoards("xp").catch(() => undefined);
  return { id: result.id, status: result.status, paid: result.paid };
}
