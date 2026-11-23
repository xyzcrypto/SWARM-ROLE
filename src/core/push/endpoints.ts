/**
 * Which push endpoints we will ever send to (security audit F-07).
 *
 * A browser's push subscription endpoint is a URL on its vendor's push
 * service. The subscribe route used to accept ANY URL, and the server then
 * POSTed to it on every DM and news alert, so a member could register
 * `http://10.0.0.1:8080/...` (or any host on the internet) and turn the server
 * into a blind request cannon. Only the real push services are allowed now,
 * over https. Pure, for tests.
 */
const EXACT = new Set(["fcm.googleapis.com", "android.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"]);
const SUFFIXES = [".push.services.mozilla.com", ".notify.windows.com", ".push.apple.com"];

export function isPushServiceEndpoint(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return false;
    const h = u.hostname.toLowerCase();
    return EXACT.has(h) || SUFFIXES.some((s) => h.endsWith(s));
  } catch {
    return false;
  }
}

/** Most push subscriptions one account may hold (one per browser/device). */
export const MAX_PUSH_SUBS_PER_USER = 10;
