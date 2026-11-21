import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getModule } from "@modules/academy/lib/store";
import { clip, hinglish } from "@modules/academy/lib/voice";
import { LessonView } from "@modules/academy/components/LessonView";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { pageSeo } from "@/lib/seo";

// Same caching as the topic page: on demand, then a day, revalidated by admin edits.
export const revalidate = 86400;

type Props = { params: Promise<{ category: string; module: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, module } = await params;
  const r = await getModule(category, module).catch(() => null);
  if (!r) return { title: "Lesson not found" };
  return pageSeo({ title: `${r.module.title} | ${r.category.title} | XYZ Crypto Academy`, description: r.module.summary, path: `/academy/learn/${category}/${module}` });
}

export default async function LessonPage({ params }: Props) {
  const { category, module } = await params;
  const r = await getModule(category, module);
  if (!r) notFound();
  const m = r.module;
  const idx = r.category.modules.findIndex((x) => x.id === m.id);
  const lesson = {
    id: m.id,
    slug: m.slug,
    level: m.level,
    title: m.title,
    summary: m.summary,
    summaryVoice: clip(m.summary),
    minutes: m.minutes,
    objectives: (m.objectives as string[]) ?? [],
    sections: (m.sections as { heading: string; body: string }[]) ?? [],
    concepts: (m.concepts as { term: string; definition: string }[]) ?? [],
    example: (m.example as { title: string; body: string } | null) ?? null,
    questions: m._count.questions,
    isFirst: idx === 0,
  };
  // AneQue reads every part of the lesson in her own voice (English), and the
  // same lesson exists in Hinglish with its own recordings in the same voice.
  const voices = {
    sections: lesson.sections.map((x) => ({ heading: clip(x.heading), body: clip(x.body) })),
    example: lesson.example ? { title: clip(lesson.example.title), body: clip(lesson.example.body) } : null,
  };
  const hi = {
    title: hinglish(lesson.title),
    summary: hinglish(lesson.summary),
    objectives: lesson.objectives.map((o) => hinglish(o)),
    sections: lesson.sections.map((x) => ({ heading: hinglish(x.heading), body: hinglish(x.body) })),
    concepts: lesson.concepts.map((c) => hinglish(c.definition)),
    example: lesson.example ? { title: hinglish(lesson.example.title), body: hinglish(lesson.example.body) } : null,
  };
  const nav = {
    category: { slug: r.category.slug, title: r.category.title, icon: r.category.icon },
    modules: r.category.modules.map((x) => ({ id: x.id, slug: x.slug, level: x.level, title: x.title, minutes: x.minutes })),
    prev: idx > 0 ? r.category.modules[idx - 1].slug : null,
    next: idx < r.category.modules.length - 1 ? r.category.modules[idx + 1].slug : null,
  };
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Academy", path: "/academy" },
          { name: r.category.title, path: `/academy/learn/${r.category.slug}` },
          { name: m.title, path: `/academy/learn/${r.category.slug}/${m.slug}` },
        ])}
      />
      <LessonView lesson={{ ...lesson, voices, hi }} nav={nav} />
    </>
  );
}
