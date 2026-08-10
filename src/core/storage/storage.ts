import { env, storageEnabled } from "@/lib/env";

const ALLOWED = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/avif", "avif"],
]);

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

// When no external Storage is configured we embed the (already client-compressed)
// image inline as a data URL so uploads work with zero setup. Capped well below
// the 5 MB file limit to keep DB rows + page payloads reasonable; anything larger
// needs Supabase Storage or the paste-a-link fallback.
export const INLINE_MAX_BYTES = 700 * 1024; // ~700 KB

/** Random, collision-resistant object path for an uploaded image. */
export function buildObjectPath(mime: string): string {
  const ext = ALLOWED.get(mime) ?? "bin";
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `covers/${id}.${ext}`;
}

export function isAllowedImageType(mime: string): boolean {
  return ALLOWED.has(mime);
}

/**
 * Detect the real image type from the file's magic bytes - never trust the
 * client-supplied Content-Type. Returns a canonical allowed mime, or null if the
 * bytes don't match a supported image signature. Used as the authoritative check
 * before any upload (defense against a non-image uploaded with an image header).
 */
export function sniffImageType(bytes: ArrayBuffer): string | null {
  const b = new Uint8Array(bytes);
  if (b.length < 12) return null;
  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) return "image/png";
  // GIF: "GIF8"
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  // WEBP: "RIFF"...."WEBP"
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) return "image/webp";
  // AVIF: ...."ftyp" + brand "avif"/"avis"
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (brand === "avif" || brand === "avis") return "image/avif";
  }
  return null;
}

type UploadResult =
  | { ok: true; url: string }
  | { ok: false; error: string; status: number };

/**
 * Upload bytes to a public Supabase Storage bucket via the Storage REST API
 * (no @supabase/supabase-js dependency) and return the public URL.
 */
export async function uploadImage(bytes: ArrayBuffer, declaredMime: string): Promise<UploadResult> {
  // Cheap early reject on the declared header...
  if (!isAllowedImageType(declaredMime)) {
    return { ok: false, error: "Unsupported image type.", status: 400 };
  }
  // ...then the authoritative check: the bytes must actually be a supported
  // image (a renamed non-image with an image Content-Type is rejected here).
  const mime = sniffImageType(bytes);
  if (!mime) {
    return { ok: false, error: "That file doesn't look like a valid image.", status: 400 };
  }
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Image is too large (max 5 MB).", status: 413 };
  }

  // Store the (client-compressed) image inline as a data URL. Used both when no
  // external Storage is configured AND as a fallback when a configured Storage
  // upload fails - so direct upload ALWAYS works with zero setup.
  const inline = (): UploadResult => {
    if (bytes.byteLength > INLINE_MAX_BYTES) {
      return {
        ok: false,
        error: "Image is a bit large to store directly (max ~700 KB). Use a smaller image or paste a link.",
        status: 413,
      };
    }
    return { ok: true, url: `data:${mime};base64,${Buffer.from(bytes).toString("base64")}` };
  };

  // No Storage configured → inline immediately.
  if (!storageEnabled) return inline();

  // Storage configured: try it, but fall back to inline on ANY failure (e.g. the
  // bucket doesn't exist / isn't public yet), so uploads never dead-end.
  const bucket = env.SUPABASE_STORAGE_BUCKET;
  const path = buildObjectPath(mime);
  const endpoint = `${env.SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": mime,
        "x-upsert": "false",
        "cache-control": "31536000",
      },
      body: bytes,
    });
    if (res.ok) {
      const publicUrl = `${env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
      if (await isPubliclyReadable(publicUrl)) return { ok: true, url: publicUrl };
      // Stored, but nobody can read it. Keep going - `inline()` below is the
      // path that is actually known to render.
    } else {
      const detail = await res.text().catch(() => "");
      console.error("[storage] upload failed, falling back to inline", res.status, detail);
    }
  } catch (err) {
    console.error("[storage] upload error, falling back to inline", err);
  }
  // Supabase attempt failed → inline so the user's upload still succeeds.
  return inline();
}

/**
 * Can an anonymous browser actually GET this object?
 *
 * ## Why an upload that "succeeded" is not enough
 *
 * The POST above is authenticated with the service-role key, which can write to
 * a bucket whether or not that bucket is public. So a private bucket accepts the
 * upload and returns 200, we hand back a `.../object/public/...` URL, and the
 * database stores it. Every layer reports success. Then the browser - and the
 * `next/image` optimizer - fetch that URL with no credentials, Supabase answers
 * 400, and the photo renders as nothing.
 *
 * From the member's side that is exactly: **"I added a profile photo, it said it
 * saved, and it never showed up anywhere."** Nothing logs, nothing 500s, and
 * re-uploading reproduces it forever, because the bucket is a dashboard setting
 * (`HANDOFF.md` step 2: "create a **public** bucket") that no code has ever
 * checked. This is the same failure shape this project keeps re-learning: a
 * fallback that hides the very thing it exists to protect against.
 *
 * One unauthenticated range request per upload settles it. Uploads are rare and
 * already doing far more work than this, and the answer decides between a URL
 * that renders and one that never will.
 *
 * A `Range: bytes=0-0` GET rather than HEAD: it costs one byte, and it is
 * universally supported, whereas a storage backend answering 405 to HEAD would
 * read as "broken" and push a perfectly good upload down the inline path.
 * Erring is cheap in this direction and expensive in the other - inline is
 * verified end-to-end (`/api/media` serves it), so a false negative still leaves
 * the member with a working photo.
 */
async function isPubliclyReadable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { headers: { Range: "bytes=0-0" }, cache: "no-store" });
    if (res.ok || res.status === 206) return true;
    console.error(
      `[storage] uploaded object is NOT publicly readable (${res.status}). ` +
        `Is the "${env.SUPABASE_STORAGE_BUCKET}" bucket public? Storing the image inline instead.`
    );
    return false;
  } catch (err) {
    console.error("[storage] could not verify public readability, storing inline instead", err);
    return false;
  }
}
