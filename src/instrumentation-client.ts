// Browser-side error monitoring. No-op until NEXT_PUBLIC_SENTRY_DSN is set.
//
// This lives in instrumentation-client.ts (not the old sentry.client.config.ts)
// because Next 16 builds with Turbopack, and the client Sentry config was only
// ever loaded by Sentry's webpack plugin. Turbopack instead relies on Next's
// native instrumentation-client entrypoint, which is executed on the client.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    // Keep volume low/free-tier-friendly: errors always, light tracing.
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}

// Instrument client-side (App Router) navigations for tracing. Safe to export
// unconditionally - it's a no-op when Sentry isn't initialised (no DSN).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
