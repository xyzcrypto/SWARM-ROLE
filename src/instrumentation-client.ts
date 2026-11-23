// Browser-side error monitoring. No-op (and nothing downloaded) until
// NEXT_PUBLIC_SENTRY_DSN is set - see shared/utils/report-error.ts for why the
// SDK is no longer imported here directly.
//
// This lives in instrumentation-client.ts (not the old sentry.client.config.ts)
// because Next 16 builds with Turbopack, and the client Sentry config was only
// ever loaded by Sentry's webpack plugin. Turbopack instead relies on Next's
// native instrumentation-client entrypoint, which is executed on the client.
import { loadSentry } from "@shared/utils/report-error";

const sentry = loadSentry();

// Instrument client-side (App Router) navigations for tracing once the SDK has
// loaded. A no-op without a DSN.
export const onRouterTransitionStart = (href: string, navigationType: string): void => {
  void sentry?.then((S) => S.captureRouterTransitionStart(href, navigationType)).catch(() => {});
};
