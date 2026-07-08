import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SharedArticle } from "@/components/SharedArticle";
import { decodeStory } from "@/lib/news-share";

// Depends on the ?d= token, so render on demand.
export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: { d?: string } }): Promise<Metadata> {
  const story = searchParams.d ? decodeStory(searchParams.d) : null;
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

export default function NewsReadPage({ searchParams }: { searchParams: { d?: string } }) {
  const story = searchParams.d ? decodeStory(searchParams.d) : null;
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
