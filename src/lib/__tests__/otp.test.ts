import { describe, it, expect, vi, beforeEach } from "vitest";

const DB = {
  codes: [] as Array<{ id: string; email: string; purpose: string; expiresAt: Date }>,
  deleteManyCalls: [] as any[],
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: async (ops: any[]) => {
      const results = [];
      for (const op of ops) {
        results.push(await op);
      }
      return results;
    },
    verificationCode: {
      deleteMany: async ({ where }: any) => {
        DB.deleteManyCalls.push(where);
        let count = 0;
        if (where?.expiresAt?.lt) {
          const before = DB.codes.length;
          DB.codes = DB.codes.filter((c) => !(c.expiresAt < where.expiresAt.lt));
          count = before - DB.codes.length;
        } else if (where?.email && where?.purpose) {
          const before = DB.codes.length;
          DB.codes = DB.codes.filter((c) => !(c.email === where.email && c.purpose === where.purpose));
          count = before - DB.codes.length;
        }
        return { count };
      },
      create: async ({ data }: any) => {
        const row = { id: `vc_${Date.now()}_${Math.random()}`, ...data };
        DB.codes.push(row);
        return row;
      },
    },
  },
}));

import { generateCode, issueCode, purgeExpiredVerificationCodes } from "@/lib/otp";

beforeEach(() => {
  DB.codes = [];
  DB.deleteManyCalls = [];
});

describe("generateCode", () => {
  it("is always a 6-digit string", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it("zero-pads small numbers to 6 digits", () => {
    const codes = Array.from({ length: 200 }, () => generateCode());
    expect(codes.every((c) => c.length === 6)).toBe(true);
  });

  it("produces varied codes (not constant)", () => {
    const set = new Set(Array.from({ length: 50 }, () => generateCode()));
    expect(set.size).toBeGreaterThan(1);
  });
});

describe("issueCode scoped to user", () => {
  it("only deletes previous codes for that email and purpose, without global scan", async () => {
    // Add existing code for user A and user B
    DB.codes.push({
      id: "1",
      email: "userA@example.com",
      purpose: "login",
      expiresAt: new Date(Date.now() + 60000),
    });
    DB.codes.push({
      id: "2",
      email: "userB@example.com",
      purpose: "login",
      expiresAt: new Date(Date.now() - 60000), // expired
    });

    const code = await issueCode("userA@example.com", "login");
    expect(code).toMatch(/^\d{6}$/);

    // Verify delete query was scoped only to { email, purpose }
    expect(DB.deleteManyCalls.length).toBe(1);
    expect(DB.deleteManyCalls[0]).toEqual({
      email: "userA@example.com",
      purpose: "login",
    });
    // Unrelated userB code (even though expired) is not touched on this hot path
    expect(DB.codes.some((c) => c.email === "userB@example.com")).toBe(true);
  });
});

describe("purgeExpiredVerificationCodes", () => {
  it("deletes only expired codes and keeps active ones", async () => {
    DB.codes.push({
      id: "1",
      email: "active@example.com",
      purpose: "login",
      expiresAt: new Date(Date.now() + 60000),
    });
    DB.codes.push({
      id: "2",
      email: "expired@example.com",
      purpose: "login",
      expiresAt: new Date(Date.now() - 60000),
    });

    const purged = await purgeExpiredVerificationCodes();
    expect(purged).toBe(1);
    expect(DB.codes.length).toBe(1);
    expect(DB.codes[0].email).toBe("active@example.com");
  });
});


describe("there is exactly one OTP implementation", () => {
  // `src/modules/auth/lib/otp.ts` sat beside the live `src/core/email/otp.ts`
  // as an unreferenced copy, and the two had DIVERGED: the live one had the
  // atomic attempt-claiming fix (so N parallel guesses cannot all read the same
  // stale `attempts` count) and the dead one did not.
  //
  // It was not harmless. A security PR's OTP transaction fix was written
  // against the dead copy and therefore did nothing at all - the bug it was
  // meant to fix was still live after the change shipped. Nobody could see
  // that from the diff, because the diff looked correct.
  //
  // `src/lib/otp.ts` is the import everyone uses and re-exports @core/email/otp.
  const { existsSync, readFileSync } = require("node:fs") as typeof import("node:fs");

  it("the dead duplicate has not come back", () => {
    expect(existsSync("src/modules/auth/lib/otp.ts"), "a second OTP implementation exists again").toBe(false);
  });

  it("the shim still points at the live one", () => {
    expect(readFileSync("src/lib/otp.ts", "utf8")).toMatch(/export \* from "@core\/email\/otp"/);
  });

  it("the live one still claims an attempt before comparing", () => {
    // The fix that was missing from the dead copy. If this ever moves, the two
    // files diverging again is how it would happen.
    const src = readFileSync("src/core/email/otp.ts", "utf8");
    expect(src).toMatch(/attempts: \{ increment: 1 \}/);
  });
});
