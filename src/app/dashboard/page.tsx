import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { DashboardClient } from "@/components/DashboardClient";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/dashboard");
  if ((session.user as any).role !== "ADMIN") redirect("/");

  const [totalUsers, googleUsers, last7days, premiumUsers, subscribers, recentUsers, posts] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { provider: "google" } }),
      prisma.user.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 864e5) } },
      }),
      prisma.user.count({ where: { membership: "Premium" } }),
      prisma.subscriber.count(),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          name: true,
          email: true,
          provider: true,
          role: true,
          membership: true,
          createdAt: true,
          lastLoginAt: true,
        },
      }),
      prisma.post.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          category: true,
          published: true,
          createdAt: true,
        },
      }),
    ]);

  const stats = {
    totalUsers,
    googleUsers,
    emailUsers: totalUsers - googleUsers,
    last7days,
    premiumUsers,
    subscribers,
    totalPosts: posts.length,
  };

  return (
    <>
      <Navbar />
      <main className="relative min-h-screen pt-24">
        <div className="mesh" />
        <div className="relative mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
          <DashboardClient
            stats={stats}
            recentUsers={recentUsers.map((u) => ({
              ...u,
              createdAt: u.createdAt.toISOString(),
              lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
            }))}
            posts={posts.map((p) => ({
              ...p,
              createdAt: p.createdAt.toISOString(),
            }))}
            adminName={session.user.name ?? "Admin"}
          />
        </div>
      </main>
    </>
  );
}
