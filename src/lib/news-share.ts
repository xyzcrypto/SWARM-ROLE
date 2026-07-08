// Encode/decode a news story into a compact, URL-safe token so it can be shared
// as an on-site link (`/news/read?d=…`) that renders on OUR domain with a rich
// preview - instead of sharing the raw source URL. Client- and server-safe
// (uses btoa/atob, available in modern browsers and Node ≥ 18).

export type SharedStory = {
  u: string; // source url
  t: string; // title
  s?: string; // summary/excerpt
  src?: string; // source name
  img?: string | null; // image url
  ts?: number; // published (ms epoch)
  cat?: string; // category
};

function toUrlSafe(b64: string): string {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromUrlSafe(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return b64 + "=".repeat((4 - (b64.length % 4)) % 4);
}

/** Encode a story to a URL-safe base64 token (UTF-8 safe). */
export function encodeStory(story: SharedStory): string {
  const trimmed: SharedStory = {
    u: story.u,
    t: (story.t || "").slice(0, 300),
    s: (story.s || "").slice(0, 600),
    src: story.src?.slice(0, 80),
    img: story.img || undefined,
    ts: story.ts,
    cat: story.cat?.slice(0, 40),
  };
  const json = JSON.stringify(trimmed);
  return toUrlSafe(btoa(unescape(encodeURIComponent(json))));
}

/** Decode a token back to a story, or null if malformed / missing a URL. */
export function decodeStory(token: string): SharedStory | null {
  try {
    const json = decodeURIComponent(escape(atob(fromUrlSafe(token))));
    const obj = JSON.parse(json);
    if (obj && typeof obj.u === "string" && typeof obj.t === "string" && obj.u) return obj as SharedStory;
    return null;
  } catch {
    return null;
  }
}

/** Build the full shareable on-site URL for a story. */
export function shareUrl(origin: string, story: SharedStory): string {
  return `${origin}/news/read?d=${encodeStory(story)}`;
}
