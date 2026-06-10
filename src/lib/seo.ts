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
