import { AccessToken } from "livekit-server-sdk";
import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { env, voiceEnabled } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The single community voice room (Telegram-style lounge call).
const ROOM = "xyz-lounge";

// POST /api/voice/token - mint a short-lived LiveKit token for the signed-in
// member to join the community voice room. Logged-in + rate-limited; graceful
// 503 when LiveKit isn't configured.
export async function POST() {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in to join voice.", 401);
    if (!voiceEnabled) return fail("Voice chat isn't set up yet.", 503);

    const { success } = await rateLimit("chat", me.id);
    if (!success) return fail("Slow down a moment.", 429);

    const name = (me as { name?: string | null }).name || "Member";
    const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
      identity: me.id,
      name,
      ttl: "2h",
    });
    at.addGrant({ room: ROOM, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true });

    const token = await at.toJwt();
    return ok({ token, url: env.NEXT_PUBLIC_LIVEKIT_URL, room: ROOM });
  } catch (err) {
    return handleError(err, "voice:token");
  }
}
