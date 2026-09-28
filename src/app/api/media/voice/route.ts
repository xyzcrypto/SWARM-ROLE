import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { uploadAudio, MAX_VOICE_BYTES } from "@/lib/storage";

export const runtime = "nodejs";

// POST /api/media/voice - a signed-in member uploads a voice note (DMs, and the
// room for staff - the same rule as photos). Returns the Storage URL, which the
// client then sends as the message body. Storage only; see `uploadAudio`.
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);

    // Two keys, as for anything one person can spam at another.
    {
      const { success } = await rateLimit("comment", `voice-${me.id}`);
      if (!success) return fail("Too many voice messages. Please slow down.", 429);
    }
    {
      const { success } = await rateLimit("comment", `voice-ip-${clientIp(req)}`);
      if (!success) return fail("Too many voice messages. Please slow down.", 429);
    }

    // Refuse by the declared length before reading a byte of a huge body.
    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_VOICE_BYTES + 64 * 1024) return fail("Voice message is too long.", 413);

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return fail("No recording provided.", 400);
    if (file.size > MAX_VOICE_BYTES) return fail("Voice message is too long.", 413);

    const result = await uploadAudio(await file.arrayBuffer());
    if (!result.ok) return fail(result.error, result.status);
    return ok({ url: result.url }, 201);
  } catch (err) {
    return handleError(err, "media:voice");
  }
}
