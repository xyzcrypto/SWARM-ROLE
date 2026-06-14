import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/** JSON success response. */
export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/** JSON error response with a safe shape. */
export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
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
    const detail = err.message.split("\n").pop()?.trim();
    console.error(`[${context}] Prisma ${err.code}: ${detail}`);
    if (err.code === "P2002") return fail("That record already exists.", 409);
    if (err.code === "P2025") return fail("Not found.", 404);
    // Schema drift - a table/column the code expects is missing in the DB.
    if (err.code === "P2021")
      return fail("Database not migrated: a required table is missing. Run the latest migration.", 503);
    if (err.code === "P2022")
      return fail("Database not migrated: a required column is missing. Run the latest migration.", 503);
  }
  // DB unreachable / bad connection string (e.g. missing ?pgbouncer=true).
  if (err instanceof Prisma.PrismaClientInitializationError) {
    console.error(`[${context}] Prisma init/connection error:`, err.message);
    return fail("Database connection error. Please try again shortly.", 503);
  }
  if (err instanceof SyntaxError) {
    return fail("Invalid JSON body.", 400);
  }
  const traceId = Math.random().toString(36).slice(2, 8);
  console.error(`[${context}:${traceId}]`, err);
  // Report unexpected 500s to Sentry (no-op until a DSN is configured).
  Sentry.captureException(err, { tags: { context, traceId } });
  return fail("Something went wrong. Please try again.", 500);
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

/** Returns the authenticated user (any role) with id/role/membership, else null. */
export async function getSessionUser() {
  const session = await getServerSession(authOptions);
  const u = session?.user as any;
  if (!u?.id) return null;
  return { id: u.id as string, role: u.role as string, membership: (u.membership as string) ?? "Free", email: u.email as string };
}
