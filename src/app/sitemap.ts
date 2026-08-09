import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Coin and protocol pages already carry `generateMetadata` AND a canonical -
// they were built to be indexed, and were simply never advertised. They are the
// largest indexable surface on the site, so listing them is the biggest single
// SEO win available here.
//
// The lists come from this site's OWN cached market routes rather than
// CoinGecko/llama.fi directly: those responses are already cached
// (`s-maxage=200`), so the sitemap reuses work instead of adding a second
// upstream call on every fetch. Each is best-effort with a tight timeout - a
// slow upstream must never hold up or break the sitemap, which still has to
// serve the pages we know statically.
//
// Coins are capped well below the 250 the API returns. Every listed page is an
// ISR entry that a crawler can cause to regenerate, and the search demand for
// the 200th coin by market cap does not justify the write. The cap is the
// deliberate bound, not an accident of the upstream page size.
const MAX_COINS = 100;
const MAX_PROTOCOLS_PER_TYPE = 40;

async function getJson(path: string): Promise<any | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2500);
  try {
    const res = await fetch(`${SITE_URL}${path}`, { signal: ctrl.signal, next: { revalidate: 300 } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

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
    // These three are real public pages with their own metadata (and /tools has
    // breadcrumb JSON-LD) that the sitemap simply never mentioned.
    { url: `${SITE_URL}/tools`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
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

  // Market pages, best-effort. Fetched in parallel so a slow one does not
  // serialise with the others.
  const [coinsRes, perpRes, dexRes] = await Promise.all([
    getJson("/api/markets/coins"),
    getJson("/api/markets/perp"),
    getJson("/api/markets/dex"),
  ]);

  const coinRoutes: MetadataRoute.Sitemap = (Array.isArray(coinsRes?.list) ? coinsRes.list : [])
    .map((c: { id?: unknown }) => String(c?.id ?? ""))
    .filter(Boolean)
    .slice(0, MAX_COINS)
    .map((id: string) => ({
      url: `${SITE_URL}/markets/${encodeURIComponent(id)}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.5,
    }));

  // `type` here must match the segment the app links to and the TYPES set the
  // page validates against ("derivatives" | "dexs" | "fees") - a mismatch would
  // publish URLs that 404.
  const protocolRoutes: MetadataRoute.Sitemap = (
    [
      ["derivatives", perpRes?.dexs],
      ["dexs", dexRes?.dexs],
      ["fees", dexRes?.fees],
    ] as const
  ).flatMap(([type, rows]) =>
    (Array.isArray(rows) ? rows : [])
      .map((r: { slug?: unknown }) => String(r?.slug ?? ""))
      .filter(Boolean)
      .slice(0, MAX_PROTOCOLS_PER_TYPE)
      .map((slug: string) => ({
        url: `${SITE_URL}/markets/protocol/${type}/${encodeURIComponent(slug)}`,
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.4,
      }))
  );

  return [...staticRoutes, ...postRoutes, ...profileRoutes, ...coinRoutes, ...protocolRoutes];
}
