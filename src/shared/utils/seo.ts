// Canonical site URL for SEO/metadata/sitemap. Prefers an explicit public env,
// falls back to the auth URL, then localhost. Trailing slash stripped.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXTAUTH_URL ||
  "http://localhost:3000"
).replace(/\/+$/, "");

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "";
export const GSC_VERIFICATION = process.env.NEXT_PUBLIC_GSC_VERIFICATION || "";

export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Per-page SEO metadata: a self-consistent canonical + OpenGraph + Twitter set
 * for a static route. The root layout supplies the default OG image / site name;
 * this fills in the page-specific title, description, canonical URL and OG url so
 * each index page is individually indexable + shareable. `path` is a site-root
 * path like "/markets".
 */
export function pageSeo({ title, description, path }: { title: string; description: string; path: string }): import("next").Metadata {
  const url = absoluteUrl(path);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url, type: "website" },
    twitter: { title, description },
  };
}
