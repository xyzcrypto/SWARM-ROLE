import { describe, it, expect } from "vitest";
import { z } from "zod";
import { isCuid, handleError, fail, ok } from "@/lib/api";

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
});

describe("ok/fail", () => {
  it("ok defaults to 200", () => {
    expect(ok({ a: 1 }).status).toBe(200);
  });
  it("fail defaults to 400", () => {
    expect(fail("nope").status).toBe(400);
  });
});
