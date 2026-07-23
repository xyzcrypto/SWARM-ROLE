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
  // LiveKit's client spins up Web Workers (from blob: URLs) for audio; WebRTC
  // audio playback attaches MediaStreams to <audio>. Without these the voice
  // room can't start.
  "worker-src 'self' blob:",
  "media-src 'self' blob: mediastream:",
  // Supabase Realtime (community chat live presence + broadcasts) opens a
  // WebSocket to wss://<ref>.supabase.co; the https origin covers the initial
  // handshake / REST broadcast fallback. LiveKit signaling connects over
  // wss://*.livekit.cloud. Without these the browser silently blocks them and
  // presence/voice never work.
  "connect-src 'self' https://www.google-analytics.com https://www.googletagmanager.com https://*.supabase.co wss://*.supabase.co https://*.livekit.cloud wss://*.livekit.cloud",
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
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
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
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// Sentry build wrapper. Source-map upload only runs when SENTRY_AUTH_TOKEN is
// set (optional); otherwise this is inert and the build is unchanged.
export default withSentryConfig(nextConfig, {
  silent: true,
  disableLogger: true,
  widenClientFileUpload: false,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  telemetry: false,
});
