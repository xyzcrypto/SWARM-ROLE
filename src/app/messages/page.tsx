import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { gifEnabled } from "@/lib/env";
import { Navbar } from "@/components/Navbar";
import { MessagesClient } from "@/components/MessagesClient";

export const metadata: Metadata = { title: "Messages" };
export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/messages");
  const meId = (session.user as { id?: string }).id ?? "";

  return (
    <>
      <Navbar />
      {/* App-style frame like /community: the page itself never scrolls (no
          double-scroll fight with the composer) - only the inbox list and the
          open thread's message list scroll internally, inside MessagesClient. */}
      <main className="relative flex h-[100svh] flex-col overflow-hidden pt-[4.75rem] sm:pt-20">
        <div className="mesh" />
        <div className="relative mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-2 pb-2 pt-2 sm:px-6 sm:pb-4 sm:pt-3 lg:px-8">
          <Suspense fallback={null}>
            <MessagesClient meId={meId} gifEnabled={gifEnabled} />
          </Suspense>
        </div>
      </main>
    </>
  );
}
