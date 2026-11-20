import "server-only";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_CONFIG,
  mergeAchievements,
  mergeConfig,
  type AcademyConfigShape,
  type LevelDef,
} from "./config";
import { categoryFile } from "./content-schema";
import { SEED } from "../content";

// ------------------------------------------------------------------ config

let memo: { at: number; value: AcademyConfigShape } | null = null;
const CONFIG_TTL_MS = 30_000;

function sanitizeLevels(v: unknown): LevelDef[] {
  if (!Array.isArray(v)) return DEFAULT_CONFIG.levels;
  const rows = v
    .filter((l) => l && typeof l.name === "string" && Number.isFinite(l.xp))
    .map((l) => ({ name: String(l.name).slice(0, 40), xp: Math.max(0, Math.round(Number(l.xp))) }))
    .sort((a, b) => a.xp - b.xp);
  if (rows.length < 2) return DEFAULT_CONFIG.levels;
  rows[0].xp = 0;
  return rows;
}

/** Defaults with the admin's stored overrides on top. Memoized for 30s per instance. */
export async function loadConfig(): Promise<AcademyConfigShape> {
  if (memo && Date.now() - memo.at < CONFIG_TTL_MS) return memo.value;
  const rows = await prisma.academyConfig.findMany().catch(() => []);
  const by = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const value: AcademyConfigShape = {
    xp: mergeConfig(DEFAULT_CONFIG.xp, by.xp),
    levels: sanitizeLevels(by.levels),
    awards: mergeConfig(DEFAULT_CONFIG.awards, by.awards),
    achievements: mergeAchievements(by.achievements),
  };
  memo = { at: Date.now(), value };
  return value;
}

export async function saveConfig(key: keyof AcademyConfigShape, value: unknown) {
  await prisma.academyConfig.upsert({ where: { key }, create: { key, value: value as object }, update: { value: value as object } });
  memo = null;
}

// ------------------------------------------------------------------ seeding

let seeded = false;

/**
 * Installs the starter curriculum the first time the Academy is opened on an
 * empty database (production gets it on the first visit after the deploy that
 * creates the tables, no manual step). Never overwrites: categories that
 * already exist by slug are left exactly as the admins edited them.
 */
export async function ensureSeeded(force = false): Promise<{ created: number }> {
  if (seeded && !force) return { created: 0 };
  const existing = await prisma.academyCategory.findMany({ select: { slug: true } });
  if (existing.length && !force) {
    seeded = true;
    return { created: 0 };
  }
  const have = new Set(existing.map((c) => c.slug));
  let created = 0;
  for (const raw of SEED) {
    const file = categoryFile.parse(raw);
    if (have.has(file.slug)) continue;
    try {
      await prisma.$transaction(async (tx) => {
        const cat = await tx.academyCategory.create({
          data: { slug: file.slug, title: file.title, tagline: file.tagline, icon: file.icon, order: file.order },
        });
        const moduleIds = new Map<string, string>();
        for (const [i, m] of file.modules.entries()) {
          const row = await tx.academyModule.create({
            data: {
              categoryId: cat.id,
              slug: m.slug,
              level: m.level,
              title: m.title,
              summary: m.summary,
              minutes: m.minutes,
              objectives: m.objectives,
              sections: m.sections,
              concepts: m.concepts,
              example: m.example ?? undefined,
              order: i,
            },
          });
          moduleIds.set(m.slug, row.id);
        }
        await tx.academyQuestion.createMany({
          data: file.questions.map((q) => ({
            categoryId: cat.id,
            moduleId: moduleIds.get(q.module) ?? null,
            difficulty: q.difficulty,
            prompt: q.prompt,
            options: q.options,
            answer: q.answer,
            explanation: q.explanation,
          })),
        });
      });
      created++;
    } catch (err) {
      // A concurrent first visit seeded the same slug: fine, it exists now.
      if ((err as { code?: string })?.code !== "P2002") throw err;
    }
  }
  seeded = true;
  return { created };
}

// ------------------------------------------------------------------ catalog

export type CatalogCategory = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  icon: string;
  modules: { id: string; slug: string; level: string; title: string; summary: string; minutes: number }[];
  questionCount: number;
};

export async function getCatalog(): Promise<CatalogCategory[]> {
  await ensureSeeded();
  const [cats, counts] = await Promise.all([
    prisma.academyCategory.findMany({
      where: { published: true },
      orderBy: [{ order: "asc" }, { title: "asc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        tagline: true,
        icon: true,
        modules: {
          where: { published: true },
          orderBy: { order: "asc" },
          select: { id: true, slug: true, level: true, title: true, summary: true, minutes: true },
        },
      },
    }),
    prisma.academyQuestion.groupBy({ by: ["categoryId"], where: { active: true }, _count: { _all: true } }),
  ]);
  const n = new Map(counts.map((c) => [c.categoryId, c._count._all]));
  return cats.map((c) => ({ ...c, questionCount: n.get(c.id) ?? 0 }));
}

export async function getModule(categorySlug: string, moduleSlug: string) {
  await ensureSeeded();
  const cat = await prisma.academyCategory.findFirst({
    where: { slug: categorySlug, published: true },
    select: {
      id: true,
      slug: true,
      title: true,
      icon: true,
      modules: { where: { published: true }, orderBy: { order: "asc" }, select: { id: true, slug: true, level: true, title: true, minutes: true } },
    },
  });
  if (!cat) return null;
  const mod = await prisma.academyModule.findFirst({
    where: { categoryId: cat.id, slug: moduleSlug, published: true },
    include: { _count: { select: { questions: { where: { active: true } } } } },
  });
  if (!mod) return null;
  return { category: cat, module: mod };
}

export async function getCategory(slug: string) {
  await ensureSeeded();
  return prisma.academyCategory.findFirst({
    where: { slug, published: true },
    select: {
      id: true,
      slug: true,
      title: true,
      tagline: true,
      icon: true,
      modules: {
        where: { published: true },
        orderBy: { order: "asc" },
        select: { id: true, slug: true, level: true, title: true, summary: true, minutes: true, objectives: true, _count: { select: { questions: { where: { active: true } } } } },
      },
      _count: { select: { questions: { where: { active: true } } } },
    },
  });
}
