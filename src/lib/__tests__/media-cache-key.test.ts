import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { publicImageUrl, mediaToken } from "@shared/utils/utils";

// `api/media/[kind]/[id]/[v]` serves profile images stored in the database as
// inline `data:` URLs. It is anonymous by design - these are public profile
// pictures - and that is fine. What was not fine is that it ACCEPTED the `v`
// segment and never checked it.
//
// Every forged value was therefore a distinct URL, and a distinct URL is a
// guaranteed CDN miss: a function invocation and a DB read per request, from
// anyone, with no upper bound. Measured against production before the fix:
//
//   GET /api/media/avatar/<real id>/forged<random>
//   → 200 · redirected:false · x-vercel-cache: MISS · 23,776 bytes
//
// Both halves of that matter. MISS is the finding - the edge cannot absorb a
// key it has never seen. The byte count is the correction: the audit sized this
// on the 5 MB upload cap and it is really ~24 KB, so exhausting the 10 GB Fast
// Origin Transfer budget is ~450k requests, not ~2k. A deliberate script, not an
// accident - worth closing, not an emergency.

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const ROUTE = "src/app/api/media/[kind]/[id]/[v]/route.ts";

const dataUrl = (body: string) => `data:image/png;base64,${body}`;

describe("mediaToken is the single source of the version segment", () => {
  // The route recomputes the expected token to reject one it did not issue. If
  // it grew its own copy of the arithmetic instead of importing this, the two
  // would drift - and the drift would surface as every avatar 404ing at once,
  // because a link built by one formula would be judged by the other.
  it("is what publicImageUrl actually puts in the URL", () => {
    const v = dataUrl("A".repeat(400));
    const url = publicImageUrl(v, "cmq9kzbdw0005bwb7taega6av")!;
    expect(url.endsWith(`/${mediaToken(v)}`)).toBe(true);
  });

  it("changes when the image changes - including only near the start", () => {
    // The first version of the token sampled length + tail only, so an edit near
    // the beginning left it identical and pinned a stale avatar behind a 30-day
    // cache window. Kept as a regression pin.
    const base = dataUrl("A".repeat(400));
    const headEdit = dataUrl("B".repeat(10) + "A".repeat(390));
    expect(mediaToken(headEdit)).not.toBe(mediaToken(base));
  });

  it("is stable for the same value", () => {
    const v = dataUrl("A".repeat(400));
    expect(mediaToken(v)).toBe(mediaToken(v));
  });

  it("contains no URL-hostile characters", () => {
    // It is a path SEGMENT. A '/' or '?' here would silently change the route
    // shape rather than fail loudly.
    expect(mediaToken(dataUrl("a/b+c=d?e" .repeat(50)))).toMatch(/^[a-zA-Z0-9]+$/);
  });
});

describe("the media route validates before it spends", () => {
  const src = read(ROUTE);

  // Guard against a vacuous sweep: if the path ever goes stale, every assertion
  // below becomes "this string is not in an empty file" and passes for free.
  it("is reading the real route file", () => {
    expect(src.length, `${ROUTE} is empty or unreadable`).toBeGreaterThan(1000);
    expect(src).toMatch(/export async function GET/);
  });

  it("rejects a non-cuid id before any database call", () => {
    const idCheck = src.indexOf("isCuid(id)");
    const dbCall = src.indexOf("prisma.user");
    expect(idCheck, "route does not validate the id at all").toBeGreaterThan(-1);
    expect(idCheck, "isCuid must come before the query, or it saves nothing").toBeLessThan(dbCall);
  });

  it("rate-limits before any database call", () => {
    const rl = src.indexOf("rateLimit(");
    const dbCall = src.indexOf("prisma.user");
    expect(rl, "route has no rate limiter").toBeGreaterThan(-1);
    expect(rl).toBeLessThan(dbCall);
    expect(src, "the limiter must be IP-keyed - the route is anonymous").toMatch(/rateLimit\(\s*"media"\s*,\s*clientIp\(/);
  });

  it("compares v against the shared mediaToken, not a local copy", () => {
    expect(src, "route must import the shared derivation").toMatch(/import\s*\{[^}]*\bmediaToken\b[^}]*\}/);
    expect(src, "route must actually compare the segment").toMatch(/v\s*!==\s*mediaToken\(/);
    // A second implementation of the sampling arithmetic in the route is the
    // drift this is guarding against.
    expect(src, "route appears to re-derive the token itself").not.toMatch(/toString\(36\)/);
  });

  it("does NOT enforce the token on the redirect branch", () => {
    // A non-`data:` value has no token to derive, so any request reaching that
    // branch carries one computed from the old data: value. Enforcing it there
    // would 404 exactly the stale links the branch exists to rescue - and it is
    // the cheap path anyway: a redirect, no body.
    const redirect = src.indexOf("status: 307");
    const tokenCheck = src.indexOf("mediaToken(value)");
    expect(redirect).toBeGreaterThan(-1);
    expect(tokenCheck, "token check must come after the 307 branch").toBeGreaterThan(redirect);
  });
});
