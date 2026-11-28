// Web Push - server-only wrapper around `web-push`. Graceful: when VAPID keys
// aren't set, `pushEnabled` is false and `sendPush` is a no-op.
import webpush from "web-push";
import { env, pushEnabled } from "@/lib/env";
import { isPushServiceEndpoint } from "./endpoints";

export { pushEnabled };

let configured = false;
function ensure(): boolean {
  if (!pushEnabled) return false;
  if (!configured) {
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    configured = true;
  }
  return true;
}

export type PushSub = { endpoint: string; p256dh: string; auth: string };
export type PushResult = "ok" | "gone" | "error";

/** Send a push to one subscription. "gone" means the endpoint is dead (prune it). */
export async function sendPush(sub: PushSub, payload: Record<string, unknown>): Promise<PushResult> {
  if (!ensure()) return "error";
  // Rows stored before the subscribe route checked hosts: never POST anywhere
  // but a real push service, and let the caller prune the row.
  if (!isPushServiceEndpoint(sub.endpoint)) return "gone";
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      // Bounded: a push service that stalls must not hold the sender (the
      // streak reminder, chat and news dispatch all await these).
      { timeout: 8000 }
    );
    return "ok";
  } catch (e: unknown) {
    const code = (e as { statusCode?: number })?.statusCode;
    if (code === 404 || code === 410) return "gone";
    console.error("[push] send error", code ?? e);
    return "error";
  }
}
