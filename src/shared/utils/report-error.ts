/**
 * Client-side error reporting that costs nothing until it is switched on.
 *
 * ⚠️ `import * as Sentry from "@sentry/nextjs"` in a client file puts the whole
 * browser SDK (with tracing) into the JavaScript every page downloads and runs
 * BEFORE it becomes clickable - it was inside the 419 KB framework chunk, on
 * every route, even though NEXT_PUBLIC_SENTRY_DSN is unset and the SDK reported
 * nothing. On a phone on mobile data that is part of the seconds where a page
 * is visible but taps do nothing.
 *
 * Now the SDK is a separate chunk, fetched only when a DSN exists, after the
 * page is interactive. Behaviour with a DSN is unchanged: errors are captured,
 * router transitions are traced.
 */
type SentryModule = typeof import("@sentry/nextjs");

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
let mod: Promise<SentryModule> | null = null;

export const sentryEnabled = Boolean(DSN);

/** Load (once) and initialise the browser SDK. Null when no DSN is configured. */
export function loadSentry(): Promise<SentryModule> | null {
  if (!DSN) return null;
  mod ??= import("@sentry/nextjs").then((S) => {
    S.init({
      dsn: DSN,
      environment: process.env.NODE_ENV,
      // Keep volume low/free-tier-friendly: errors always, light tracing.
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
    });
    return S;
  });
  return mod;
}

/** Report an error. A no-op (no download at all) without a DSN. */
export function reportError(error: unknown): void {
  void loadSentry()?.then((S) => S.captureException(error)).catch(() => {});
}
