import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { SettingsClient } from "@/components/SettingsClient";
import { fetchExtraSocials } from "@/lib/user-socials";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/settings");

  const id = (session.user as any).id as string;
  const user = await prisma.user
    .findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, image: true, bannerImage: true, username: true,
        bio: true, location: true, website: true, twitter: true, github: true,
        telegram: true, role: true, membership: true, provider: true,
        passwordHash: true, createdAt: true,
      },
    })
    .catch(() => null);

  if (!user) redirect("/login?callbackUrl=/settings");

  // Migration-20 social columns, read through a guarded query (tolerates an
  // un-migrated DB so settings never breaks).
  const extra = await fetchExtraSocials({ id });

  // Strip the hash; the client only needs to know whether a password exists.
  const { passwordHash, createdAt, ...rest } = user;

  return (
    <>
      <Navbar />
      <main className="relative min-h-screen pt-24">
        <div className="mesh" />
        <div className="relative mx-auto max-w-3xl px-4 pb-24 sm:px-6 lg:px-8">
          <SettingsClient
            user={{ ...rest, ...extra, hasPassword: !!passwordHash, createdAt: createdAt.toISOString() }}
          />
        </div>
      </main>
    </>
  );
}
