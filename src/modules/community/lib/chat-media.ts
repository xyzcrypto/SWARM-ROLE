// Shared media-URL detection for chat + DMs. A message is rendered as an inline
// image/GIF ONLY when its whole body is a single trusted media URL: a GIF from
// giphy/tenor (the GIF picker) or an image in OUR Supabase Storage / an inline
// data image (uploads). Arbitrary pasted image links stay plain links.
const GIF_HOSTS = /^https?:\/\/(media\d*\.giphy\.com|i\.giphy\.com|media\.tenor\.com|c\.tenor\.com|tenor\.com)\//i;

const STORAGE_PATH_PREFIX = "/storage/v1/object/public/";

/**
 * Origins we will render storage images from.
 *
 * Read from `process.env` directly rather than importing `@/lib/env` on purpose:
 * this module is bundled into the chat client (ChatClient, MessagesClient,
 * CommunityPreview), and the env module carries a zod schema plus a
 * module-level `console.error` loop that would then run in every visitor's
 * browser on /community and /messages. Same values, no client-bundle cost.
 *
 * Both vars are consulted because `chatMediaUrl` runs on BOTH sides: the browser
 * (where only NEXT_PUBLIC_* exists, inlined at build) and the server (the DM
 * preview in api/dm/[id]). Whichever is present wins.
 *
 * Computed per call rather than memoized at module load so tests can stub the
 * env; the cost is one URL parse, trivial next to rendering a message.
 */
function allowedStorageOrigins(): string[] {
  const out: string[] = [];
  for (const raw of [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_URL]) {
    if (!raw) continue;
    try {
      out.push(new URL(raw).origin);
    } catch {
      // A malformed configured URL counts as "not configured" rather than
      // throwing inside a render path.
    }
  }
  return out;
}

/**
 * True only for an image served from our own Supabase Storage.
 *
 * This used to be `t.includes("/storage/v1/object/public/")` - a substring test
 * against the whole URL, so https://attacker.example/storage/v1/object/public/x.gif
 * passed, and every connected chat client would fetch it, handing the attacker
 * the IP / User-Agent / online-timing of the entire room. It is now an origin
 * match, mirroring how GIF_HOSTS above anchors its hosts.
 *
 * FAILS CLOSED when no Supabase origin is configured. That is safe rather than
 * disruptive: with storage unconfigured, `uploadImage()` (src/lib/storage.ts)
 * stores uploads as inline `data:` URLs, which take the separate branch below -
 * so a deployment without Supabase has no legitimate storage URLs to render.
 */
function isOwnStorageUrl(raw: string): boolean {
  const origins = allowedStorageOrigins();
  if (origins.length === 0) return false;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false; // malformed input must never escape as a throw
  }
  return origins.includes(u.origin) && u.pathname.startsWith(STORAGE_PATH_PREFIX);
}

export function chatMediaUrl(text: string): string | null {
  const t = text.trim();
  if (/\s/.test(t)) return null; // must be a lone URL, no other text
  if (/^data:image\//.test(t)) return t;
  if (!/^https?:\/\//.test(t)) return null;
  if (GIF_HOSTS.test(t)) return t;
  if (isOwnStorageUrl(t)) return t;
  return null;
}

/**
 * A voice note: a message whose whole body is one of OUR Storage audio URLs,
 * under `voice/`, optionally carrying its length as `#d=<seconds>`.
 *
 * The length rides in the fragment because Chrome's MediaRecorder writes WebM
 * with no duration in the header, so the player would otherwise show "0:00"
 * or "Infinity" until the whole file had been played once. A fragment is never
 * sent to the server, so the stored object is untouched by it.
 *
 * Same origin rule as images: anything not from our own Storage stays text.
 */
export function chatAudioUrl(text: string): { src: string; duration: number | null } | null {
  const t = text.trim();
  if (/\s/.test(t) || !/^https?:\/\//.test(t)) return null;
  const [base, frag = ""] = t.split("#", 2) as [string, string?];
  if (!isOwnStorageUrl(base)) return null;
  let path: string;
  try { path = new URL(base).pathname; } catch { return null; }
  if (!/\/voice\/[a-z0-9-]+\.(webm|ogg|m4a)$/i.test(path)) return null;
  const d = /(?:^|&)d=(\d{1,3}(?:\.\d{1,2})?)(?:&|$)/.exec(frag)?.[1];
  const duration = d ? Number(d) : null;
  return { src: base, duration: duration && duration > 0 && duration <= 600 ? duration : null };
}

/** What a list preview or a quote says a message is. */
export function mediaLabel(text: string): string | null {
  if (chatAudioUrl(text)) return "\u{1F3A4} Voice message";
  if (chatMediaUrl(text)) return "\u{1F4F7} Photo";
  return null;
}
