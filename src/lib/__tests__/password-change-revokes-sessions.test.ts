import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Changing a password must invalidate sessions that were issued before it.
//
// Before this existed, `api/auth/password/reset` rotated `passwordHash` and
// cleared the lockout, and touched nothing that would kill an already-issued
// JWT. `session: { strategy: "jwt" }` sets no `maxAge`, so next-auth's default
// 30 days applied: someone else holding your session kept full access for up to
// a month after you reset your password - which is the one action a user takes
// specifically to lock that person out.
//
// The mechanism: `User.passwordChangedAt` is written by both password-write
// paths; the jwt callback compares it against a `pwdAt` timestamp it persists in
// the token itself, and returns an empty token when the token is older.
//
// ⚠️ THE TRAP THIS TEST EXISTS TO PREVENT
// `token.iat` is the obvious thing to compare against, and it does not work.
// next-auth re-encodes the token on EVERY session read, and `encode()` calls
// `.setIssuedAt()` with no argument (next-auth/jwt/index.js:44), so `iat` is
// refreshed to "now" constantly. A check against `iat` compiles, reads
// correctly, passes review, and silently never fires. Hence the assertion below
// that the comparison uses `pwdAt` and not `iat`.

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const AUTH = "src/core/auth/auth.ts";
const RESET = "src/app/api/auth/password/reset/route.ts";
const CHANGE = "src/app/api/profile/password/route.ts";
const SCHEMA = "prisma/schema.prisma";

describe("password change revokes existing sessions", () => {
  it("has the column that makes it possible", () => {
    expect(read(SCHEMA)).toMatch(/passwordChangedAt\s+DateTime\?/);
  });

  it("writes passwordChangedAt on BOTH password-write paths", () => {
    // Forgetting either one leaves a silent hole: the forgot-password flow is
    // the one an attacker's victim uses, the signed-in flow is the one a user
    // uses after noticing something is wrong. Both have to revoke.
    const missing: string[] = [];
    for (const [label, file] of [["forgot-password reset", RESET], ["signed-in change", CHANGE]] as const) {
      if (!/passwordChangedAt:\s*new Date\(\)/.test(read(file))) missing.push(`${label} (${file})`);
    }
    expect(missing, `path(s) that change a password without revoking sessions: ${missing.join(", ")}`).toEqual([]);
  });

  it("selects passwordChangedAt in the primary lookup but NOT the P2022 fallback", () => {
    // Both halves of this matter, and the second is counter-intuitive.
    //
    // The jwt callback has two lookups. The first names the newest columns; the
    // second is the fallback that runs when the first throws P2022 because the DB
    // has not picked up a migration yet. Its entire job is to be the select that
    // still works without the newest column.
    //
    // So putting `passwordChangedAt` in BOTH is a bug, not extra safety: on a
    // not-yet-migrated DB both selects would throw and the refresh would stop
    // entirely - taking role/membership/permissions freshness down with it. The
    // first draft of this change did exactly that. Missing column reads as
    // undefined -> 0, so revocation is merely inert until the migration lands,
    // which is the correct degradation.
    //
    // Scoped by `username: true`, which distinguishes the jwt-callback selects
    // from the `authorize()` login lookup - that third select reads passwordHash
    // to verify a login and has no business carrying this column.
    const selects = [...read(AUTH).matchAll(/select:\s*\{[^}]*\busername:\s*true[^}]*\}/g)].map((m) => m[0]);
    expect(selects.length, "expected exactly the two jwt-callback selects").toBe(2);

    const [primary, fallback] = selects;
    expect(primary, "primary lookup must read passwordChangedAt").toContain("passwordChangedAt");
    expect(primary, "primary lookup is the one that also reads permissions").toContain("permissions");
    expect(
      fallback,
      "the P2022 fallback must NOT name passwordChangedAt - it is the pre-migration path"
    ).not.toContain("passwordChangedAt");
  });

  it("compares against the token-persisted pwdAt, NOT token.iat", () => {
    // See the trap note at the top of this file. This is the assertion that stops
    // the mechanism being "simplified" into something permanently inert.
    //
    // The first version of this test did not work. It asserted `/pwdAt/` appears
    // somewhere and that `iat` and `passwordChangedAt` never share a line - and a
    // perturbation swapping the comparison to `token.iat` PASSED, because `pwdAt`
    // still appeared in the surrounding comment and assignment. A test that
    // passes either way is worth nothing, so it now pins the derivation itself.
    const src = read(AUTH);

    // The value compared against the DB must be read out of the token's own
    // `pwdAt` claim.
    expect(
      src,
      "the compared timestamp must be derived from token.pwdAt"
    ).toMatch(/const\s+rawPwdAt\s*=\s*\(token as any\)\.pwdAt/);
    expect(
      src,
      "the compared timestamp must be derived from token.pwdAt"
    ).toMatch(/const\s+tokenPwdAt\s*=\s*typeof\s+rawPwdAt\s*===\s*"number"\s*\?\s*rawPwdAt\s*:\s*null/);

    // 🔴 An ABSENT pwdAt must never be coerced to 0.
    //
    // This assertion is here because the version it replaced - `: 0` instead of
    // `: null` - locked members out of their own accounts. `pwdAt` is stamped ON
    // the token, so a token minted milliseconds ago by a successful password
    // check has none yet; reading that as "minted at the epoch" made the newest
    // possible token look stale and the callback discarded it. Anyone who had
    // ever reset or changed their password could no longer log in, on any device,
    // with the correct password and no error shown. Behavioural coverage is in
    // login-revocation.test.ts; this pins the derivation that caused it.
    expect(
      src,
      "an unknown mint time is not evidence of staleness - it must not default to 0"
    ).not.toMatch(/typeof\s*\(token as any\)\.pwdAt\s*===\s*"number"\s*\?\s*\(token as any\)\.pwdAt\s*:\s*0/);
    expect(
      src,
      "revocation must be skipped, not applied, when the token carries no pwdAt"
    ).toMatch(/if\s*\(tokenPwdAt\s*!==\s*null\s*&&\s*dbPwdAt\s*>\s*tokenPwdAt\)/);

    // ...and `iat` must not be load-bearing in the CODE. Comments are stripped
    // first on purpose: the source deliberately mentions `token.iat` to explain
    // why it is not used, and an assertion that trips on its own warning would
    // just get deleted by the next person.
    const code = src
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");
    expect(code, "token.iat is refreshed on every re-encode - it cannot gate anything").not.toMatch(/token\.iat/);
  });

  it("fails closed: the session callback rejects a revoked token", async () => {
    // Behavioural, not textual - the session callback is pure, so it can be
    // called directly. A revoked token arrives as `{}`; the callback must not
    // hand back a session carrying an undefined user id, because callers that
    // test `session?.user` truthiness would read that as signed-in.
    const { authOptions } = await import("@/core/auth/auth");
    const sessionCb = authOptions.callbacks?.session;
    expect(sessionCb, "auth options expose no session callback").toBeDefined();

    const base = { user: { name: "x", email: "x@y.z", image: null }, expires: "2099-01-01T00:00:00.000Z" };

    const revoked: any = await sessionCb!({ session: { ...base } as any, token: {} as any } as any);
    expect(revoked?.user, "a revoked token still produced a session with a user").toBeUndefined();

    const ok: any = await sessionCb!({
      session: { ...base } as any,
      token: { uid: "u1", role: "USER", membership: "Free" } as any,
    } as any);
    expect(ok?.user?.id, "a valid token failed to produce a usable session").toBe("u1");
  }, 15000);
});
