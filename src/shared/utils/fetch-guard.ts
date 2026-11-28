/**
 * A default timeout for every call to this site's own `/api/*` from the
 * browser, installed once by NavProgress (root layout).
 *
 * ## Why
 *
 * About 130 `fetch()` calls across ~40 client files (dashboard, news, journal,
 * settings, comments, likes, follow, sign-up...) had no timeout. On a weak
 * mobile connection a request can stall forever: the request was sent, the
 * connection silently died, and nothing ever rejects. The button spinner then
 * runs until a refresh, which is exactly the "task karte karte stuck" report.
 * Fixing each call site by hand would be 130 chances to miss one, and every
 * new feature would reintroduce it. One guard here covers them all.
 *
 * ## What it does
 *
 * A same-origin `/api/` request that the caller did NOT give its own `signal`
 * gets `AbortSignal.timeout(ms)`. The signal stays attached to the response,
 * so a body that stops arriving half-way is aborted too (the stall the Academy
 * quiz hit in #435). The caller sees an ordinary rejected promise and its own
 * catch path shows its own error, so the UI recovers instead of spinning.
 *
 * Callers that pass a signal are left alone: they manage their own lifetime
 * (the Academy's getJson, long-lived streams).
 */

export const GUARD_GET_MS = 20_000;
export const GUARD_WRITE_MS = 30_000;
export const GUARD_UPLOAD_MS = 120_000;

/** Long-lived responses that must never be cut: streamed AI answers, generated audio. */
const UNGUARDED = [/^\/api\/ai\/assistant/, /^\/api\/ai\/why-matters/, /^\/api\/academy\/voice\//, /^\/api\/academy\/aneque/, /^\/api\/track$/];
/** Routes that take file uploads: slow phones need minutes, not seconds. */
const UPLOADS = [/^\/api\/profile\/(avatar|banner)/, /^\/api\/media\//, /^\/api\/upload/];

/** Pure, for tests: the timeout to apply to this request, or null to leave it alone. */
export function guardFor(url: string, init: RequestInit | undefined, origin: string): number | null {
  if (init?.signal) return null;
  let u: URL;
  try {
    u = new URL(url, origin);
  } catch {
    return null;
  }
  if (u.origin !== origin || !u.pathname.startsWith("/api/")) return null;
  if (UNGUARDED.some((r) => r.test(u.pathname))) return null;
  const body = init?.body;
  const isFile = typeof FormData !== "undefined" && body instanceof FormData;
  const isBlob = typeof Blob !== "undefined" && body instanceof Blob;
  if (isFile || isBlob || UPLOADS.some((r) => r.test(u.pathname))) return GUARD_UPLOAD_MS;
  const method = (init?.method ?? "GET").toUpperCase();
  return method === "GET" || method === "HEAD" ? GUARD_GET_MS : GUARD_WRITE_MS;
}

let installed = false;

export function installFetchGuard() {
  if (installed || typeof window === "undefined" || typeof AbortSignal === "undefined" || typeof AbortSignal.timeout !== "function") return;
  installed = true;
  const orig = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    // A Request object carries its own signal; only plain URLs are guarded.
    if (typeof input !== "string" && !(input instanceof URL)) return orig(input, init);
    const ms = guardFor(typeof input === "string" ? input : input.href, init, window.location.origin);
    if (ms == null) return orig(input, init);
    return orig(input, { ...init, signal: AbortSignal.timeout(ms) });
  };
}
