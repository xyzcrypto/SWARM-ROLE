import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { Navbar } from "@/components/Navbar";
import { FeedbackAdmin } from "@modules/feedback/components/FeedbackAdmin";

export const metadata: Metadata = { title: "Feedback", robots: { index: false } };
export const dynamic = "force-dynamic";

// Staff with `feedback:manage` (Super Admins hold it implicitly). The API
// re-checks the permission on every call; this gate is the UX boundary.
export default async function FeedbackAdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/dashboard/feedback");
  if (!hasPermission(session.user as never, "feedback:manage")) redirect("/dashboard");
  return (
    <>
      <Navbar />
      <main className="relative min-h-screen pt-28">
        <div className="relative mx-auto max-w-[61.25rem] px-5 pb-24 sm:px-6 lg:px-8">
          <FeedbackAdmin />
        </div>
      </main>
    </>
  );
}
