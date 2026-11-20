import type { Metadata } from "next";
import { AcademyHome } from "@modules/academy/components/AcademyHome";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { pageSeo } from "@/lib/seo";

export const metadata: Metadata = pageSeo({
  title: "XYZ Crypto Academy: Learn Web3, Play Quizzes, Earn XP and Certificates",
  description:
    "Master Web3 with interactive lessons across 14 topics, daily and weekly challenges, live multiplayer quizzes, global leaderboards and official XYZ Crypto certificates.",
  path: "/academy",
});

// A static shell: the hero, dashboard and boards load on the client from their
// own cached API routes, so nothing here is per-request and nothing is read
// from the database at build time.
export default function AcademyPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Academy", path: "/academy" }])} />
      <AcademyHome />
    </>
  );
}
