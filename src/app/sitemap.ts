import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await prisma.post
    .findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    })
    .catch(() => [] as { slug: string; updatedAt: Date }[]);

  // Public member profiles (capped) so /u/<handle> pages are discoverable.
  const profiles = await prisma.user
    .findMany({
      where: { username: { not: null } },
      select: { username: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    })
    .catch(() => [] as { username: string | null }[]);

  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/markets`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    { url: `${SITE_URL}/news`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    { url: `${SITE_URL}/research`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/premium`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/community`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  const postRoutes: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${SITE_URL}/research/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const profileRoutes: MetadataRoute.Sitemap = profiles
    .filter((u): u is { username: string } => Boolean(u.username))
    .map((u) => ({
      url: `${SITE_URL}/u/${u.username}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.3,
    }));

  return [...staticRoutes, ...postRoutes, ...profileRoutes];
}
