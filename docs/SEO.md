# SEO — what's in the code vs. what the owner must do

This project ships solid technical SEO out of the box. A few things, though, can
only be done by a human with access to the domain, Vercel env, and Google Search
Console — those are listed at the bottom.

## What the code already does
- **Per-page metadata** — every indexable page sets a title, description, a
  **canonical URL**, and **OpenGraph + Twitter** cards. Index pages
  (`/markets`, `/news`, `/research`) use the shared `pageSeo()` helper
  (`src/lib/seo.ts`); article pages (`/research/[slug]`) and profiles
  (`/u/[username]`) build their own. The root layout (`src/app/layout.tsx`)
  supplies `metadataBase`, the default OG image, and site-wide title template.
- **Structured data (JSON-LD)** — `Organization` + `WebSite` (with SearchAction)
  on every page via the layout; `FAQPage` on the homepage; `BlogPosting` +
  `BreadcrumbList` on articles; and `BreadcrumbList` on `/markets`, `/news`,
  `/research`. Builders live in `src/lib/seo-schema.ts`.
- **Sitemap** — `src/app/sitemap.ts` emits the homepage, `/markets`, `/news`,
  `/research`, `/premium`, `/community`, `/contact`, `/signup`, every published
  research post, and up to 5,000 public member profiles.
- **robots** — `src/app/robots.ts` (allows crawling, points at the sitemap).

## Owner steps the code can't do
1. **Set the real domain** — `NEXT_PUBLIC_SITE_URL=https://<your-domain>` in the
   Vercel project env (Production + Preview). Everything canonical/sitemap/OG
   derives from this; without it we fall back to `NEXTAUTH_URL` then localhost.
2. **Google Search Console verification** — create the property for the domain,
   choose the "HTML tag" method, copy the `content` value, and set
   `NEXT_PUBLIC_GSC_VERIFICATION=<token>` in Vercel. The layout emits the
   `<meta name="google-site-verification">` tag automatically when it's set.
3. **Submit the sitemap** — in Search Console → Sitemaps, submit
   `https://<your-domain>/sitemap.xml`. (Re-submit is not needed after the first
   time; Google re-crawls it.)
4. *(optional)* **Analytics** — `NEXT_PUBLIC_GA_ID=G-XXXX` to enable GA.
5. *(optional)* **Social preview image** — the default OG image is `/logo.png`;
   swap in a purpose-built 1200×630 image if you want richer link previews.

After the domain + GSC token are set and one deploy has run, request indexing of
the homepage in Search Console to kick things off; the rest follows the sitemap.
