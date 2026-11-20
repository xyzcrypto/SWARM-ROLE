import "../academy/academy.css";
import "./feedback.css";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PageBackground } from "@/components/PageBackground";
import { FeedbackClient } from "@modules/feedback/components/FeedbackClient";

export const metadata: Metadata = {
  title: "Feedback",
  description: "Report a bug, share an idea or rate a page. Every note goes straight to the XYZ Crypto team, and members earn Academy XP for it.",
  alternates: { canonical: "/feedback" },
};

// Static shell: everything personal (name, XP, history) loads in the browser.
export default function FeedbackPage() {
  return (
    <>
      <Navbar />
      <main className="relative min-h-screen pt-24 sm:pt-28">
        <PageBackground />
        <div className="relative mx-auto max-w-[1200px] px-5 pb-28 sm:px-6 lg:px-8">
          <FeedbackClient />
        </div>
      </main>
      <Footer />
    </>
  );
}
