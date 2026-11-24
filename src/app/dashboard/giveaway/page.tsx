import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { Navbar } from "@/components/Navbar";
import { GiveawayAdmin } from "@modules/giveaway/components/GiveawayAdmin";

export const metadata: Metadata = { title: "Giveaway", robots: { index: false } };
export const dynamic = "force-dynamic";

// Staff with `academy:manage` (Super Admins hold it implicitly). The API
// re-checks the permission on every call; this gate is the UX boundary.
export default async function GiveawayAdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/dashboard/giveaway");
  if (!hasPermission(session.user as never, "academy:manage")) redirect("/dashboard");
  return (
    <>
      <Navbar />
      <main className="relative min-h-screen pt-28">
        <div className="relative mx-auto max-w-[1200px] px-5 pb-24 sm:px-6 lg:px-8">
          <GiveawayAdmin />
        </div>
      </main>
    </>
  );
}
