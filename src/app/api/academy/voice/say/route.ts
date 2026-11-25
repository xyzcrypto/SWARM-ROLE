import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { cleanVoiceText, renderNeural } from "@modules/academy/lib/neural-voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const NO_STORE = { "Cache-Control": "private, no-store" };

// GET /api/academy/voice/say?l=en|hi&t=<text>
// AneQue's neural voice for text that has no studio recording. The same text
// always renders the same audio, so a result is cached at the edge for a year
// (the URL is the key): each distinct sentence costs one render, ever.
// A failure answers 503 uncached; the client then skips the piece silently
// (the caption still shows), never falling back to the device's robot voice.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const text = cleanVoiceText(u.searchParams.get("t"));
  const lang = u.searchParams.get("l") === "hi" ? "hi" : "en";
  if (text.length < 1) return NextResponse.json({ error: "Nothing to say." }, { status: 400, headers: NO_STORE });
  const ip = clientIp(req);
  const [a, b] = await Promise.all([rateLimit("academyVoice", ip), rateLimit("academyVoiceDaily", ip)]);
  if (!a.success || !b.success) return NextResponse.json({ error: "Slow down a little." }, { status: 429, headers: NO_STORE });
  const r = await renderNeural(text, lang);
  if (!r) return NextResponse.json({ error: "Voice unavailable." }, { status: 503, headers: NO_STORE });
  return new NextResponse(Buffer.from(r.audio), {
    headers: {
      "Content-Type": "audio/wav",
      "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
      "X-Voice": r.provider,
    },
  });
}
