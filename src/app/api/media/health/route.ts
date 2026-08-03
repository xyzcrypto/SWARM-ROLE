import { ok, fail, handleError, getAdminSession } from "@/lib/api";
import { env, storageEnabled } from "@/lib/env";
import { describeKey } from "@/lib/jwt-shape";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/media/health - admin-only storage diagnostic.
 *
 * Reports whether the SERVER-side Supabase storage env is set, describes the
 * shape of the service-role key without revealing it, and does a real test
 * upload so the exact Supabase error is visible instead of the silent inline
 * fallback.
 *
 * ## The diagnosis used to be wrong, which is worse than having none
 *
 * It branched on the HTTP status alone, and Supabase's Storage API answers
 * **HTTP 400 with the real status inside the body**. A live run returned:
 *
 * ```
 * testUploadStatus: 400
 * supabaseResponse: {"statusCode":"403","error":"Unauthorized",
 *                    "message":"Invalid Compact JWS","code":"AccessDenied"}
 * diagnosis: 'the bucket "post-covers" likely doesn't exist…'
 * ```
 *
 * The bucket was never the problem. `Invalid Compact JWS` means the key was not
 * a well-formed JWT at all - and the diagnosis sent the reader off to create a
 * bucket instead. It now reads the body, and checks the key's shape locally
 * first, because that failure is knowable before any request goes out.
 */
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return fail("Unauthorized", 401);

    const bucket = env.SUPABASE_STORAGE_BUCKET;
    // Never the key itself - only length, structure and the `role` claim, which
    // is what separates "pasted the anon key" from "pasted the right one".
    const key = describeKey(env.SUPABASE_SERVICE_ROLE_KEY, "service_role");

    const report: Record<string, unknown> = {
      storageEnabled,
      SUPABASE_URL_set: !!env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY_set: !!env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_STORAGE_BUCKET: bucket,
      serviceKeyShape: key,
    };

    if (!storageEnabled) {
      report.diagnosis =
        "Server Supabase env missing. Set BOTH `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel (these are separate from the NEXT_PUBLIC_ ones), then redeploy.";
      return ok(report);
    }

    // A malformed key is knowable without a round trip, and it is the single
    // most common cause - report it up front rather than letting the upload
    // fail and then guessing from a status code.
    if (key.verdict) report.keyProblem = key.verdict;

    // Real test upload of a 1x1 PNG.
    const png = Uint8Array.from(
      atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="),
      (c) => c.charCodeAt(0)
    );
    const path = `covers/health-${Date.now()}.png`;
    const endpoint = `${env.SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "image/png",
          "x-upsert": "false",
        },
        body: png,
      });
      report.testUploadStatus = res.status;
      const text = await res.text().catch(() => "");

      if (res.ok) {
        report.diagnosis = `Storage works ✅ - uploads will go to Supabase instead of falling back to inline storage. (Test file: ${path})`;
        report.publicUrl = `${env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
        return ok(report);
      }

      report.supabaseResponse = text.slice(0, 400);

      // Read the BODY, not the status. Supabase wraps auth failures in a 400.
      let body: { statusCode?: string; error?: string; message?: string; code?: string } = {};
      try {
        body = JSON.parse(text);
      } catch {
        /* not JSON - fall through to the status-based guesses below */
      }
      const inner = Number(body.statusCode) || res.status;
      const message = `${body.message ?? ""} ${body.error ?? ""} ${body.code ?? ""}`.toLowerCase();

      if (/invalid compact jws|invalid jwt|jwserror|jwt malformed/.test(message)) {
        report.diagnosis =
          `Supabase rejected the KEY, not the bucket: "${body.message}". The value in SUPABASE_SERVICE_ROLE_KEY is not a valid JWT. ` +
          (key.verdict ? `Local check agrees: ${key.verdict} ` : "") +
          `Fix: Supabase → Settings → API Keys → copy the **service_role** key (it starts with "eyJ" and has three dot-separated parts), paste it into Vercel with no quotes and no trailing newline, and redeploy. The bucket is not the problem here.`;
      } else if (inner === 401 || inner === 403) {
        report.diagnosis =
          `Supabase returned ${inner} (${body.error ?? "Unauthorized"}): the key is well-formed but not accepted. ` +
          `Either it is the wrong key (anon instead of service_role - this one reports role "${key.role ?? "unknown"}"), it has been rotated, or the bucket's policies block it.`;
      } else if (/bucket not found|not_found/.test(message) || inner === 404) {
        report.diagnosis = `Supabase says the bucket "${bucket}" does not exist. Create a bucket named exactly "${bucket}" (or set SUPABASE_STORAGE_BUCKET to your bucket's name), and make it public.`;
      } else if (/duplicate|already exists/.test(message)) {
        report.diagnosis = `The bucket and key are fine - Supabase only refused because that object name already exists. Storage is working.`;
      } else {
        report.diagnosis = `Supabase returned ${res.status} (inner ${inner}). See supabaseResponse for the exact error.`;
      }
    } catch (e) {
      report.diagnosis = `Couldn't reach Supabase storage: ${(e as Error)?.message ?? "network error"}. Check SUPABASE_URL.`;
    }

    return ok(report);
  } catch (err) {
    return handleError(err, "media:health");
  }
}
