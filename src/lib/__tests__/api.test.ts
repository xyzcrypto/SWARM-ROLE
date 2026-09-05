import { describe, it, expect } from "vitest";
import { z } from "zod";
import { isCuid, handleError, fail, ok, sanitizeDbError } from "@/lib/api";

describe("isCuid", () => {
  it("accepts cuid-like ids", () => {
    expect(isCuid("ckv8b1f2a0000abcd1234efgh")).toBe(true);
  });
  it("rejects junk", () => {
    expect(isCuid("123")).toBe(false);
    expect(isCuid("")).toBe(false);
    expect(isCuid(undefined)).toBe(false);
  });
});

describe("handleError", () => {
  it("maps ZodError to 400", () => {
    let res;
    try {
      z.object({ a: z.string() }).parse({});
    } catch (e) {
      res = handleError(e, "test");
    }
    expect(res?.status).toBe(400);
  });
  it("maps unknown errors to 500 with correlation traceId", async () => {
    const res = handleError(new Error("boom"), "test");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Something went wrong. Please try again.");
    expect(body.traceId).toBeDefined();
    expect(typeof body.traceId).toBe("string");
  });
});

describe("ok/fail", () => {
  it("ok defaults to 200", () => {
    expect(ok({ a: 1 }).status).toBe(200);
  });
  it("fail defaults to 400", () => {
    expect(fail("nope").status).toBe(400);
  });
});

describe("sanitizeDbError", () => {
  it("redacts credentials from connection URLs in error messages", () => {
    const raw = "Error connecting to postgresql://postgres:SuperSecretPass123@aws-0.pooler.supabase.com:6543/postgres?pgbouncer=true";
    const sanitized = sanitizeDbError(raw);
    expect(sanitized).not.toContain("SuperSecretPass123");
    expect(sanitized).toContain("postgresql://postgres:***@aws-0.pooler.supabase.com:6543/postgres?pgbouncer=true");
  });
  it("leaves error strings without credentials unchanged", () => {
    const raw = "Record not found in database table";
    expect(sanitizeDbError(raw)).toBe(raw);
  });
});

