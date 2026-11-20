import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategory } from "@modules/academy/lib/store";
import { CategoryView } from "@modules/academy/components/CategoryView";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { pageSeo } from "@/lib/seo";

// Rendered on first request and cached (no generateStaticParams, so the
// database is never read at build time). Admin edits revalidate /academy/learn.
export const revalidate = 86400;

type Props = { params: Promise<{ category: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const c = await getCategory(category).catch(() => null);
  if (!c) return { title: "Topic not found" };
  return pageSeo({ title: `${c.title}: Lessons and Quizzes | XYZ Crypto Academy`, description: c.tagline, path: `/academy/learn/${c.slug}` });
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  const c = await getCategory(category);
  if (!c) notFound();
  const data = {
    id: c.id,
    slug: c.slug,
    title: c.title,
    tagline: c.tagline,
    icon: c.icon,
    questions: c._count.questions,
    modules: c.modules.map((m) => ({ id: m.id, slug: m.slug, level: m.level, title: m.title, summary: m.summary, minutes: m.minutes, objectives: (m.objectives as string[]) ?? [], questions: m._count.questions })),
  };
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Academy", path: "/academy" }, { name: "Learn", path: "/academy/learn" }, { name: c.title, path: `/academy/learn/${c.slug}` }])} />
      <CategoryView c={data} />
    </>
  );
}
