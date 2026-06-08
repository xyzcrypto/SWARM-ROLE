/** @type {import('next').NextConfig} */

const securityHeaders = [
  // Prevent DNS-prefetch leaks to third parties
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // Force HTTPS for 2 years — Vercel always serves HTTPS
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Block clickjacking via iframes
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Limit referrer info in cross-origin requests
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable unused browser features
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // HTTPS-only for all admin-uploaded cover image URLs.
      // Tighten to explicit hostnames (e.g. images.unsplash.com, assets.coingecko.com)
      // during the Phase 11 security audit once the full domain list is known.
      { protocol: "https", hostname: "**" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
