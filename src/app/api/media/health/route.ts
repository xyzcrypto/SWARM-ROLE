import { ok, fail, handleError, getAdminSession } from "@/lib/api";
import { env, storageEnabled } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/media/health - admin-only storage diagnostic. Reports whether the
// SERVER-side Supabase storage env is set, the bucket name in use, and does a
// real test upload so the exact Supabase error (bad bucket / key / not public)
// is visible instead of the silent inline fallback.
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return fail("Unauthorized", 401);

    const hasUrl = !!env.SUPABASE_URL;
    const hasServiceKey = !!env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = env.SUPABASE_STORAGE_BUCKET;

    const report: Record<string, unknown> = {
      storageEnabled,
      SUPABASE_URL_set: hasUrl,
      SUPABASE_SERVICE_ROLE_KEY_set: hasServiceKey,
      SUPABASE_STORAGE_BUCKET: bucket,
    };

    if (!storageEnabled) {
      report.diagnosis = "Server Supabase env missing. Set BOTH `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel (these are separate from the NEXT_PUBLIC_ ones), then redeploy.";
      return ok(report);
    }

    // Real test upload of a 1x1 PNG.
    const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="), (c) => c.charCodeAt(0));
    const path = `covers/health-${Date.now()}.png`;
    const endpoint = `${env.SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "image/png", "x-upsert": "false" },
        body: png,
      });
      report.testUploadStatus = res.status;
      const text = await res.text().catch(() => "");
      if (res.ok) {
        report.diagnosis = `Storage works ✅ - photo sharing should function. (Test file: ${path})`;
        report.publicUrl = `${env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
      } else {
        report.supabaseResponse = text.slice(0, 400);
        if (res.status === 400 || res.status === 404) report.diagnosis = `Supabase returned ${res.status} - the bucket "${bucket}" likely doesn't exist or the name doesn't match. Create a bucket named exactly "${bucket}" (or set SUPABASE_STORAGE_BUCKET to your bucket's name).`;
        else if (res.status === 401 || res.status === 403) report.diagnosis = `Supabase returned ${res.status} - the SUPABASE_SERVICE_ROLE_KEY is wrong. Copy the service_role key from Supabase → Settings → API.`;
        else report.diagnosis = `Supabase returned ${res.status}. See supabaseResponse.`;
      }
    } catch (e) {
      report.diagnosis = `Couldn't reach Supabase storage: ${(e as Error)?.message ?? "network error"}. Check SUPABASE_URL.`;
    }

    return ok(report);
  } catch (err) {
    return handleError(err, "media:health");
  }
}
