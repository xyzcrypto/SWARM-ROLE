import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// In-memory rate limiter (per edge instance)
// For multi-instance production, replace with Upstash Redis rate limiting.
const rateMap = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60;           // 60 requests per minute per IP for API
const AUTH_RATE_LIMIT_MAX = 10;      // 10 requests per minute for auth endpoints

function getRateLimit(ip: string, max: number): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

// Clean up stale entries periodically to prevent memory leaks
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of rateMap.entries()) {
      if (now > val.resetAt) rateMap.delete(key);
    }
  }, 5 * 60_000);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Determine client IP for rate limiting
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  // --- Rate Limiting ---
  if (pathname.startsWith("/api/")) {
    const isAuthEndpoint =
      pathname.startsWith("/api/auth/") ||
      pathname.startsWith("/api/signup");

    const allowed = getRateLimit(
      ip + pathname.split("/")[2], // bucket per endpoint group
      isAuthEndpoint ? AUTH_RATE_LIMIT_MAX : RATE_LIMIT_MAX
    );

    if (!allowed) {
      return new NextResponse(
        JSON.stringify({ error: "Too many requests. Please slow down." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "60",
          },
        }
      );
    }
  }

  // --- Route Protection ---
  if (pathname.startsWith("/dashboard")) {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (token.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // Build response and inject security headers
  const res = NextResponse.next();

  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-XSS-Protection", "1; mode=block");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  res.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://*.supabase.co https://accounts.google.com",
      "frame-ancestors 'none'",
    ].join("; ")
  );

  return res;
}

export const config = {
  matcher: [
    // Apply to all paths except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|logo.jpg).*)",
  ],
};
