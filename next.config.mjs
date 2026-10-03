import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */

// Pragmatic CSP: protective without breaking Next hydration, Google sign-in,
// Google Analytics, web fonts or remote images. 'unsafe-inline' for script/
// style is an ACCEPTED RISK until a nonce pipeline exists (SECURITY-AUDIT
// F-015). 'unsafe-eval' was dropped 2026-07-03 — production Next.js does not
// eval; only dev tooling does, and this header only matters in production.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' https://fonts.gstatic.com data:",
  // worker-src 'self' is required by the PWA service worker (/sw.js, registered
  // in PwaSetup/NewsAlertsToggle). The blob: source and media-src's mediastream:
  // existed only for LiveKit's audio workers and WebRTC playback; Voice Rooms
  // were removed in the 2026-07-19 cost pass, so both are dropped.
  "worker-src 'self'",
  // https://*.supabase.co: voice messages are stored in Supabase Storage and
  // played by an <audio> element, which media-src governs. Without it the
  // browser refused every voice note before a byte was requested - the player
  // rendered, but play() rejected with nothing audible ("voice sunayi nahi
  // deta"). Same host allowance connect-src already carries; images reach
  // Storage through img-src's https: already.
  "media-src 'self' blob: https://*.supabase.co",
  // Supabase Realtime (community chat live presence + broadcasts) opens a
  // WebSocket to wss://<ref>.supabase.co; the https origin covers the initial
  // handshake / REST broadcast fallback. Without these the browser silently
  // blocks them and presence never works.
  // https://*.sentry.io is required for browser-side Sentry: the SDK POSTs
  // events via fetch() to the DSN's ingest host (o<org>.ingest.<region>.
  // sentry.io), which connect-src governs - without it every client event is
  // silently refused by CSP, however correctly the SDK is initialised. The
  // wildcard covers all ingest regions (*. matches multi-label subdomains).
  "connect-src 'self' https://www.google-analytics.com https://www.googletagmanager.com https://*.supabase.co wss://*.supabase.co https://*.sentry.io",
  "frame-src 'self' https://accounts.google.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // `microphone=(self)`, not `()`. `()` blocks the mic for EVERY origin
  // including this one, so the site's own dictation was refused by the browser
  // before any of our code ran - #259's voice input could never have worked.
  // Camera and geolocation stay fully blocked; nothing here needs them.
  // `interest-cohort=()` dropped. It was the opt-out for FLoC, which Google
  // withdrew in 2023 and replaced with the Topics API; no shipping browser has
  // recognised the token since, so every page load logged
  // `Unrecognized feature: 'interest-cohort'` in the console and opted out of
  // nothing. Topics has its own token (`browsing-topics`) and is not enabled
  // for this site, so there is nothing to replace it with.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Strip console.* from production bundles (keep error/warn) - smaller, faster JS.
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  experimental: {
    // (Next 16: instrumentation.ts is picked up by default - no flag needed.)
    // Tree-shake barrel imports from these big libraries into per-symbol imports
    // so we don't ship the whole icon set / motion lib. lucide-react + iconsax
    // are imported by name across 40+ files; this is the biggest bundle win.
    optimizePackageImports: ["lucide-react", "iconsax-react", "framer-motion"],
  },
  images: {
    // Serve modern formats (smaller payloads on both PC and mobile).
    formats: ["image/avif", "image/webp"],
    // Allowlisted remote image hosts (was "**", an SSRF/abuse vector). Add a
    // host here if you reference cover/avatar images from a new domain.
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.unsplash.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "**.googleusercontent.com" },
      { protocol: "https", hostname: "**.githubusercontent.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "**.supabase.co" }, // Supabase Storage uploads
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The explainer film. Files are versioned in their names (…-v1-…), so a
      // new cut is a new URL and these can be cached for a year without a
      // revalidation round trip on every visit.
      { source: "/media/explainer/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ];
  },
};

// Sentry build wrapper. Source-map upload only runs when SENTRY_AUTH_TOKEN is
// set (optional); otherwise this is inert and the build is unchanged.
export default withSentryConfig(nextConfig, {
  silent: true,
  // (disableLogger removed: deprecated in the Sentry SDK, and its replacement
  // webpack.treeshake.removeDebugLogging isn't supported under Turbopack, which
  // is the default builder on Next 16 - so there's nothing to migrate it to.)
  widenClientFileUpload: false,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  telemetry: false,
});
