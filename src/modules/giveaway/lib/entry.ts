import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { ensureSeeded } from "@modules/academy/lib/store";
import { livePhase } from "@modules/academy/lib/engine";
import { QuizError } from "@modules/academy/lib/quiz";
import { BUNGEE_CAMPAIGN, BUNGEE_CATEGORY, MIN_HUMAN_ANSWER_MS, normalizeBungeeUid, normalizeTelegram } from "./bungee";

// ------------------------------------------------------------------ input

export const entryInput = z.object({
  bungeeUid: z.string().max(80).transform((v, ctx) => {
    const n = normalizeBungeeUid(v);
    if (!n) ctx.addIssue({ code: "custom", message: "Enter your Bungee UID exactly as your dashboard shows it." });
    return n ?? "";
  }),
  bungeeEmail: z.string().trim().toLowerCase().email("Enter the email you use on Bungee.").max(160),
  telegram: z.string().max(64).transform((v, ctx) => {
    const n = normalizeTelegram(v);
    if (!n) ctx.addIssue({ code: "custom", message: "Enter your Telegram @username (5-32 letters, digits or _) or numeric id." });
    return n ?? "";
  }),
  // Screenshot of the completed lessons, compressed in the browser like /feedback's.
  proof: z
    .string()
    .max(1_400_000)
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, "Upload the screenshot as a PNG, JPEG or WebP image.")
    .optional(),
  agree: z.literal(true, { errorMap: () => ({ message: "Please confirm the giveaway terms." }) }),
  // Honeypot: never filled by a person.
  website: z.string().max(200).optional(),
});
export type EntryInput = z.infer<typeof entryInput>;

/** Salted, truncated hash: lets staff see two entries came from one network or browser without storing either. */
export function fingerprint(value: string): string {
  if (!value) return "";
  return createHash("sha256").update(`${env.NEXTAUTH_SECRET}:giveaway:${value}`).digest("hex").slice(0, 24);
}

// ------------------------------------------------------------------ campaign state

const OPEN_KEY = `giveaway:${BUNGEE_CAMPAIGN}:open`;

export async function isOpen(): Promise<boolean> {
  const row = await prisma.academyConfig.findUnique({ where: { key: OPEN_KEY } }).catch(() => null);
  return row?.value !== false; // open until staff close it
}

export async function setOpen(open: boolean) {
  await prisma.academyConfig.upsert({ where: { key: OPEN_KEY }, create: { key: OPEN_KEY, value: open }, update: { value: open } });
}

/** The Bungee track's published lessons, in order. */
export async function bungeeModules() {
  await ensureSeeded();
  const cat = await prisma.academyCategory.findUnique({
    where: { slug: BUNGEE_CATEGORY },
    select: { id: true, modules: { where: { published: true }, orderBy: { order: "asc" }, select: { id: true, slug: true, title: true } } },
  });
  return { categoryId: cat?.id ?? null, modules: cat?.modules ?? [] };
}

/**
 * Live quizzes that are about Bungee: any live quiz whose question set was
 * drawn from the Bungee track. Identified by the questions themselves, so a
 * host does not have to follow a naming convention.
 */
export async function bungeeLives(categoryId: string | null) {
  if (!categoryId) return [];
  const [qs, lives] = await Promise.all([
    prisma.academyQuestion.findMany({ where: { categoryId }, select: { id: true } }),
    prisma.academyLive.findMany({
      where: { status: { not: "cancelled" }, scheduledAt: { gte: new Date(Date.now() - 120 * 86_400_000) } },
      orderBy: { scheduledAt: "asc" },
      take: 300,
    }),
  ]);
  const ids = new Set(qs.map((q) => q.id));
  return lives.filter((l) => l.questionIds.some((id) => ids.has(id)));
}

/** Where /bungee/live should send people: the Bungee quiz on now, else the next one, else the latest. */
export async function currentBungeeLiveId(now = Date.now()): Promise<string | null> {
  const { categoryId } = await bungeeModules();
  const lives = await bungeeLives(categoryId);
  let next: { id: string; at: number } | null = null;
  let last: { id: string; at: number } | null = null;
  for (const l of lives) {
    const phase = livePhase(
      {
        status: l.status,
        scheduledAt: l.scheduledAt.getTime(),
        startedAt: l.startedAt?.getTime() ?? null,
        pausedAt: l.pausedAt?.getTime() ?? null,
        pausedMs: l.pausedMs,
        questionSec: l.questionSec,
        revealSec: l.revealSec,
        count: l.questionIds.length,
      },
      now
    );
    const at = l.scheduledAt.getTime();
    if (phase.kind === "countdown" || phase.kind === "question" || phase.kind === "reveal") return l.id;
    if (phase.kind === "scheduled" && (!next || at < next.at)) next = { id: l.id, at };
    if (phase.kind === "ended" && (!last || at > last.at)) last = { id: l.id, at };
  }
  return next?.id ?? last?.id ?? null;
}

// ------------------------------------------------------------------ member view

export async function myStatus(userId: string) {
  const { categoryId, modules } = await bungeeModules();
  const [progress, lives, entry, open] = await Promise.all([
    prisma.academyProgress.findMany({ where: { userId, moduleId: { in: modules.map((m) => m.id) } }, select: { moduleId: true, score: true } }),
    bungeeLives(categoryId),
    prisma.giveawayEntry.findUnique({ where: { campaign_userId: { campaign: BUNGEE_CAMPAIGN, userId } } }),
    isOpen(),
  ]);
  const done = new Map(progress.map((p) => [p.moduleId, p.score]));
  const seats = lives.length
    ? await prisma.academyLiveParticipant.findMany({ where: { userId, liveId: { in: lives.map((l) => l.id) } }, select: { score: true, correct: true } })
    : [];
  return {
    open,
    lessons: {
      total: modules.length,
      done: modules.filter((m) => done.has(m.id)).length,
      list: modules.map((m) => ({ slug: m.slug, title: m.title, done: done.has(m.id), score: done.get(m.id) ?? null })),
    },
    live: {
      held: lives.length,
      played: seats.length,
      score: seats.reduce((a, s) => a + s.score, 0),
      correct: seats.reduce((a, s) => a + s.correct, 0),
    },
    entry: entry
      ? { bungeeUid: entry.bungeeUid, bungeeEmail: entry.bungeeEmail, telegram: entry.telegram, hasProof: !!entry.proofUrl, status: entry.status, updatedAt: entry.updatedAt.toISOString() }
      : null,
  };
}

/**
 * Everything that can refuse an entry without looking at the form: closed,
 * lessons incomplete, already reviewed. Run BEFORE the screenshot is uploaded,
 * so a refused entry never stores an image (and gets the right message).
 */
export async function assertCanEnter(userId: string) {
  if (!(await isOpen())) throw new QuizError("Entries for this giveaway are closed.", 409);
  const status = await myStatus(userId);
  if (status.lessons.total === 0) throw new QuizError("The Bungee lessons are not available yet. Try again shortly.", 503);
  if (status.lessons.done < status.lessons.total) {
    throw new QuizError(`Complete all ${status.lessons.total} Bungee lessons first (${status.lessons.done} done). Pass each lesson's knowledge check to complete it.`, 409);
  }
  const existing = await prisma.giveawayEntry.findUnique({ where: { campaign_userId: { campaign: BUNGEE_CAMPAIGN, userId } } });
  if (existing && (existing.status === "winner" || existing.status === "rejected")) throw new QuizError("Your entry has already been reviewed and can no longer be edited.", 409);
  return existing;
}

export async function submitEntry(userId: string, input: EntryInput, meta: { ip: string; ua: string }, proofUrl: string | null) {
  const existing = await assertCanEnter(userId);
  if (!proofUrl && !existing?.proofUrl) throw new QuizError("Add the screenshot showing your completed lessons.", 400);
  const data = {
    bungeeUid: input.bungeeUid,
    bungeeEmail: input.bungeeEmail,
    telegram: input.telegram,
    ipHash: fingerprint(meta.ip),
    uaHash: fingerprint(meta.ua),
    ...(proofUrl ? { proofUrl } : {}),
  };
  try {
    const row = existing
      ? await prisma.giveawayEntry.update({ where: { id: existing.id }, data })
      : await prisma.giveawayEntry.create({ data: { campaign: BUNGEE_CAMPAIGN, userId, ...data } });
    return { id: row.id, updated: !!existing };
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") throw new QuizError("That Bungee UID is already entered by another account.", 409);
    throw err;
  }
}

// ------------------------------------------------------------------ staff view

export const STATUSES = ["pending", "verified", "winner", "rejected"] as const;
export type EntryStatus = (typeof STATUSES)[number];

export async function listEntries() {
  const { categoryId, modules } = await bungeeModules();
  const [entries, lives, open] = await Promise.all([
    prisma.giveawayEntry.findMany({
      where: { campaign: BUNGEE_CAMPAIGN },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, name: true, username: true, email: true, createdAt: true } } },
    }),
    bungeeLives(categoryId),
    isOpen(),
  ]);
  const userIds = entries.map((e) => e.userId);
  const liveIds = lives.map((l) => l.id);
  const [progress, seats, fast] = await Promise.all([
    prisma.academyProgress.groupBy({ by: ["userId"], where: { userId: { in: userIds }, moduleId: { in: modules.map((m) => m.id) } }, _count: { _all: true } }),
    liveIds.length
      ? prisma.academyLiveParticipant.findMany({ where: { userId: { in: userIds }, liveId: { in: liveIds } }, select: { userId: true, score: true, correct: true, blurs: true } })
      : Promise.resolve([]),
    liveIds.length
      ? prisma.academyLiveAnswer.groupBy({ by: ["userId"], where: { userId: { in: userIds }, liveId: { in: liveIds }, ms: { lt: MIN_HUMAN_ANSWER_MS } }, _count: { _all: true } })
      : Promise.resolve([]),
  ]);
  const lessons = new Map(progress.map((p) => [p.userId, p._count._all]));
  const fastBy = new Map(fast.map((f) => [f.userId, f._count._all]));
  const liveBy = new Map<string, { played: number; score: number; correct: number; blurs: number }>();
  for (const s of seats) {
    const v = liveBy.get(s.userId) ?? { played: 0, score: 0, correct: 0, blurs: 0 };
    v.played += 1;
    v.score += s.score;
    v.correct += s.correct;
    v.blurs += s.blurs;
    liveBy.set(s.userId, v);
  }
  const count = (key: "ipHash" | "uaHash") => {
    const m = new Map<string, number>();
    for (const e of entries) if (e[key]) m.set(e[key], (m.get(e[key]) ?? 0) + 1);
    return m;
  };
  const ipCount = count("ipHash");
  const uaCount = count("uaHash");
  return {
    open,
    totalLessons: modules.length,
    liveHeld: lives.length,
    entries: entries.map((e) => {
      const live = liveBy.get(e.userId) ?? { played: 0, score: 0, correct: 0, blurs: 0 };
      return {
        id: e.id,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
        status: e.status,
        note: e.note,
        bungeeUid: e.bungeeUid,
        bungeeEmail: e.bungeeEmail,
        telegram: e.telegram,
        proofUrl: e.proofUrl,
        user: { id: e.user.id, name: e.user.name, username: e.user.username, email: e.user.email, joinedAt: e.user.createdAt.toISOString() },
        lessonsDone: lessons.get(e.userId) ?? 0,
        live,
        flags: {
          sameNetwork: e.ipHash ? (ipCount.get(e.ipHash) ?? 1) - 1 : 0,
          sameBrowser: e.uaHash ? (uaCount.get(e.uaHash) ?? 1) - 1 : 0,
          fastAnswers: fastBy.get(e.userId) ?? 0,
          tabSwitches: live.blurs,
          newAccount: e.createdAt.getTime() - e.user.createdAt.getTime() < 86_400_000,
        },
      };
    }),
  };
}

export async function setEntryStatus(id: string, status: EntryStatus, note?: string) {
  return prisma.giveawayEntry.update({ where: { id }, data: { status, ...(note != null ? { note: note.slice(0, 500) } : {}) }, select: { id: true, status: true, note: true } });
}
