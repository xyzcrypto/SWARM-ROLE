import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { env, storageEnabled, realtimeEnabled, emailEnabled, googleEnabled, githubEnabled, twitterEnabled, aiEnabled } from "@/lib/env";
import { Navbar } from "@/components/Navbar";
import { DashboardClient } from "@/components/DashboardClient";
import { isStaff } from "@/lib/permissions";
import { publicImageUrl } from "@/lib/utils";
import { todayKey } from "@/lib/xp";
import { memberCheckins } from "@/lib/member-checkins";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

// Resilience: if the `views` column hasn't been migrated yet (P2022), retry the
// query without it (defaulting views to 0) so the dashboard never 500s.
async function getDashboardPosts() {
  const base = {
    orderBy: { createdAt: "desc" },
    take: 200, // bounded; client-side search/filter handles the rest
  } as const;
  try {
    return await prisma.post.findMany({
      ...base,
      select: { id: true, title: true, slug: true, category: true, published: true, premium: true, views: true, createdAt: true },
    });
  } catch (err: any) {
    if (err?.code !== "P2022") throw err;
    const rows = await prisma.post.findMany({
      ...base,
      select: { id: true, title: true, slug: true, category: true, published: true, premium: true, createdAt: true },
    });
    return rows.map((r) => ({ ...r, views: 0 }));
  }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/dashboard");
  const me = session.user as any;
  // Anyone with staff access (Super Admin OR at least one granted capability) gets
  // in - the tabs themselves are then filtered to what they're allowed to use. (A
  // specific capability like `dashboard:view` is NOT required just to enter, so
  // granting e.g. `whatsnew:manage` works as expected.)
  if (!isStaff(me)) redirect("/");
  const viewer = {
    id: me.id as string,
    permissions: (Array.isArray(me.permissions) ? me.permissions : []) as string[],
    isSuperAdmin: Boolean(me.isSuperAdmin) || me.role === "ADMIN",
  };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const userSelect = {
    id: true,
    name: true,
    // Handle, so a dashboard row can link straight to /u/<username>.
    username: true,
    // The avatar answers "who has actually set a photo?" at a glance, which
    // a list of masked email addresses cannot.
    image: true,
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
      // Server Component: evaluated once per request, so Date.now() is stable
      // for this render - the purity rule's re-render concern is client-only.
      // eslint-disable-next-line react-hooks/purity
      prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 864e5) } } }),
      prisma.subscriber.count(),
      prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 50, select: userSelect }),
      prisma.user.findMany({ where: { membership: "Premium" }, orderBy: { createdAt: "desc" }, take: 100, select: userSelect }),
      getDashboardPosts(),
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

  // Check-in totals + streaks for everyone on screen, in two queries for the
  // whole page rather than one per row.
  const today = todayKey();
  const checkins = await memberCheckins(
    [...new Set([...recentUsers, ...premiumMembers].map((u) => u.id))],
    today
  );

  const serializeUser = (u: (typeof recentUsers)[number]) => ({
    ...u,
    // An inline data: avatar becomes a /api/media URL rather than a base64
    // blob in the page payload - the same treatment every other surface gives
    // it. Never send the raw string to 50 rows at once.
    image: publicImageUrl(u.image, u.id),
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    checkinStreak: checkins.get(u.id)?.streak ?? 0,
    checkinTotal: checkins.get(u.id)?.total ?? 0,
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
            viewer={viewer}
            realtime={{
              url: env.NEXT_PUBLIC_SUPABASE_URL,
              anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            }}
            health={{
              storage: storageEnabled,
              realtime: realtimeEnabled,
              upstash: Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN),
              email: emailEnabled,
              google: googleEnabled,
              github: githubEnabled,
              twitter: twitterEnabled,
              ai: aiEnabled,
            }}
          />
        </div>
      </main>
    </>
  );
}
