import { describe, expect, it } from "vitest";
import { checkCronAuth, cronAuthFailure } from "@/core/auth/cron-auth";

const SECRET = "s3cr3t-value-from-vercel";

describe("checkCronAuth accepts a correct secret", () => {
  it("via an Authorization: Bearer header", () => {
    expect(checkCronAuth(SECRET, `Bearer ${SECRET}`, null)).toEqual({ ok: true });
  });

  // Both GitHub Actions workflows call the endpoint as `?secret=…`, so dropping
  // this form would silently break the only caller that exists today.
  it("via the ?secret= query parameter the workflows use", () => {
    expect(checkCronAuth(SECRET, null, SECRET)).toEqual({ ok: true });
  });
});

describe("checkCronAuth rejects a wrong secret with nothing to learn from", () => {
  it("rejects a mismatched token", () => {
    expect(checkCronAuth(SECRET, "Bearer wrong", null)).toEqual({ ok: false, reason: "forbidden" });
    expect(checkCronAuth(SECRET, null, "wrong")).toEqual({ ok: false, reason: "forbidden" });
  });

  it("rejects a bare token sent without the Bearer scheme", () => {
    expect(checkCronAuth(SECRET, SECRET, null)).toEqual({ ok: false, reason: "forbidden" });
  });

  it("rejects a prefix of the real secret", () => {
    expect(checkCronAuth(SECRET, `Bearer ${SECRET.slice(0, -1)}`, null)).toEqual({ ok: false, reason: "forbidden" });
  });

  // A wrong token is the case that must stay opaque: it is the only one where
  // an attacker could learn something from a distinguishable answer.
  it("answers a wrong token with a bare 403", () => {
    expect(cronAuthFailure("forbidden")).toEqual({ message: "Forbidden", status: 403 });
  });
});

describe("an unset secret is reported as unconfigured, not as forbidden", () => {
  // ⚠️ THE BUG. Both routes opened with `if (!env.CRON_SECRET) return false` and
  // then answered a flat 403 either way, so "the secret is missing from this
  // deployment" and "you sent the wrong secret" were indistinguishable from
  // outside. XYZ Sentinel sat dark for two weeks with its cause recorded as
  // "not yet pinned" (HANDOFF §8) because there was nothing to check against.
  it("distinguishes an absent secret from a wrong one", () => {
    expect(checkCronAuth("", `Bearer ${SECRET}`, null)).toEqual({ ok: false, reason: "unconfigured" });
    expect(checkCronAuth(undefined, `Bearer ${SECRET}`, null)).toEqual({ ok: false, reason: "unconfigured" });
    expect(checkCronAuth(null, null, null)).toEqual({ ok: false, reason: "unconfigured" });
    // ...and the reason differs from the wrong-token case, which is the whole point.
    expect(checkCronAuth(SECRET, "Bearer nope", null)).toEqual({ ok: false, reason: "forbidden" });
  });

  // An unset secret makes the route unreachable for everyone, so saying so gives
  // an attacker nothing - and gives the owner the answer in one request.
  it("names the variable and the redeploy, and does not use 403", () => {
    const f = cronAuthFailure("unconfigured");
    expect(f.status).toBe(503);
    expect(f.message).toMatch(/CRON_SECRET/);
    expect(f.message).toMatch(/redeploy/i);
  });

  // It must never echo the configured value, however it fails.
  it("leaks no secret material in either message", () => {
    for (const r of ["unconfigured", "forbidden"] as const) {
      expect(cronAuthFailure(r).message).not.toContain(SECRET);
    }
  });
});
