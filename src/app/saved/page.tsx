import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { PageHeader } from "@/components/PageHeader";
import { PageBackground } from "@/components/PageBackground";
import { SavedClient } from "@modules/news/components/SavedClient";
import { pageSeo } from "@/lib/seo";

export const metadata: Metadata = pageSeo({
  title: "Saved",
  description: "Research posts and news stories you saved to read later.",
  path: "/saved",
});

// Per-member content, so there is nothing to prerender and no window to set.
// The list itself is fetched client-side from `/api/news/saved`, which is
// `private, no-store` for the same reason.
export const dynamic = "force-dynamic";

export default function SavedPage() {
  return (
    <>
      <Navbar />
      <main className="relative min-h-screen pt-28">
        <PageBackground />
        <div className="relative mx-auto max-w-[75rem] px-5 pb-24 sm:px-6 lg:px-8">
          <PageHeader
            eyebrow="Your library"
            title={
              <>
                Saved <span className="text-shine">reads</span>
              </>
            }
            subtitle="Everything you bookmarked, research and news together. One list, because a bookmark you have to hunt for in two places is a bookmark you stop using."
          />
          <div className="mt-10 sm:mt-12">
            <SavedClient />
          </div>
        </div>
      </main>
    </>
  );
}
