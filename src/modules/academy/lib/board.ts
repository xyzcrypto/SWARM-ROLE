import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publicImageUrl } from "@/lib/utils";
import { loadConfig } from "./store";
import { certificateCode, certificateTitle, levelFor, periodBounds, previousPeriod, type Period } from "./engine";
import type { AwardKind } from "./config";
import { checkAchievements, pingBoards } from "./xp";

export const PAGE_SIZE = 25;

export type BoardRow = {
  rank: number;
  userId: string;
  name: string;
  username: string | null;
  image: string | null;
  xp: number;
  quizzes: number;
  accuracy: number | null;
  level: number;
  levelName: string;
  movement: number | null; // + moved up, - moved down, null = new / unknown
};

type Bounds = { key: string; start: number; end: number };

const userSelect = { id: true, name: true, username: true, image: true } as const;

function displayName(u: { name: string | null; username: string | null }) {
  return u.name?.trim() || (u.username ? `@${u.username}` : "XYZ Learner");
}

/** Rank for a given XP total in a board: 1 + how many members are strictly ahead. */
async function rankOf(period: Period, b: Bounds, xp: number): Promise<number> {
  if (period === "alltime") return (await prisma.academyProfile.count({ where: { xp: { gt: xp } } })) + 1;
  const rows = await prisma.$queryRaw<{ n: bigint }[]>(Prisma.sql`
    SELECT COUNT(*)::bigint AS n FROM (
      SELECT "userId" FROM "AcademyXp"
      WHERE "createdAt" >= ${new Date(b.start)} AND "createdAt" < ${new Date(b.end)}
      GROUP BY "userId" HAVING SUM(amount) > ${xp}
    ) t`);
  return Number(rows[0]?.n ?? 0) + 1;
}

async function boardSize(period: Period, b: Bounds): Promise<number> {
  if (period === "alltime") return prisma.academyProfile.count({ where: { xp: { gt: 0 } } });
  const rows = await prisma.$queryRaw<{ n: bigint }[]>(Prisma.sql`
    SELECT COUNT(DISTINCT "userId")::bigint AS n FROM "AcademyXp"
    WHERE "createdAt" >= ${new Date(b.start)} AND "createdAt" < ${new Date(b.end)}`);
  return Number(rows[0]?.n ?? 0);
}

/** XP per member for a page of a board, ordered. */
async function xpPage(period: Period, b: Bounds, skip: number, take: number): Promise<{ userId: string; xp: number }[]> {
  if (period === "alltime") {
    const rows = await prisma.academyProfile.findMany({
      where: { xp: { gt: 0 } },
      orderBy: [{ xp: "desc" }, { updatedAt: "asc" }],
      skip,
      take,
      select: { userId: true, xp: true },
    });
    return rows;
  }
  const rows = await prisma.academyXp.groupBy({
    by: ["userId"],
    where: { createdAt: { gte: new Date(b.start), lt: new Date(b.end) } },
    _sum: { amount: true },
    orderBy: [{ _sum: { amount: "desc" } }, { userId: "asc" }],
    skip,
    take,
  });
  return rows.map((r) => ({ userId: r.userId, xp: r._sum.amount ?? 0 })).filter((r) => r.xp > 0);
}

/** Quizzes and accuracy, all-time from the profile, per period from the raw rows. */
async function statsFor(period: Period, b: Bounds, ids: string[]) {
  const out = new Map<string, { quizzes: number; answered: number; correct: number; xpAll: number }>();
  if (!ids.length) return out;
  const profiles = await prisma.academyProfile.findMany({ where: { userId: { in: ids } }, select: { userId: true, quizzes: true, answered: true, correct: true, xp: true } });
  for (const p of profiles) out.set(p.userId, { quizzes: p.quizzes, answered: p.answered, correct: p.correct, xpAll: p.xp });
  if (period === "alltime") return out;
  const range = { gte: new Date(b.start), lt: new Date(b.end) };
  const [quizzes, answered, correct] = await Promise.all([
    prisma.academyAttempt.groupBy({ by: ["userId"], where: { userId: { in: ids }, status: "done", finishedAt: range }, _count: { _all: true } }),
    prisma.academyAnswer.groupBy({ by: ["userId"], where: { userId: { in: ids }, createdAt: range }, _count: { _all: true } }),
    prisma.academyAnswer.groupBy({ by: ["userId"], where: { userId: { in: ids }, createdAt: range, correct: true }, _count: { _all: true } }),
  ]);
  const q = new Map(quizzes.map((r) => [r.userId, r._count._all]));
  const a = new Map(answered.map((r) => [r.userId, r._count._all]));
  const c = new Map(correct.map((r) => [r.userId, r._count._all]));
  for (const id of ids) out.set(id, { quizzes: q.get(id) ?? 0, answered: a.get(id) ?? 0, correct: c.get(id) ?? 0, xpAll: out.get(id)?.xpAll ?? 0 });
  return out;
}

const SNAP_EVERY_MS = 60 * 60_000;

/**
 * Rank movement: the board's ranks are snapshotted at most once an hour, and a
 * row's arrow is the difference from the snapshot before the current one.
 */
async function movementFor(period: Period, b: Bounds, top: { userId: string }[]): Promise<Map<string, number | null>> {
  const key = `${period}:${b.key}`;
  const snap = await prisma.academyBoardSnap.findUnique({ where: { key } }).catch(() => null);
  const current = Object.fromEntries(top.map((r, i) => [r.userId, i + 1]));
  if (!snap || Date.now() - snap.takenAt.getTime() > SNAP_EVERY_MS) {
    await prisma.academyBoardSnap
      .upsert({
        where: { key },
        create: { key, ranks: current, prevRanks: {} },
        update: { prevRanks: (snap?.ranks as object) ?? {}, ranks: current, takenAt: new Date() },
      })
      .catch(() => null);
  }
  const prev = ((snap && Date.now() - snap.takenAt.getTime() > SNAP_EVERY_MS ? snap.ranks : snap?.prevRanks) ?? {}) as Record<string, number>;
  return new Map(top.map((r, i) => [r.userId, prev[r.userId] ? prev[r.userId] - (i + 1) : null]));
}

export async function getBoard(period: Period, page = 1, now = Date.now()) {
  const cfg = await loadConfig();
  const b = periodBounds(period, now);
  const skip = (Math.max(1, page) - 1) * PAGE_SIZE;
  const [rows, size] = await Promise.all([xpPage(period, b, skip, PAGE_SIZE), boardSize(period, b)]);
  const ids = rows.map((r) => r.userId);
  const [users, stats, moves] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids } }, select: userSelect }),
    statsFor(period, b, ids),
    page === 1 ? movementFor(period, b, (await xpPage(period, b, 0, 100)).map((r) => ({ userId: r.userId }))) : Promise.resolve(new Map<string, number | null>()),
  ]);
  const byId = new Map(users.map((u) => [u.id, u]));
  const out: BoardRow[] = rows.map((r, i) => {
    const u = byId.get(r.userId);
    const s = stats.get(r.userId);
    const lvl = levelFor(s?.xpAll ?? r.xp, cfg.levels);
    return {
      rank: skip + i + 1,
      userId: r.userId,
      name: u ? displayName(u) : "XYZ Learner",
      username: u?.username ?? null,
      image: publicImageUrl(u?.image ?? null, u?.id),
      xp: r.xp,
      quizzes: s?.quizzes ?? 0,
      accuracy: s && s.answered ? Math.round((s.correct / s.answered) * 100) : null,
      level: lvl.level,
      levelName: lvl.name,
      movement: moves.get(r.userId) ?? null,
    };
  });
  return { period, key: b.key, start: b.start, end: b.end, page, pageSize: PAGE_SIZE, size, rows: out };
}

/** Find members by name/handle and say where they stand on a board. */
export async function searchBoard(period: Period, q: string, now = Date.now()) {
  const term = q.trim().replace(/^@/, "").slice(0, 40);
  if (term.length < 2) return [];
  const cfg = await loadConfig();
  const b = periodBounds(period, now);
  const users = await prisma.user.findMany({
    where: {
      OR: [{ username: { contains: term, mode: "insensitive" } }, { name: { contains: term, mode: "insensitive" } }],
      academyProfile: { isNot: null },
    },
    select: userSelect,
    take: 8,
  });
  const out: BoardRow[] = [];
  for (const u of users) {
    const xp = await myXp(period, b, u.id);
    if (xp <= 0) continue;
    const s = (await statsFor(period, b, [u.id])).get(u.id);
    const lvl = levelFor(s?.xpAll ?? xp, cfg.levels);
    out.push({
      rank: await rankOf(period, b, xp),
      userId: u.id,
      name: displayName(u),
      username: u.username,
      image: publicImageUrl(u.image, u.id),
      xp,
      quizzes: s?.quizzes ?? 0,
      accuracy: s && s.answered ? Math.round((s.correct / s.answered) * 100) : null,
      level: lvl.level,
      levelName: lvl.name,
      movement: null,
    });
  }
  return out.sort((x, y) => x.rank - y.rank);
}

async function myXp(period: Period, b: Bounds, userId: string): Promise<number> {
  if (period === "alltime") return (await prisma.academyProfile.findUnique({ where: { userId }, select: { xp: true } }))?.xp ?? 0;
  const r = await prisma.academyXp.aggregate({ where: { userId, createdAt: { gte: new Date(b.start), lt: new Date(b.end) } }, _sum: { amount: true } });
  return r._sum.amount ?? 0;
}

/** The signed-in member's position on every board. */
export async function myStanding(userId: string, now = Date.now()) {
  const out: Record<string, { rank: number | null; xp: number; size: number }> = {};
  for (const p of ["daily", "weekly", "monthly", "alltime"] as Period[]) {
    const b = periodBounds(p, now);
    const xp = await myXp(p, b, userId);
    out[p] = { xp, rank: xp > 0 ? await rankOf(p, b, xp) : null, size: await boardSize(p, b) };
  }
  return out;
}

// ------------------------------------------------------------------ certificates

export async function issueCertificate(input: {
  userId: string;
  kind: string;
  periodKey: string;
  rank: number;
  score: number;
  status?: "issued" | "pending";
  issuedById?: string | null;
  title?: string;
}) {
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { name: true, username: true } });
  if (!user) return null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = certificateCode(randomBytes(8));
    try {
      const { count } = await prisma.academyCertificate.createMany({
        data: [
          {
            code,
            userId: input.userId,
            kind: input.kind,
            periodKey: input.periodKey,
            title: input.title?.trim() || certificateTitle(input.kind),
            displayName: displayName(user),
            rank: input.rank,
            score: input.score,
            status: input.status ?? "issued",
            issuedById: input.issuedById ?? null,
          },
        ],
        // (kind, periodKey, userId) is unique: a second finalization is a no-op.
        skipDuplicates: true,
      });
      if (!count) return prisma.academyCertificate.findUnique({ where: { kind_periodKey_userId: { kind: input.kind, periodKey: input.periodKey, userId: input.userId } } });
      return prisma.academyCertificate.findUnique({ where: { code } });
    } catch (err) {
      if ((err as { code?: string })?.code !== "P2002") throw err; // code collision: draw again
    }
  }
  throw new Error("Could not allocate a certificate code");
}

let lastFinalize = 0;

/**
 * Close any finished daily/weekly/monthly period that has not been closed yet:
 * pick its winners by the award rules and create their certificates. Runs from
 * the leaderboard route in the background and from the admin button - there is
 * no cron (crons are paused on this project's plan), so the first request after
 * a period ends does it. AcademyPeriodClose's primary key makes it exactly-once.
 */
export async function finalizeDuePeriods(now = Date.now(), force = false) {
  if (!force && now - lastFinalize < 5 * 60_000) return [];
  lastFinalize = now;
  const cfg = await loadConfig();
  const closed: string[] = [];
  const kinds: { kind: AwardKind; period: "daily" | "weekly" | "monthly"; back: number }[] = [
    { kind: "daily", period: "daily", back: 7 },
    { kind: "weekly", period: "weekly", back: 4 },
    { kind: "monthly", period: "monthly", back: 2 },
  ];
  for (const { kind, period, back } of kinds) {
    const rule = cfg.awards[kind];
    let t = now;
    for (let i = 0; i < back; i++) {
      const b = previousPeriod(period, t);
      t = b.start;
      const key = `${kind}:${b.key}`;
      const done = await prisma.academyPeriodClose.findUnique({ where: { key }, select: { key: true } });
      if (done) break; // older periods were closed before this one
      // Nobody was active at all: nothing to award, still mark it closed.
      const top = rule.top > 0 ? await xpPage(period, b, 0, rule.top) : [];
      const winners = top.filter((w) => w.xp >= rule.minXp).map((w, idx) => ({ userId: w.userId, xp: w.xp, rank: idx + 1 }));
      const { count } = await prisma.academyPeriodClose.createMany({ data: [{ key, winners }], skipDuplicates: true });
      if (!count) break; // another instance just closed it
      for (const w of winners) {
        await issueCertificate({ userId: w.userId, kind, periodKey: b.key, rank: w.rank, score: w.xp, status: rule.auto ? "issued" : "pending" });
        if (rule.auto) await checkAchievements(w.userId, cfg).catch(() => []);
      }
      closed.push(key);
    }
  }
  if (closed.length) await pingBoards("certificate");
  return closed;
}

// ------------------------------------------------------------------ community pulse

export async function getPulse(now = Date.now()) {
  const dayStart = new Date(periodBounds("daily", now).start);
  const [learningNow, quizzesToday, liveRows, achievements, certificates, top] = await Promise.all([
    prisma.academyAnswer.findMany({ where: { createdAt: { gte: new Date(now - 10 * 60_000) } }, distinct: ["userId"], select: { userId: true }, take: 500 }),
    prisma.academyAttempt.count({ where: { status: "done", finishedAt: { gte: dayStart } } }),
    prisma.academyLive.findMany({ where: { status: "live" }, select: { id: true, _count: { select: { participants: true } } } }),
    prisma.academyAchievement.findMany({ orderBy: { earnedAt: "desc" }, take: 6, select: { code: true, earnedAt: true, user: { select: userSelect } } }),
    prisma.academyCertificate.findMany({
      where: { status: "issued" },
      orderBy: { issuedAt: "desc" },
      take: 4,
      select: { code: true, title: true, displayName: true, rank: true, issuedAt: true },
    }),
    getBoard("weekly", 1, now).then((b) => b.rows.slice(0, 5)),
  ]);
  const cfg = await loadConfig();
  const titles = new Map(cfg.achievements.map((a) => [a.code, a.title]));
  return {
    learningNow: learningNow.length,
    quizzesToday,
    liveNow: liveRows.length,
    liveParticipants: liveRows.reduce((s, l) => s + l._count.participants, 0),
    achievements: achievements.map((a) => ({
      title: titles.get(a.code as never) ?? a.code,
      at: a.earnedAt.toISOString(),
      name: displayName(a.user),
      image: publicImageUrl(a.user.image, a.user.id),
    })),
    certificates: certificates.map((c) => ({ ...c, issuedAt: c.issuedAt.toISOString() })),
    top,
  };
}
