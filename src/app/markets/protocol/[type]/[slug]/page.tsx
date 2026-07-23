import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ProtocolDetailClient } from "@/components/ProtocolDetailClient";

export const revalidate = 300;

const TYPES = new Set(["derivatives", "dexs", "fees"]);
const LABEL: Record<string, string> = { derivatives: "Perp DEX", dexs: "DEX", fees: "Fee Protocol" };

function cleanSlug(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80);
}
function pretty(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function generateMetadata(props: { params: Promise<{ type: string; slug: string }> }): Promise<Metadata> {
  const params = await props.params;
  const type = String(params.type || "").toLowerCase();
  const slug = cleanSlug(params.slug);
  const name = pretty(slug);
  const kind = LABEL[type] ?? "Protocol";
  return {
    title: `${name} - ${kind} Volume, Fees & Stats`,
    description: `Live ${name} ${kind.toLowerCase()} stats on XYZ Crypto - 24h/7d/30d volume & fees, chains, trend chart and an AI market take.`,
    alternates: { canonical: `/markets/protocol/${type}/${slug}` },
  };
}

export default async function ProtocolPage(props: { params: Promise<{ type: string; slug: string }> }) {
  const params = await props.params;
  const type = String(params.type || "").toLowerCase();
  const slug = cleanSlug(params.slug);
  if (!TYPES.has(type) || !slug) notFound();
  return (
    <>
      <Navbar />
      <main className="relative min-h-screen pt-28">
        <div className="mesh" />
        <div className="relative mx-auto max-w-5xl px-4 pb-24 sm:px-6 lg:px-8">
          <ProtocolDetailClient type={type} slug={slug} />
        </div>
      </main>
      <Footer />
    </>
  );
}
