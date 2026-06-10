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

type UploadResult =
  | { ok: true; url: string }
  | { ok: false; error: string; status: number };

/**
 * Upload bytes to a public Supabase Storage bucket via the Storage REST API
 * (no @supabase/supabase-js dependency) and return the public URL.
 */
export async function uploadImage(bytes: ArrayBuffer, mime: string): Promise<UploadResult> {
  if (!storageEnabled) {
    return { ok: false, error: "Image upload is not configured.", status: 501 };
  }
  if (!isAllowedImageType(mime)) {
    return { ok: false, error: "Unsupported image type.", status: 400 };
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
