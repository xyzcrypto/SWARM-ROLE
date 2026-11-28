import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { gifEnabled } from "@/lib/env";
import { MessagesClient } from "@/components/MessagesClient";

export const metadata: Metadata = { title: "Messages" };
export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/messages");
  const meId = (session.user as { id?: string }).id ?? "";

  return (
    // Immersive, like every messenger: no site header - the whole screen is
    // the conversation, and the site navigation lives behind the menu button
    // in MessagesClient's headers (AppMenu). Edge to edge on a phone; a large
    // framed app on desktop. The page never scrolls - only the inbox list and
    // the open thread's message list do, inside MessagesClient.
    <main className="relative flex h-[100dvh] flex-col overflow-hidden pt-[env(safe-area-inset-top)]">
      <div className="mesh hidden sm:block" />
      <div className="relative mx-auto flex min-h-0 w-full max-w-[87.5rem] flex-1 flex-col sm:p-4 lg:p-5">
        <Suspense fallback={null}>
          <MessagesClient meId={meId} gifEnabled={gifEnabled} />
        </Suspense>
      </div>
    </main>
  );
}
