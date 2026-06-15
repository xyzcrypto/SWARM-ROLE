import { env, storageEnabled } from "@/lib/env";

const ALLOWED = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/avif", "avif"],
]);

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

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
  if (!storageEnabled) {
    return { ok: false, error: "Image upload is not configured.", status: 501 };
  }
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
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[storage] upload failed", res.status, detail);
      return { ok: false, error: "Upload failed. Please try again.", status: 502 };
    }
    const url = `${env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
    return { ok: true, url };
  } catch (err) {
    console.error("[storage] upload error", err);
    return { ok: false, error: "Upload failed. Please try again.", status: 502 };
  }
}
