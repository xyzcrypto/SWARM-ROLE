import { describe, it, expect } from "vitest";
import { isMissingSchema, schemaOrThrow, schemaOrThrowList } from "@/lib/db-error";

const prismaErr = (code: string) => Object.assign(new Error("prisma"), { code });

describe("isMissingSchema", () => {
  it("recognises the two codes that mean the schema has not caught up", () => {
    expect(isMissingSchema(prismaErr("P2021"))).toBe(true); // table missing
    expect(isMissingSchema(prismaErr("P2022"))).toBe(true); // column missing
  });

  it("does NOT treat a connection failure as a missing schema", () => {
    // P1001 is "can't reach database server" - the production failure that
    // rendered as "Page not found" on a profile that exists.
    expect(isMissingSchema(prismaErr("P1001"))).toBe(false);
    expect(isMissingSchema(prismaErr("P1017"))).toBe(false); // server closed the connection
    expect(isMissingSchema(new Error("socket hang up"))).toBe(false);
    expect(isMissingSchema(null)).toBe(false);
    expect(isMissingSchema(undefined)).toBe(false);
  });
});

describe("schemaOrThrow", () => {
  it("degrades to null for an un-applied schema, keeping the graceful path", () => {
    expect(schemaOrThrow(prismaErr("P2021"))).toBeNull();
    expect(schemaOrThrow(prismaErr("P2022"))).toBeNull();
  });

  it("rethrows an outage so it can never be rendered - or cached - as an answer", () => {
    // The whole point: `.catch(() => null)` here produced notFound() on an
    // ISR-cached page, pinning a 404 on a real profile for the cache window.
    expect(() => schemaOrThrow(prismaErr("P1001"))).toThrow();
    expect(() => schemaOrThrow(new Error("ECONNREFUSED"))).toThrow();
  });

  it("preserves the original error, so logs still name the cause", () => {
    const err = prismaErr("P1001");
    expect(() => schemaOrThrow(err)).toThrow(err);
  });
});

describe("schemaOrThrowList", () => {
  it("degrades to an empty list only for an un-applied schema", () => {
    expect(schemaOrThrowList(prismaErr("P2021"))).toEqual([]);
    expect(() => schemaOrThrowList(prismaErr("P1001"))).toThrow();
  });
});
