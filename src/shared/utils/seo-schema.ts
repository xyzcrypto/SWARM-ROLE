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
    logo: { "@type": "ImageObject", url: absoluteUrl("/logo.png"), width: 512, height: 512 },
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
      logo: { "@type": "ImageObject", url: absoluteUrl("/logo.png"), width: 512, height: 512 },
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

/**
 * A member's public profile as a Person. Only fields the profile page already
 * shows publicly go in - never an email, per the site-wide rule that member
 * emails are never exposed (see `maskEmail`).
 *
 * `sameAs` is the part search engines actually use, so it only carries links
 * the member themselves added, and only as absolute URLs: a bare handle like
 * "@someone" is not a URL and would make the whole node invalid.
 */
export function personJsonLd(user: {
  name?: string | null;
  username: string;
  image?: string | null;
  bio?: string | null;
  website?: string | null;
  twitter?: string | null;
  github?: string | null;
}) {
  const sameAs = [
    user.website,
    user.twitter ? `https://x.com/${String(user.twitter).replace(/^@+/, "")}` : null,
    user.github ? `https://github.com/${String(user.github).replace(/^@+/, "")}` : null,
  ].filter((u): u is string => Boolean(u) && /^https?:\/\//i.test(String(u)));

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: user.name || `@${user.username}`,
    alternateName: `@${user.username}`,
    url: absoluteUrl(`/u/${user.username}`),
    ...(user.image ? { image: user.image } : {}),
    ...(user.bio ? { description: user.bio } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    memberOf: { "@type": "Organization", name: site.name, url: SITE_URL },
  };
}
