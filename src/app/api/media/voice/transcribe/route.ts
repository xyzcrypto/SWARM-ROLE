import { unstable_cache } from "next/cache";
import { z } from "zod";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { chatAudioUrl } from "@modules/community/lib/chat-media";
import { sniffAudioType, MAX_VOICE_BYTES } from "@/lib/storage";
import { transcribeAudio, transcribeEnabled } from "@/lib/ai/transcribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ url: z.string().url().max(2048) });

/**
 * One transcript per voice note, however many people ask. A day is plenty:
 * the audio at a URL never changes. The cached value is the few hundred bytes
 * of text, never the audio.
 */
const transcriptFor = unstable_cache(
  async (src: string): Promise<string> => {
    // Every failure THROWS rather than returning a value: unstable_cache would
    // otherwise remember a transient outage for a whole day.
    const res = await fetch(src, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`audio ${res.status}`);
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_VOICE_BYTES) throw new Error("audio too large");
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > MAX_VOICE_BYTES) throw new Error("audio too large");
    const mime = sniffAudioType(bytes);
    if (!mime) throw new Error("not audio");
    const text = await transcribeAudio(bytes, mime);
    if (text === null) throw new Error("transcription unavailable");
    return text;
  },
  ["voice-transcript-v1"],
  { revalidate: 86_400 }
);

// POST /api/media/voice/transcribe { url } - the words in a voice message.
//
// Only OUR voice notes: `chatAudioUrl` accepts nothing but our own Storage
// origin under `voice/`, so this can never be pointed at an arbitrary URL.
// Signed-in, two rate-limit keys (the AI bucket - this spends model quota).
// The answer can be private (a DM), so it is never edge-cached.
export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    if (!transcribeEnabled) return fail("Voice transcription isn't available right now.", 503);
    {
      const { success } = await rateLimit("ai", `transcribe-${me.id}`);
      if (!success) return fail("You're going too fast. Take a breath.", 429);
    }
    {
      const { success } = await rateLimit("ai", `transcribe-ip-${clientIp(req)}`);
      if (!success) return fail("You're going too fast. Take a breath.", 429);
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Invalid voice message.", 400);
    const voice = chatAudioUrl(parsed.data.url);
    if (!voice) return fail("That isn't a voice message.", 400);

    const text = await transcriptFor(voice.src).catch(() => null);
    if (text === null) return fail("Couldn't transcribe this voice message. Try again later.", 502);
    return ok({ text }, 200);
  } catch (err) {
    return handleError(err, "media:transcribe");
  }
}
