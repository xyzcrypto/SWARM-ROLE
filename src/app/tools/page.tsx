import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { ToolsClient } from "@/components/ToolsClient";
import { PageHeader } from "@/components/PageHeader";
import { PageBackground } from "@/components/PageBackground";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { pageSeo } from "@/lib/seo";

export const metadata: Metadata = pageSeo({
  title: "Trading Tools",
  description:
    "Free trading calculators: perp DEX funding fee, points/airdrop value (including Variational), liquidation price, position sizing and PnL - built for serious traders.",
  path: "/tools",
});

// Every calculator here is pure client-side math - nothing per-request to render.
export const revalidate = 3600;

export default function ToolsPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Tools", path: "/tools" }])} />
      <Navbar />
      <main className="relative min-h-screen pt-28">
        <PageBackground />
        <div className="relative mx-auto max-w-4xl px-4 pb-24 sm:px-6 lg:px-8">
          <PageHeader
            eyebrow="Free Calculators"
            title={<>Trading <span className="text-shine">Tools</span></>}
            subtitle="Funding fees, points and airdrop value, liquidation price, position sizing and PnL - free, no login required."
          />
          <div className="mt-12">
            <ToolsClient />
          </div>
        </div>
      </main>
    </>
  );
}
