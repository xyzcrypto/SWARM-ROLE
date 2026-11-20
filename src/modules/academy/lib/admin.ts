import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { publicImageUrl } from "@/lib/utils";
import { DIFFICULTIES, DEFAULT_CONFIG, type AcademyConfigShape } from "./config";
import { moduleInput, questionInput } from "./content-schema";
import { ensureSeeded, loadConfig, saveConfig } from "./store";
import { finalizeDuePeriods, issueCertificate } from "./board";
import { createLive, hostLive } from "./live";
import { periodBounds, levelFor } from "./engine";
import { checkAchievements, grant, pingBoards } from "./xp";
import { QuizError } from "./quiz";

const slug = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes");

const levelsSchema = z.array(z.object({ name: z.string().trim().min(1).max(40), xp: z.number().int().min(0).max(10_000_000) })).min(2).max(20);
const awardRule = z.object({ top: z.number().int().min(0).max(10), minXp: z.number().int().min(0).max(1_000_000), auto: z.boolean() });
const nonNeg = z.number().min(0).max(100_000);

const configSchemas: Record<keyof AcademyConfigShape, z.ZodTypeAny> = {
  xp: z
    .object({
      base: z.record(z.enum(DIFFICULTIES as [string, ...string[]]), z.number().int().min(0).max(10_000)),
      speedBonus: z.number().min(0).max(2),
      streakFrom: z.number().int().min(1).max(20),
      streakStep: z.number().min(0).max(1),
      streakCap: z.number().min(0).max(3),
      scoreToXp: z.number().min(1).max(1000),
      seconds: z.record(z.enum(DIFFICULTIES as [string, ...string[]]), z.number().int().min(5).max(300)),
      modeBonus: z.record(z.string(), nonNeg),
      perfectBonus: z.number().min(0).max(5),
      dailyQuizCap: z.number().int().min(0).max(1_000_000),
      repeatCooldownDays: z.number().int().min(0).max(365),
      module: nonNeg,
      modulePass: z.number().int().min(0).max(100),
      streakDay: nonNeg,
      streakMilestones: z.record(z.string().regex(/^\d+$/), nonNeg),
      livePerPoint: z.number().min(0).max(10),
      livePodium: z.tuple([nonNeg, nonNeg, nonNeg]),
    })
    .partial(),
  levels: levelsSchema,
  awards: z.object({ daily: awardRule, weekly: awardRule, monthly: awardRule, live: awardRule }).partial(),
  achievements: z.array(z.object({ code: z.string(), title: z.string().max(60).optional(), description: z.string().max(140).optional(), xp: z.number().int().min(0).max(10_000).optional(), enabled: z.boolean().optional() })),
};

export const adminOp = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("category.save"),
    id: z.string().optional(),
    slug,
    title: z.string().trim().min(2).max(80),
    tagline: z.string().trim().max(140).default(""),
    icon: z.string().trim().max(40).default("BookOpen"),
    order: z.number().int().min(0).max(999).default(0),
    published: z.boolean().default(true),
  }),
  z.object({ op: z.literal("category.delete"), id: z.string() }),
  z.object({
    op: z.literal("module.save"),
    id: z.string().optional(),
    categoryId: z.string(),
    order: z.number().int().min(0).max(999).default(0),
    published: z.boolean().default(true),
    data: moduleInput,
  }),
  z.object({ op: z.literal("module.delete"), id: z.string() }),
  z.object({
    op: z.literal("question.save"),
    id: z.string().optional(),
    categoryId: z.string(),
    moduleId: z.string().nullable().optional(),
    active: z.boolean().default(true),
    data: questionInput,
  }),
  z.object({ op: z.literal("question.delete"), id: z.string() }),
  z.object({ op: z.literal("config.save"), key: z.enum(["xp", "levels", "awards", "achievements"]), value: z.unknown() }),
  z.object({ op: z.literal("config.reset"), key: z.enum(["xp", "levels", "awards", "achievements"]) }),
  z.object({
    op: z.literal("live.create"),
    title: z.string().trim().min(3).max(100),
    description: z.string().trim().max(300).default(""),
    scheduledAt: z.number().int(),
    count: z.number().int().min(3).max(30),
    category: z.string().nullable().optional(),
    difficulty: z.enum(["mixed", ...DIFFICULTIES] as [string, ...string[]]).default("mixed"),
    questionSec: z.number().int().min(8).max(90).default(20),
    revealSec: z.number().int().min(3).max(30).default(7),
  }),
  z.object({ op: z.literal("live.host"), id: z.string(), action: z.enum(["start", "pause", "resume", "end", "cancel"]) }),
  z.object({
    op: z.literal("cert.issue"),
    user: z.string().trim().min(2).max(80), // user id, @handle or email
    kind: z.enum(["event", "milestone", "daily", "weekly", "monthly", "live"]),
    title: z.string().trim().max(80).optional(),
    periodKey: z.string().trim().min(2).max(60),
    rank: z.number().int().min(1).max(1000).default(1),
    score: z.number().int().min(0).max(10_000_000).default(0),
  }),
  z.object({ op: z.literal("cert.status"), id: z.string(), status: z.enum(["issued", "revoked"]) }),
  z.object({ op: z.literal("xp.grant"), user: z.string().trim().min(2).max(80), amount: z.number().int().min(1).max(100_000), note: z.string().trim().min(2).max(120) }),
  z.object({ op: z.literal("finalize") }),
  z.object({ op: z.literal("seed") }),
]);

export type AdminOp = z.infer<typeof adminOp>;

async function findUser(ref: string) {
  const r = ref.trim().replace(/^@/, "");
  return prisma.user.findFirst({ where: { OR: [{ id: r }, { username: r.toLowerCase() }, { email: r.toLowerCase() }] }, select: { id: true, name: true, username: true } });
}

function revalidateAcademy() {
  try {
    revalidatePath("/academy/learn", "layout");
  } catch {
    /* outside a request scope (tests) */
  }
}

async function audit(actorId: string, action: string, detail: unknown, targetId?: string | null) {
  await prisma.adminAudit
    .create({ data: { actorId, action: `academy.${action}`, targetId: targetId ?? null, detail: JSON.stringify(detail).slice(0, 500) } })
    .catch(() => null);
}

export async function runAdminOp(actorId: string, op: AdminOp) {
  switch (op.op) {
    case "category.save": {
      const data = { slug: op.slug, title: op.title, tagline: op.tagline, icon: op.icon, order: op.order, published: op.published };
      const row = op.id ? await prisma.academyCategory.update({ where: { id: op.id }, data }) : await prisma.academyCategory.create({ data });
      revalidateAcademy();
      await audit(actorId, op.op, { slug: op.slug });
      return { id: row.id };
    }
    case "category.delete": {
      await prisma.academyCategory.delete({ where: { id: op.id } });
      revalidateAcademy();
      await audit(actorId, op.op, { id: op.id });
      return { ok: true };
    }
    case "module.save": {
      const d = op.data;
      const data = {
        categoryId: op.categoryId,
        slug: d.slug,
        level: d.level,
        title: d.title,
        summary: d.summary,
        minutes: d.minutes,
        objectives: d.objectives,
        sections: d.sections,
        concepts: d.concepts,
        example: d.example ?? undefined,
        order: op.order,
        published: op.published,
      };
      const row = op.id ? await prisma.academyModule.update({ where: { id: op.id }, data }) : await prisma.academyModule.create({ data });
      revalidateAcademy();
      await audit(actorId, op.op, { slug: d.slug });
      return { id: row.id };
    }
    case "module.delete": {
      await prisma.academyModule.delete({ where: { id: op.id } });
      revalidateAcademy();
      await audit(actorId, op.op, { id: op.id });
      return { ok: true };
    }
    case "question.save": {
      const d = op.data;
      const data = {
        categoryId: op.categoryId,
        moduleId: op.moduleId ?? null,
        difficulty: d.difficulty,
        prompt: d.prompt,
        options: d.options,
        answer: d.answer,
        explanation: d.explanation,
        active: op.active,
      };
      const row = op.id ? await prisma.academyQuestion.update({ where: { id: op.id }, data }) : await prisma.academyQuestion.create({ data });
      await audit(actorId, op.op, { id: row.id });
      return { id: row.id };
    }
    case "question.delete": {
      // Answer history keeps the question id; deactivating keeps reviews readable.
      const used = await prisma.academyAnswer.findFirst({ where: { questionId: op.id }, select: { id: true } });
      if (used) await prisma.academyQuestion.update({ where: { id: op.id }, data: { active: false } });
      else await prisma.academyQuestion.delete({ where: { id: op.id } });
      await audit(actorId, op.op, { id: op.id, archived: !!used });
      return { ok: true, archived: !!used };
    }
    case "config.save": {
      const parsed = configSchemas[op.key].safeParse(op.value);
      if (!parsed.success) throw new QuizError(parsed.error.issues[0]?.message ?? "Invalid settings.", 400);
      let value = parsed.data;
      if (op.key === "levels") value = [...(value as { xp: number }[])].sort((a, b) => a.xp - b.xp).map((l, i) => (i === 0 ? { ...l, xp: 0 } : l));
      await saveConfig(op.key, value);
      await audit(actorId, op.op, { key: op.key });
      return { config: await loadConfig() };
    }
    case "config.reset": {
      await prisma.academyConfig.deleteMany({ where: { key: op.key } });
      await saveConfig(op.key, DEFAULT_CONFIG[op.key]);
      await audit(actorId, op.op, { key: op.key });
      return { config: await loadConfig() };
    }
    case "live.create": {
      if (op.scheduledAt < Date.now() - 60_000) throw new QuizError("Pick a time in the future.", 400);
      const row = await createLive({ ...op, difficulty: op.difficulty as never, createdById: actorId });
      await audit(actorId, op.op, { id: row.id, title: op.title });
      await pingBoards("xp");
      return { id: row.id };
    }
    case "live.host": {
      await hostLive(op.id, op.action);
      await audit(actorId, op.op, { id: op.id, action: op.action });
      return { ok: true };
    }
    case "cert.issue": {
      const user = await findUser(op.user);
      if (!user) throw new QuizError("No member matches that id, @handle or email.", 404);
      const cert = await issueCertificate({ userId: user.id, kind: op.kind, periodKey: op.periodKey, rank: op.rank, score: op.score, issuedById: actorId, title: op.title });
      await checkAchievements(user.id, await loadConfig()).catch(() => []);
      await pingBoards("certificate");
      await audit(actorId, op.op, { code: cert?.code, kind: op.kind }, user.id);
      return { code: cert?.code };
    }
    case "cert.status": {
      const cert = await prisma.academyCertificate.update({ where: { id: op.id }, data: { status: op.status, ...(op.status === "issued" ? { issuedById: actorId } : {}) } });
      if (op.status === "issued") await checkAchievements(cert.userId, await loadConfig()).catch(() => []);
      try {
        revalidatePath(`/academy/certificate/${cert.code}`);
      } catch {
        /* ignore */
      }
      await audit(actorId, op.op, { code: cert.code, status: op.status }, cert.userId);
      return { ok: true };
    }
    case "xp.grant": {
      const user = await findUser(op.user);
      if (!user) throw new QuizError("No member matches that id, @handle or email.", 404);
      await prisma.$transaction(async (tx) => {
        await grant(tx, { userId: user.id, amount: op.amount, reason: "admin", key: `admin:${randomUUID()}`, label: op.note });
      });
      await pingBoards("xp");
      await audit(actorId, op.op, { amount: op.amount, note: op.note }, user.id);
      return { ok: true };
    }
    case "finalize":
      return { closed: await finalizeDuePeriods(Date.now(), true) };
    case "seed":
      return ensureSeeded(true);
  }
}

/** Data for the admin screen. */
export async function adminOverview() {
  await ensureSeeded();
  const now = Date.now();
  const day = new Date(periodBounds("daily", now).start);
  const week = new Date(now - 7 * 86_400_000);
  const [categories, learners, quizzesToday, quizzesWeek, answersWeek, correctWeek, xpWeek, pendingCerts, certs, live, top, config] = await Promise.all([
    prisma.academyCategory.findMany({
      orderBy: [{ order: "asc" }, { title: "asc" }],
      include: {
        modules: { orderBy: { order: "asc" }, include: { _count: { select: { questions: true, progress: true } } } },
        _count: { select: { questions: true } },
      },
    }),
    prisma.academyProfile.count(),
    prisma.academyAttempt.count({ where: { status: "done", finishedAt: { gte: day } } }),
    prisma.academyAttempt.count({ where: { status: "done", finishedAt: { gte: week } } }),
    prisma.academyAnswer.count({ where: { createdAt: { gte: week } } }),
    prisma.academyAnswer.count({ where: { createdAt: { gte: week }, correct: true } }),
    prisma.academyXp.aggregate({ where: { createdAt: { gte: week } }, _sum: { amount: true } }),
    prisma.academyCertificate.count({ where: { status: "pending" } }),
    prisma.academyCertificate.findMany({
      orderBy: { issuedAt: "desc" },
      take: 60,
      select: { id: true, code: true, title: true, kind: true, periodKey: true, rank: true, score: true, status: true, displayName: true, issuedAt: true },
    }),
    prisma.academyLive.findMany({ orderBy: { scheduledAt: "desc" }, take: 30, include: { _count: { select: { participants: true } } } }),
    prisma.academyProfile.findMany({ orderBy: { xp: "desc" }, take: 20, include: { user: { select: { id: true, name: true, username: true, email: true, image: true } } } }),
    loadConfig(),
  ]);
  return {
    stats: {
      learners,
      quizzesToday,
      quizzesWeek,
      answersWeek,
      accuracyWeek: answersWeek ? Math.round((correctWeek / answersWeek) * 100) : null,
      xpWeek: xpWeek._sum.amount ?? 0,
      pendingCerts,
      questions: categories.reduce((s, c) => s + c._count.questions, 0),
    },
    categories: categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      tagline: c.tagline,
      icon: c.icon,
      order: c.order,
      published: c.published,
      questions: c._count.questions,
      modules: c.modules.map((m) => ({ id: m.id, slug: m.slug, level: m.level, title: m.title, published: m.published, order: m.order, questions: m._count.questions, completions: m._count.progress })),
    })),
    certificates: certs.map((c) => ({ ...c, issuedAt: c.issuedAt.toISOString() })),
    live: live.map((l) => ({ id: l.id, title: l.title, status: l.status, scheduledAt: l.scheduledAt.toISOString(), questions: l.questionIds.length, participants: l._count.participants, paused: !!l.pausedAt, startedAt: l.startedAt?.toISOString() ?? null })),
    top: top.map((p) => ({
      userId: p.userId,
      name: p.user.name || (p.user.username ? `@${p.user.username}` : p.user.email),
      username: p.user.username,
      image: publicImageUrl(p.user.image, p.user.id),
      xp: p.xp,
      level: levelFor(p.xp, config.levels).level,
      quizzes: p.quizzes,
      accuracy: p.answered ? Math.round((p.correct / p.answered) * 100) : null,
      streak: p.streak,
    })),
    config,
  };
}

export async function adminModule(id: string) {
  return prisma.academyModule.findUnique({ where: { id } });
}

export async function adminQuestions(categoryId: string, moduleId?: string | null) {
  return prisma.academyQuestion.findMany({
    where: { categoryId, ...(moduleId ? { moduleId } : {}) },
    orderBy: [{ active: "desc" }, { difficulty: "asc" }, { createdAt: "asc" }],
  });
}
