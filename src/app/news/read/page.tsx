import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SharedArticle } from "@/components/SharedArticle";
import { decodeStory, type SharedStory } from "@/lib/news-share";
import { getNewsPage } from "@/lib/news-fetch";

// Depends on the ?d= / ?u= param, so render on demand.
export const dynamic = "force-dynamic";

// Resolve the story from either the legacy full ?d= token (rich, self-contained)
// or the new short ?u=<source-url> link (look the story up in the live feed for
// a rich preview; fall back to a minimal card that links to the source).
async function resolve(sp: { d?: string; u?: string }): Promise<SharedStory | null> {
  if (sp.d) return decodeStory(sp.d);
  if (sp.u) {
    const url = decodeURIComponent(sp.u);
    try {
      const { items } = await getNewsPage({ pageSize: 30 });
      const it = items.find((i) => i.url === url);
      if (it) return { u: it.url, t: it.title, s: it.summary, src: it.source, img: it.image, ts: it.publishedAt, cat: it.category };
    } catch { /* fall through to the minimal card */ }
    return { u: url, t: "News on XYZ Crypto" };
  }
  return null;
}

export async function generateMetadata(props: { searchParams: Promise<{ d?: string; u?: string }> }): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const story = await resolve(searchParams);
  if (!story) return { title: "News" };
  const desc = (story.s || "").slice(0, 200) || "Read this story on XYZ Crypto.";
  const images = story.img ? [story.img] : undefined;
  return {
    title: story.t,
    description: desc,
    openGraph: { title: story.t, description: desc, images, type: "article" },
    twitter: { card: images ? "summary_large_image" : "summary", title: story.t, description: desc, images },
  };
}

export default async function NewsReadPage(props: { searchParams: Promise<{ d?: string; u?: string }> }) {
  const searchParams = await props.searchParams;
  const story = await resolve(searchParams);
  return (
    <>
      <Navbar />
      <main className="relative min-h-screen pt-28">
        <div className="mesh" />
        <div className="relative mx-auto max-w-3xl px-4 pb-24 sm:px-6 lg:px-8">
          <SharedArticle story={story} />
        </div>
      </main>
      <Footer />
    </>
  );
}
