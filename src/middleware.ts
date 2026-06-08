import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { token } = req.nextauth;
    const { pathname } = req.nextUrl;

    // API admin routes — return JSON 403 instead of an HTML redirect
    if (pathname.startsWith("/api/admin")) {
      if (token?.role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.next();
    }

    // Dashboard pages — admin only; non-admins land on home
    if (pathname.startsWith("/dashboard") && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized({ token, req }) {
        const { pathname } = req.nextUrl;

        // API admin routes: always pass to the middleware function above
        // (it returns a JSON 403 rather than an HTML redirect)
        if (pathname.startsWith("/api/admin")) return true;

        // All other protected routes: require a valid session token
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/account/:path*",
    "/api/admin/:path*",
  ],
};
