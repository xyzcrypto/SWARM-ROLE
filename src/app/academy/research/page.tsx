import type { Metadata } from "next";
import { ResearchHub } from "@modules/research/components/ResearchHub";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { pageSeo } from "@/lib/seo";

export const metadata: Metadata = pageSeo({
  title: "Research Hub",
  description:
    "Web3 research, articles and posts from XYZ Crypto, on-chain analysis, market intelligence and education, inside the XYZ Crypto Academy.",
  path: "/academy/research",
});

// Cached; revalidated on demand when an admin publishes or deletes (the
// research routes call revalidatePath for this path). See the history of the
// 1800s window in the old app/research/page.tsx (414 writes vs 177 reads at 300s).
export const revalidate = 1800;

export default function AcademyResearchPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Academy", path: "/academy" }, { name: "Research", path: "/academy/research" }])} />
      <ResearchHub />
    </>
  );
}
