import { fail, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { MAX_VOICE_BYTES, sniffAudioType } from "@/lib/storage";
import { transcribeAudio, transcribeEnabled } from "@/lib/ai/transcribe";
import { academyError, json, PRIVATE } from "@modules/academy/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// POST /api/academy/aneque/listen  (body: raw audio, ≤ 2 MB)
//
// Live Talk's ears. The browser's own speech recognition is not dependable:
// Brave ships the API but cannot reach Google's speech service ("Speech
// service unreachable"), Firefox has no API at all, and Safari's needs
// Siri enabled. So AneQue records a short clip and it is transcribed here with
// the Whisper model the site already uses for voice messages, which also copes
// with Hindi, English and Hinglish. The audio is never stored.
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Sign in to talk with AneQue.", 401);
    if (!transcribeEnabled) return fail("Live talk isn't available right now.", 503);
    const { success } = await rateLimit("ai", `aneque-listen-${me.id}`);
    if (success && !(await rateLimit("aiDaily", me.id)).success) return fail("That's enough talking for today. Live Talk resets tomorrow.", 429);
    if (!success) return fail("You're talking faster than I can listen. Give me a second.", 429);
    const bytes = await req.arrayBuffer();
    if (!bytes.byteLength) return fail("I didn't catch any audio.", 400);
    if (bytes.byteLength > MAX_VOICE_BYTES) return fail("That was a bit long. Try a shorter question.", 413);
    // The container from its magic bytes, never the declared Content-Type.
    const mime = sniffAudioType(bytes);
    if (!mime) return fail("That isn't audio.", 415);
    const text = await transcribeAudio(bytes, mime);
    if (text === null) return fail("I couldn't hear that clearly. Try again.", 502);
    return json({ text }, PRIVATE);
  } catch (err) {
    return academyError(err, "academy:aneque:listen");
  }
}
