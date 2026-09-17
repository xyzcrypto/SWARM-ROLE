import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, type Permission } from "@/lib/permissions";

/** JSON success response. */
export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/** JSON error response with a safe shape. */
export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** Redacts passwords/credentials from database connection URLs embedded in error strings. */
export function sanitizeDbError(msg: string): string {
  return msg.replace(/(:\/\/[^:\s\/]+:)(?:(?!\s)[\s\S])*?(@[^@\s\/]+(?::\d+)?(?:\/|\s|$))/g, "$1***$2");
}

/**
 * Maps any thrown error to a safe JSON response. Never leaks stack traces to the
 * client; logs unknown errors server-side with a short trace id for debugging.
 */
export function handleError(err: unknown, context = "api") {
  if (err instanceof ZodError) {
    return fail(err.issues[0]?.message ?? "Invalid input", 400);
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Always log the Prisma error code so the cause is visible in Vercel logs.
    const detail = err.message.split("\n").pop()?.trim() ?? "";
    console.error(`[${context}] Prisma ${err.code}: ${sanitizeDbError(detail)}`);
    if (err.code === "P2002") return fail("That record already exists.", 409);
    if (err.code === "P2025") return fail("Not found.", 404);
    // Schema drift - a table/column the code expects is missing in the DB.
    if (err.code === "P2021")
      return fail("Database not migrated: a required table is missing. Run the latest migration.", 503);
    if (err.code === "P2022")
      return fail("Database not migrated: a required column is missing. Run the latest migration.", 503);
    // Connection pool exhausted. This had NO branch, so it fell through to the
    // generic 500 with a random trace id - which is why intermittent "profile
    // breaks sometimes / DM sometimes does not open / chat sometimes empty"
    // could never be pinned to a cause. It is the signature failure of a
    // serverless app against a pooler: a request could not get a connection
    // within pool_timeout, while everything else on the page worked.
    if (err.code === "P2024") {
      console.error(
        `[${context}] POOL EXHAUSTED (P2024): no database connection available within the timeout. ` +
          `Raise connection_limit (see src/lib/db-url.ts) or reduce concurrent queries. ` +
          `If this appears in bursts, it is the cause of intermittent failures across unrelated features.`
      );
      return fail("The service is busy. Please try again in a moment.", 503);
    }
  }
  // DB unreachable / bad connection string (e.g. missing ?pgbouncer=true).
  if (err instanceof Prisma.PrismaClientInitializationError) {
    console.error(`[${context}] Prisma init/connection error:`, sanitizeDbError(err.message));
    return fail("Database connection error. Please try again shortly.", 503);
  }
  if (err instanceof SyntaxError) {
    return fail("Invalid JSON body.", 400);
  }
  const traceId = Math.random().toString(36).slice(2, 8);
  const rawDetail = err instanceof Error ? (err.stack || err.message) : String(err);
  console.error(`[${context}:${traceId}]`, sanitizeDbError(rawDetail));
  // Report unexpected 500s to Sentry (no-op until a DSN is configured).
  Sentry.captureException(err, { tags: { context, traceId } });
  return fail("Something went wrong. Please try again.", 500, { traceId });
}

/** Loose CUID validation for path params before hitting the DB. */
export function isCuid(value: unknown): value is string {
  return typeof value === "string" && /^c[a-z0-9]{20,}$/i.test(value);
}

/** Returns the session if the caller is an authenticated ADMIN, else null. */
export async function getAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") return null;
  return session;
}

/** The authenticated principal (any role) with access metadata, else null. */
export type SessionUser = {
  id: string;
  role: string;
  membership: string;
  email: string;
  permissions: string[];
  isSuperAdmin: boolean;
};

/** Returns the authenticated user (any role) with access metadata, else null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const u = session?.user as any;
  if (!u?.id) return null;
  return {
    id: u.id as string,
    role: u.role as string,
    membership: (u.membership as string) ?? "Free",
    email: u.email as string,
    permissions: Array.isArray(u.permissions) ? (u.permissions as string[]) : [],
    // `role === "ADMIN"` is the legacy Super Admin marker (kept for back-compat).
    isSuperAdmin: Boolean(u.isSuperAdmin) || u.role === "ADMIN",
  };
}

/**
 * Returns the session-user if it holds `perm`, else null. Use at the top of any
 * staff-gated route: `const me = await requirePermission("post:publish"); if
 * (!me) return fail("Forbidden", 403);`. Super Admins pass every check.
 */
export async function requirePermission(perm: Permission): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user) return null;
  return hasPermission(user, perm) ? user : null;
}
