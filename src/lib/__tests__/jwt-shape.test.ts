import { describe, it, expect } from "vitest";
import { describeKey } from "@/lib/jwt-shape";

// A well-formed, non-expired service_role-looking JWT (signature is nonsense -
// nothing here verifies it, only its shape and claims).
function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.signature`;
}
const FUTURE = Math.floor(Date.now() / 1000) + 86_400;
const SERVICE = jwt({ iss: "supabase", ref: "abc", role: "service_role", exp: FUTURE });
const ANON = jwt({ iss: "supabase", ref: "abc", role: "anon", exp: FUTURE });

describe("describeKey", () => {
  it("never returns the key itself", () => {
    const out = JSON.stringify(describeKey(SERVICE, "service_role"));
    expect(out).not.toContain("signature");
    expect(out).not.toContain(SERVICE.slice(0, 20));
  });

  it("passes a well-formed service_role key with no verdict", () => {
    const s = describeKey(SERVICE, "service_role");
    expect(s.looksLikeJwt).toBe(true);
    expect(s.role).toBe("service_role");
    expect(s.expired).toBe(false);
    expect(s.verdict).toBeNull();
  });

  it("names the anon key when service_role was expected", () => {
    expect(describeKey(ANON, "service_role").verdict).toMatch(/"anon" key, not "service_role"/);
  });

  it("catches the failure that was actually live: not a JWT at all", () => {
    // Supabase reports this as `Invalid Compact JWS`, and the old diagnosis
    // blamed a missing bucket for it.
    const s = describeKey("not-a-jwt", "service_role");
    expect(s.looksLikeJwt).toBe(false);
    expect(s.verdict).toMatch(/Invalid Compact JWS/);
  });

  it("catches a truncated JWT", () => {
    expect(describeKey(SERVICE.split(".").slice(0, 2).join("."), "service_role").verdict).toMatch(/got 2 part/);
  });

  it("catches the new sb_secret_ key format", () => {
    expect(describeKey("sb_secret_abc123", "service_role").verdict).toMatch(/NEW API keys/);
  });

  it("catches a trailing newline, the classic copy-paste failure", () => {
    const s = describeKey(`${SERVICE}\n`, "service_role");
    expect(s.hasSurroundingWhitespace).toBe(true);
    expect(s.verdict).toMatch(/whitespace or a newline/);
  });

  it("catches quotes pasted around the value", () => {
    expect(describeKey(`"${SERVICE}"`, "service_role").verdict).toMatch(/wrapped in quotes/);
  });

  it("catches an expired key", () => {
    const past = jwt({ role: "service_role", exp: Math.floor(Date.now() / 1000) - 10 });
    expect(describeKey(past, "service_role").verdict).toMatch(/EXPIRED/);
  });

  it("reports an unset key plainly", () => {
    expect(describeKey(undefined).verdict).toBe("Not set.");
    expect(describeKey("").verdict).toBe("Not set.");
  });
});
