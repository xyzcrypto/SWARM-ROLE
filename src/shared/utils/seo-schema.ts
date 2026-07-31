// Pure JSON-LD builders (no JSX) - kept separate from the <JsonLd> component in
// jsonld.tsx so they can be imported in node-env unit tests. jsonld.tsx re-exports
// everything here, so `@/lib/jsonld` remains the single import site for app code.
import { SITE_URL, absoluteUrl } from "@/lib/seo";
import { site } from "@/lib/site";

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.name,
    alternateName: "XYZ Crypto Ecosystem",
    url: SITE_URL,
    logo: { "@type": "ImageObject", url: absoluteUrl("/logo.png"), width: 640, height: 640 },
    image: absoluteUrl("/logo.png"),
    description: site.description,
    slogan: site.slogan,
    // Strengthens the brand entity for "XYZ Crypto" queries (knowledge panel).
    foundingDate: "2019",
    email: site.email,
    knowsAbout: [
      "Web3",
      "Cryptocurrency",
      "DeFi",
      "On-chain research",
      "Perpetual DEX",
      "Airdrops",
      "Crypto trading tools",
      "Blockchain education",
    ],
    areaServed: "Worldwide",
    sameAs: [site.socials.youtube, site.socials.x, site.socials.telegram, site.socials.linkedin],
  };
}

// FAQPage structured data - surfaces brand Q&As on the SERP and reinforces the
// "XYZ Crypto" entity. Pair with the visible FAQ section (same source data).
export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.name,
    url: SITE_URL,
    description: site.description,
    // Enables a Google sitelinks search box for branded queries.
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: absoluteUrl("/research?q={search_term_string}"),
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function articleJsonLd(post: {
  title: string;
  excerpt: string;
  slug: string;
  cover: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  author?: { name: string | null } | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    image: [post.cover || absoluteUrl("/logo.png")],
    datePublished: new Date(post.createdAt).toISOString(),
    dateModified: new Date(post.updatedAt).toISOString(),
    author: post.author?.name
      ? { "@type": "Person", name: post.author.name }
      : { "@type": "Organization", name: site.name },
    publisher: {
      "@type": "Organization",
      name: site.name,
      logo: { "@type": "ImageObject", url: absoluteUrl("/logo.png"), width: 640, height: 640 },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": absoluteUrl(`/research/${post.slug}`),
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}
