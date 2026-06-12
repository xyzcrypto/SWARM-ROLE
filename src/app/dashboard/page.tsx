import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { Navbar } from "@/components/Navbar";
import { DashboardClient } from "@/components/DashboardClient";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/dashboard");
  if ((session.user as any).role !== "ADMIN") redirect("/");

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const userSelect = {
    id: true,
    name: true,
    email: true,
    provider: true,
    role: true,
    membership: true,
    createdAt: true,
    lastLoginAt: true,
  } as const;

  // One groupBy replaces three separate user counts (total/google/premium are
  // derived from the provider+membership buckets). New: self-hosted analytics.
  const [userBuckets, last7days, subscribers, recentUsers, premiumMembers, posts, totalVisits, todayVisits, postViews] =
    await Promise.all([
      prisma.user.groupBy({ by: ["provider", "membership"], _count: { _all: true } }),
      prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 864e5) } } }),
      prisma.subscriber.count(),
      prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 50, select: userSelect }),
      prisma.user.findMany({ where: { membership: "Premium" }, orderBy: { createdAt: "desc" }, select: userSelect }),
      prisma.post.findMany({
        orderBy: { createdAt: "desc" },
        take: 200, // bounded; client-side search/filter handles the rest
        select: { id: true, title: true, slug: true, category: true, published: true, premium: true, views: true, createdAt: true },
      }),
      prisma.pageView.count().catch(() => 0),
      prisma.pageView.count({ where: { createdAt: { gte: startOfToday } } }).catch(() => 0),
      prisma.post.aggregate({ _sum: { views: true } }).catch(() => ({ _sum: { views: 0 } })),
    ]);

  const totalUsers = userBuckets.reduce((n, b) => n + b._count._all, 0);
  const googleUsers = userBuckets
    .filter((b) => b.provider === "google")
    .reduce((n, b) => n + b._count._all, 0);
  const premiumUsers = userBuckets
    .filter((b) => b.membership === "Premium")
    .reduce((n, b) => n + b._count._all, 0);

  const stats = {
    totalUsers,
    googleUsers,
    emailUsers: totalUsers - googleUsers,
    last7days,
    premiumUsers,
    subscribers,
    totalPosts: posts.length,
    totalVisits,
    todayVisits,
    totalPostViews: postViews._sum.views ?? 0,
  };

  const serializeUser = (u: (typeof recentUsers)[number]) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
  });

  return (
    <>
      <Navbar />
      <main className="relative min-h-screen pt-24">
        <div className="mesh" />
        <div className="relative mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
          <DashboardClient
            stats={stats}
            recentUsers={recentUsers.map(serializeUser)}
            premiumMembers={premiumMembers.map(serializeUser)}
            posts={posts.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }))}
            adminName={session.user.name ?? "Admin"}
            realtime={{
              url: env.NEXT_PUBLIC_SUPABASE_URL,
              anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            }}
          />
        </div>
      </main>
    </>
  );
}
