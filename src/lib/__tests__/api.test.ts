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
  it("maps unknown errors to 500", () => {
    expect(handleError(new Error("boom"), "test").status).toBe(500);
  });
  it("includes traceId in 500 responses", async () => {
    const res = handleError(new Error("boom"), "test");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.traceId).toBeDefined();
    expect(typeof body.traceId).toBe("string");
  });
});

describe("sanitizeDbError", () => {
  it("redacts credentials from connection strings", () => {
    expect(sanitizeDbError("Error connecting to postgresql://postgres:SecretPass123@db.host.com:5432/db")).toBe(
      "Error connecting to postgresql://postgres:***@db.host.com:5432/db"
    );
    expect(sanitizeDbError("postgresql://user:p%40ssw0rd@localhost:5432/mydb")).toBe(
      "postgresql://user:***@localhost:5432/mydb"
    );
    expect(sanitizeDbError("postgresql://user:raw@secret@db.host.internal:5432/db")).toBe(
      "postgresql://user:***@db.host.internal:5432/db"
    );
  });
  it("leaves error strings without credentials alone", () => {
    expect(sanitizeDbError("Connection timeout")).toBe("Connection timeout");
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
