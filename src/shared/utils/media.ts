/**
 * Decoding helpers for images stored as inline `data:` URLs in the database
 * (the zero-config upload fallback in `storage.ts`).
 *
 * Kept out of the route module so the unit tests can import it without pulling
 * in a route handler (and its Prisma client) - a route file is also only meant
 * to export handlers and the recognised config values.
 */

const MIME_OK = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

/** Split `data:<mime>;base64,<payload>` into its parts, or null if malformed. */
export function parseDataUrl(value: string): { mime: string; body: Buffer } | null {
  const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,(.+)$/is.exec(value);
  if (!match) return null;
  const mime = match[1]!.toLowerCase();
  // Only ever hand back an image type. The upload path already sniffs magic
  // bytes, but the media route reflects a DB value straight into a
  // Content-Type header, so it re-checks rather than trusting the row.
  if (!MIME_OK.has(mime)) return null;
  try {
    return { mime, body: Buffer.from(match[2]!, "base64") };
  } catch {
    return null;
  }
}
