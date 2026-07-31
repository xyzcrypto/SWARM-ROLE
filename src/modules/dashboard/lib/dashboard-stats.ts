import { prisma } from "@/lib/prisma";

// Shared dashboard stat aggregation, used by the dashboard page (initial render)
// and the live-refresh endpoint (/api/dashboard/stats) so the numbers stay in one
// place. All counts are cheap aggregates (no row hydration).
export type DashboardStats = {
  totalUsers: number;
  googleUsers: number;
  emailUsers: number;
  last7days: number;
  premiumUsers: number;
  subscribers: number;
  totalPosts: number;
  totalVisits: number;
  todayVisits: number;
  totalPostViews: number;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [userBuckets, last7days, subscribers, totalPosts, totalVisits, todayVisits, postViews] = await Promise.all([
    prisma.user.groupBy({ by: ["provider", "membership"], _count: { _all: true } }),
    prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 864e5) } } }),
    prisma.subscriber.count(),
    prisma.post.count(),
    prisma.pageView.count().catch(() => 0),
    prisma.pageView.count({ where: { createdAt: { gte: startOfToday } } }).catch(() => 0),
    prisma.post.aggregate({ _sum: { views: true } }).catch(() => ({ _sum: { views: 0 } })),
  ]);

  const totalUsers = userBuckets.reduce((n, b) => n + b._count._all, 0);
  const googleUsers = userBuckets.filter((b) => b.provider === "google").reduce((n, b) => n + b._count._all, 0);
  const premiumUsers = userBuckets.filter((b) => b.membership === "Premium").reduce((n, b) => n + b._count._all, 0);

  return {
    totalUsers,
    googleUsers,
    emailUsers: totalUsers - googleUsers,
    last7days,
    premiumUsers,
    subscribers,
    totalPosts,
    totalVisits,
    todayVisits,
    totalPostViews: postViews._sum.views ?? 0,
  };
}
