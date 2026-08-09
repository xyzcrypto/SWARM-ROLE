import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // `/news/read` is deliberately NOT listed. It sends `noindex`, and a
      // crawler has to be allowed to fetch the page to see that header at all -
      // disallowing it here would hide the very directive that keeps it out of
      // the index, and Google can still index a disallowed URL it finds linked
      // elsewhere. Allow the crawl, let the noindex do the work.
      // `/settings`, `/messages` and `/journal` are personal and auth-gated, so
      // there is nothing to de-index - crawling them only burns budget on
      // redirects, which is what disallow is actually for.
      // `/login` and `/forgot-password` are NOT here. They send `noindex`, and a
      // crawler must be allowed to fetch a page to see that - blocking them
      // would hide the directive and leave anything already indexed stuck
      // there. Allow the crawl, let the noindex remove them.
      // `/signup` is deliberately absent from both: it is a real landing page
      // and is listed in the sitemap on purpose.
      // These remaining entries are auth-gated app surfaces with nothing to
      // de-index - blocking them just saves the crawl budget of a redirect.
      disallow: ["/dashboard", "/api/", "/settings", "/messages", "/journal"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
