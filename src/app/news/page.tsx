import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { NewsClient } from "@/components/NewsClient";
import { PageHeader } from "@/components/PageHeader";
import { PageBackground } from "@/components/PageBackground";
import { getNewsPage } from "@/lib/news-fetch";

export const metadata: Metadata = {
  title: "Live Web3 News",
  description:
    "Real-time Web3 news & intelligence - breaking news, market updates and everything across crypto, filterable by category, from reputable sources, with AI context.",
};

// Revalidate the server-rendered first batch often so first paint is fresh + fast.
export const revalidate = 30;

export default async function NewsPage() {
  // Server-render the first batch so the feed paints instantly (no blank fetch).
  const initial = await getNewsPage({ page: 1 }).catch(() => null);
  return (
    <>
      <Navbar />
      <main className="relative min-h-screen pt-28">
        <PageBackground />
        <div className="relative mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
          <PageHeader
            eyebrow="Live Intelligence"
            title={<>Web3 <span className="text-shine-mint">News</span></>}
            subtitle="Everything happening across crypto, in real time, filtered by what matters to you, from reputable sources, with AI context."
          />

          <div className="mt-12">
            <NewsClient initial={initial} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
