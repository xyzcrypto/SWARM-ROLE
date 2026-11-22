import "server-only";
import { prisma } from "@/lib/prisma";
import { levelFor } from "./engine";
import { loadConfig } from "./store";

// What AneQue knows when she answers: the Academy's own lessons (retrieved
// for the question asked) and the learner's own progress. Before this she
// answered from the model's general knowledge plus a list of lesson TITLES,
// so she could not quote what a lesson actually teaches, contradicted it now
// and then, and had no idea whether she was talking to a beginner on day one
// or someone at level 6 who keeps missing DeFi questions.

// ------------------------------------------------------------------ retrieval (pure, tested)

export type Passage = { category: string; module: string; href: string; heading: string; text: string };

const STOP = new Set(
  "the a an and or but of to in on at for with from by is are was were be been being it its this that these those what why how when where who which do does did can could should would will i you me my your we our they them their as about into than then so if not no yes just also more most very much any some there here have has had get got make makes like use used using kya hai hota hota hain mein ka ki ke ko se aur ya bhi".split(" ")
);

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((w) => w.length >= 2 && !STOP.has(w))
    .map((w) => (w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));
}

/**
 * The passages that best answer `query`: BM25-style term weighting, with a
 * boost for the lesson or topic the learner is looking at. Pure, for tests.
 */
export function rankPassages(passages: Passage[], query: string, focus: { lesson?: string | null; topic?: string | null } = {}, k = 4): Passage[] {
  const q = [...new Set(tokens(query))];
  if (!q.length || !passages.length) return [];
  const docs = passages.map((p) => tokens(`${p.module} ${p.heading} ${p.heading} ${p.text}`));
  const avg = docs.reduce((n, d) => n + d.length, 0) / docs.length || 1;
  const df = new Map<string, number>();
  for (const d of docs) for (const w of new Set(d)) df.set(w, (df.get(w) ?? 0) + 1);
  const N = docs.length;
  const scored = passages.map((p, i) => {
    const d = docs[i];
    const tf = new Map<string, number>();
    for (const w of d) tf.set(w, (tf.get(w) ?? 0) + 1);
    let s = 0;
    for (const w of q) {
      const f = tf.get(w) ?? 0;
      if (!f) continue;
      const idf = Math.log(1 + (N - (df.get(w) ?? 0) + 0.5) / ((df.get(w) ?? 0) + 0.5));
      s += idf * ((f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (d.length / avg))));
    }
    if (s > 0 && focus.lesson && p.module === focus.lesson) s *= 1.6;
    if (s > 0 && focus.topic && p.category === focus.topic) s *= 1.25;
    return { p, s };
  });
  return scored
    .filter((x) => x.s > 0.5)
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map((x) => x.p);
}

/** Render passages for the prompt, within a character budget. Pure, for tests. */
export function formatPassages(ps: Passage[], budget = 2600): string {
  let out = "";
  for (const p of ps) {
    const block = `[${p.category} > ${p.module} > ${p.heading}] ${p.text}`.trim();
    if (out.length + block.length + 2 > budget) break;
    out += (out ? "\n" : "") + block;
  }
  return out;
}

// ------------------------------------------------------------------ corpus

type Section = { heading?: string; body?: string };
type Concept = { term?: string; definition?: string };

let corpus: { at: number; passages: Passage[] } | null = null;
const CORPUS_TTL_MS = 10 * 60_000;

async function loadPassages(): Promise<Passage[]> {
  if (corpus && Date.now() - corpus.at < CORPUS_TTL_MS) return corpus.passages;
  const mods = await prisma.academyModule.findMany({
    where: { published: true, category: { published: true } },
    select: { slug: true, title: true, summary: true, sections: true, concepts: true, example: true, category: { select: { slug: true, title: true } } },
  });
  const passages: Passage[] = [];
  for (const m of mods) {
    const base = { category: m.category.title, module: m.title, href: `/academy/learn/${m.category.slug}/${m.slug}` };
    if (m.summary) passages.push({ ...base, heading: "Summary", text: m.summary });
    for (const s of (Array.isArray(m.sections) ? m.sections : []) as Section[]) if (s?.body) passages.push({ ...base, heading: s.heading ?? "", text: s.body });
    const concepts = ((Array.isArray(m.concepts) ? m.concepts : []) as Concept[]).filter((c) => c?.term && c?.definition);
    if (concepts.length) passages.push({ ...base, heading: "Key terms", text: concepts.map((c) => `${c.term}: ${c.definition}`).join(" ") });
    const ex = m.example as { title?: string; body?: string } | null;
    if (ex?.body) passages.push({ ...base, heading: `Example: ${ex.title ?? ""}`, text: ex.body });
  }
  corpus = { at: Date.now(), passages };
  return passages;
}

/** Lesson passages relevant to what the learner just asked (empty on any failure). */
export async function lessonNotes(query: string, focus: { lesson?: string | null; topic?: string | null }): Promise<string> {
  try {
    return formatPassages(rankPassages(await loadPassages(), query, focus));
  } catch {
    return "";
  }
}

// ------------------------------------------------------------------ learner

/**
 * A few facts about the learner, so AneQue can pitch the answer at the right
 * level and suggest what to practise. Weak topics come from their recent
 * answers. Empty on any failure: a missing snapshot must never stop a reply.
 */
export async function learnerSnapshot(userId: string): Promise<string> {
  try {
    const [profile, cfg, recent] = await Promise.all([
      prisma.academyProfile.findUnique({ where: { userId }, select: { xp: true, quizzes: true, answered: true, correct: true, streak: true } }),
      loadConfig(),
      prisma.academyAnswer.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 200, select: { correct: true, questionId: true } }),
    ]);
    if (!profile || profile.answered === 0) return "New learner: no quizzes played yet. Keep it beginner-friendly.";
    const lvl = levelFor(profile.xp, cfg.levels);
    const acc = Math.round((profile.correct / Math.max(1, profile.answered)) * 100);
    let weak = "";
    if (recent.length >= 10) {
      const qs = await prisma.academyQuestion.findMany({ where: { id: { in: [...new Set(recent.map((r) => r.questionId))] } }, select: { id: true, category: { select: { title: true } } } });
      const cat = new Map(qs.map((q) => [q.id, q.category.title]));
      const by = new Map<string, { n: number; ok: number }>();
      for (const r of recent) {
        const c = cat.get(r.questionId);
        if (!c) continue;
        const v = by.get(c) ?? { n: 0, ok: 0 };
        v.n++;
        if (r.correct) v.ok++;
        by.set(c, v);
      }
      const rows = [...by.entries()].filter(([, v]) => v.n >= 4).map(([c, v]) => ({ c, pct: Math.round((v.ok / v.n) * 100) }));
      const low = rows.filter((r) => r.pct < 60).sort((a, b) => a.pct - b.pct).slice(0, 2);
      const high = rows.filter((r) => r.pct >= 80).sort((a, b) => b.pct - a.pct).slice(0, 2);
      if (low.length) weak += ` Weaker recently: ${low.map((r) => `${r.c} (${r.pct}%)`).join(", ")}.`;
      if (high.length) weak += ` Strong: ${high.map((r) => `${r.c} (${r.pct}%)`).join(", ")}.`;
    }
    return `Level ${lvl.level} (${lvl.name}), ${profile.xp} XP${lvl.next != null ? `, ${lvl.toNext} XP to the next level` : ", top level"}. ${profile.quizzes} quizzes, ${acc}% correct overall, ${profile.streak}-day streak.${weak}`;
  } catch {
    return "";
  }
}
