import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PageBackground } from "@/components/PageBackground";
import { GiveawayClient } from "@modules/giveaway/components/GiveawayClient";

export const metadata: Metadata = {
  title: "Bungee Funded Perps Giveaway: 3x $10K Accounts",
  description:
    "Win one of three $10K Bungee Funded Perps accounts. Learn Bungee in the XYZ Crypto Academy, play the Bungee live quizzes and submit your entry.",
  alternates: { canonical: "/bungee" },
};

// Static shell: the checklist and the entry load in the browser for the
// signed-in member, so this page costs no function invocation to serve.
export default function BungeeGiveawayPage() {
  return (
    <>
      <Navbar />
      <main className="relative min-h-screen pt-24 sm:pt-28">
        <PageBackground />
        <div className="relative mx-auto max-w-[61.25rem] px-5 pb-28 sm:px-6 lg:px-8">
          <GiveawayClient />
        </div>
      </main>
      <Footer />
    </>
  );
}
