/**
 * Pure helpers for link previews - shared by the API route (parsing a page)
 * and the chat UI (finding the link to preview). No server imports.
 */

export type LinkPreview = { url: string; host: string; title: string; description: string | null; siteName: string | null };

/** The first http(s) link in a message, or null. Trailing punctuation is not part of it. */
export function firstLink(text: string): string | null {
  const m = /https?:\/\/[^\s<>"']+/i.exec(text);
  if (!m) return null;
  return m[0].replace(/[),.;:!?\]]+$/, "");
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

function meta(html: string, keys: string[]): string | null {
  for (const key of keys) {
    // Attribute order varies between sites: property/name before or after content.
    const a = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, "i").exec(html);
    const b = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, "i").exec(html);
    const v = (a ?? b)?.[1]?.trim();
    if (v) return v;
  }
  return null;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const clean = (s: string | null) => (s ? decodeEntities(s).replace(/\s+/g, " ").trim() : null);

/**
 * Title, description and site name from a page's <head>. Text only, on
 * purpose: no og:image. Rendering a third-party image would make every
 * reader's browser fetch it - handing that site the IP and timing of everyone
 * in the room, the same leak `chatMediaUrl` exists to stop.
 */
export function parsePreview(html: string, pageUrl: string): LinkPreview | null {
  const head = html.slice(0, 200_000);
  const titleTag = /<title[^>]*>([^<]*)<\/title>/i.exec(head)?.[1] ?? null;
  const title = clean(meta(head, ["og:title", "twitter:title"]) ?? titleTag);
  if (!title) return null;
  const description = clean(meta(head, ["og:description", "twitter:description", "description"]));
  const siteName = clean(meta(head, ["og:site_name", "application-name"]));
  let host = "";
  try { host = new URL(pageUrl).hostname.replace(/^www\./, ""); } catch { return null; }
  return {
    url: pageUrl,
    host,
    title: clip(title, 140),
    description: description ? clip(description, 220) : null,
    siteName: siteName ? clip(siteName, 60) : null,
  };
}
