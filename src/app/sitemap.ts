import type { MetadataRoute } from "next";
import { NOT_TRASHED } from "@modules/research/lib/post-visibility";
import { llamaOverview } from "@modules/markets/lib/llama";
import { SITE_URL } from "@/lib/seo";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Coin and protocol pages already carry `generateMetadata` AND a canonical -
// they were built to be indexed, and were simply never advertised. They are the
// largest indexable surface on the site.
//
// ⚠️ These used to be fetched from this site's OWN api routes (`${SITE_URL}/api/...`).
// That was wrong twice over: a serverless function calling itself back through
// the CDN is fragile, and the failure was silent by design - so in production
// the sitemap quietly served only the handful of static routes with no coin
// pages at all, which is exactly what it did. Now:
//   - coins come straight from the upstream, with a long cache window, and
//   - a small curated fallback guarantees the sitemap is never coin-less.
//
// The fallback is COINS ONLY. A wrong CoinGecko id is one I can verify by
// eye - these are canonical and stable - whereas guessing a llama.fi protocol
// slug would publish a 404 to Google, which is worse than publishing nothing.
const MAX_COINS = 100;
const MAX_PROTOCOLS_PER_TYPE = 40;

// Enough of the majors that the sitemap always carries real coin pages even if
// the upstream is down. Every one of these resolves at /markets/<id>.
const FALLBACK_COINS = [
  "bitcoin", "ethereum", "tether", "solana", "binancecoin", "ripple", "usd-coin",
  "cardano", "dogecoin", "tron", "avalanche-2", "chainlink", "polkadot", "matic-network",
  "litecoin", "shiba-inu", "uniswap", "aave", "arbitrum", "optimism",
];

async function getJson(url: string, revalidate: number): Promise<any | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: "application/json" },
      next: { revalidate },
    });
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
      // ⚠️ A trashed post in the sitemap is an active instruction to search
      // engines to keep indexing a page that no longer exists.
      where: { published: true, ...NOT_TRASHED },
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
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/disclaimer`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
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

  // Market pages. Fetched straight from the upstream (never from our own
  // origin) with a long cache window, since a sitemap does not need
  // minute-fresh data. Both are best-effort.
  const [coinsRes, dexRes, feeRes, perpRes] = await Promise.all([
    getJson(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false",
      3600
    ),
    // Shared with /api/markets/{dex,perp} via llama.ts. These bodies are over
    // 2 MB, so the data cache always refused them and the sitemap paid for its
    // own copy of a download the markets routes had already made. `.catch`
    // keeps the old contract: a failed upstream omits a section rather than
    // failing the sitemap.
    llamaOverview("dexs").catch(() => null),
    llamaOverview("fees").catch(() => null),
    llamaOverview("derivatives").catch(() => null),
  ]);

  const liveCoinIds = (Array.isArray(coinsRes) ? coinsRes : [])
    .map((c: { id?: unknown }) => String(c?.id ?? ""))
    .filter(Boolean);
  // Never emit a coin-less sitemap: fall back rather than silently drop them.
  const coinIds = (liveCoinIds.length ? liveCoinIds : FALLBACK_COINS).slice(0, MAX_COINS);

  const coinRoutes: MetadataRoute.Sitemap = coinIds.map((id) => ({
    url: `${SITE_URL}/markets/${encodeURIComponent(id)}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.5,
  }));

  // `type` must match the segment the app links to and the TYPES set the page
  // validates against ("derivatives" | "dexs" | "fees") - a mismatch would
  // publish URLs that 404. No fallback here on purpose: a guessed slug is a
  // guaranteed 404, which is worse than omitting the section.
  const protocolRoutes: MetadataRoute.Sitemap = (
    [
      ["derivatives", perpRes?.protocols],
      ["dexs", dexRes?.protocols],
      ["fees", feeRes?.protocols],
    ] as const
  ).flatMap(([type, rows]) =>
    (Array.isArray(rows) ? rows : [])
      .map((r: { slug?: unknown; module?: unknown }) => String(r?.slug ?? r?.module ?? ""))
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
