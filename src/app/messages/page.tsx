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
      <main className="relative min-h-screen pt-24">
        <div className="mesh" />
        <div className="relative mx-auto max-w-5xl px-4 pb-10 sm:px-6 lg:px-8">
          <Suspense fallback={null}>
            <MessagesClient meId={meId} gifEnabled={gifEnabled} />
          </Suspense>
        </div>
      </main>
    </>
  );
}
