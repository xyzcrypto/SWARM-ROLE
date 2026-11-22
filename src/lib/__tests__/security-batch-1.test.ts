import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { generateKeyPairSync, sign } from "node:crypto";

vi.mock("@/lib/env", () => ({ env: { NEXTAUTH_SECRET: "test-secret-that-is-long-enough-123" } }));

import { realtimePublicJwk, signRealtimePayload } from "@core/realtime/signing";
import { stableStringify, verifyEvent, MAX_EVENT_AGE_MS, signingInput, type PublicJwk } from "@shared/utils/realtime-verify";
import { expandV6, isPublicAddress, isFetchableUrl } from "@core/net/safe-fetch";
import { isPushServiceEndpoint } from "@core/push/endpoints";

const read = (p: string) => readFileSync(p, "utf8");

describe("F-02: chat broadcasts are signed and verified", () => {
  const msg = { id: "c123", userId: "u1", body: "gm", author: { name: "Raza", role: "USER" }, createdAt: new Date("2026-11-22T10:00:00Z"), reactions: [] };

  it("a genuine server event verifies, with the body intact", async () => {
    const jwk = realtimePublicJwk();
    expect(jwk?.crv).toBe("P-256");
    const wire = JSON.parse(JSON.stringify(signRealtimePayload("community", "new_message", msg)));
    const body = await verifyEvent(jwk, "community", "new_message", wire);
    expect(body?.body).toBe("gm");
    expect(body?.createdAt).toBe("2026-11-22T10:00:00.000Z");
    expect(body && "_sig" in body).toBe(false);
  });

  it("a forged or tampered event is rejected", async () => {
    const jwk = realtimePublicJwk();
    const wire = signRealtimePayload("community", "new_message", msg) as Record<string, unknown>;
    // 1. attacker edits the text of a genuine event
    expect(await verifyEvent(jwk, "community", "new_message", { ...wire, body: "Airdrop live: connect wallet at https://evil.example" })).toBeNull();
    // 2. attacker replays a genuine event under another event name
    expect(await verifyEvent(jwk, "community", "message_edited", wire)).toBeNull();
    // 3. attacker sends an unsigned "admin" message
    expect(await verifyEvent(jwk, "community", "new_message", { ...msg, author: { name: "XYZ Crypto", role: "ADMIN" } })).toBeNull();
    // 4. attacker signs with their own key
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const ts = Date.now();
    const sig = sign("sha256", Buffer.from(signingInput("community", "new_message", ts, msg)), { key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url");
    expect(await verifyEvent(jwk, "community", "new_message", { ...msg, _ts: ts, _sig: sig })).toBeNull();
  });

  it("an old genuine event cannot be replayed later", async () => {
    const jwk = realtimePublicJwk();
    const old = Date.now() - MAX_EVENT_AGE_MS - 1000;
    const wire = JSON.parse(JSON.stringify(signRealtimePayload("community", "message_hidden", { id: "c1" }, old)));
    expect(await verifyEvent(jwk, "community", "message_hidden", wire)).toBeNull();
  });

  it("without a key nothing is trusted", async () => {
    expect(await verifyEvent(null as PublicJwk | null, "community", "new_message", msg)).toBeNull();
  });

  it("canonical JSON is key-order independent", () => {
    expect(stableStringify({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: null } })).toBe(stableStringify({ a: { c: null, d: [1, { y: 2, z: 1 }] }, b: 1 }));
  });

  it("every chat broadcast goes through the signer, and every content handler through the verifier", () => {
    expect(read("src/modules/community/lib/chat.ts")).toMatch(/signRealtimePayload\(CHAT_CHANNEL, evt\.event, evt\.payload\)/);
    const c = read("src/modules/community/components/ChatClient.tsx");
    for (const e of ["new_message", "message_hidden", "messages_restored", "message_edited", "message_pinned", "poll_vote", "reaction"]) {
      expect(c, e).toMatch(new RegExp(`onVerified\\("${e}"`));
      expect(c, e).not.toMatch(new RegExp(`channel\\.onBroadcast\\("${e}"`));
    }
  });
});

describe("F-03: SSRF guard unwraps every IPv4-in-IPv6 form", () => {
  it.each([
    "::ffff:7f00:1", // 127.0.0.1, hex mapped (what the URL parser produces)
    "::ffff:a9fe:a9fe", // 169.254.169.254 metadata
    "::ffff:127.0.0.1",
    "::7f00:1", // IPv4-compatible
    "::ffff:0:a00:1", // SIIT 10.0.0.1
    "64:ff9b::a9fe:a9fe", // NAT64 metadata
    "64:ff9b:1::1", // NAT64 local-use
    "2002:7f00:1::", // 6to4 of 127.0.0.1
    "::1",
    "::",
    "fe80::1",
    "fd00::1",
    "ff02::1",
    "2001:db8::1",
  ])("%s is not public", (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });
  it.each(["2606:4700:4700::1111", "2a00:1450:4001:80b::200e", "::ffff:808:808", "64:ff9b::808:808"])("%s is public", (ip) => {
    expect(isPublicAddress(ip)).toBe(true);
  });
  it("URL literals are refused before any request", () => {
    expect(isFetchableUrl("http://[::ffff:127.0.0.1]/")).toBeNull();
    expect(isFetchableUrl("http://[::ffff:a9fe:a9fe]/latest/meta-data/")).toBeNull();
    expect(isFetchableUrl("https://example.com/")).not.toBeNull();
  });
  it("expands IPv6 correctly", () => {
    expect(expandV6("::ffff:127.0.0.1")).toEqual([0, 0, 0, 0, 0, 0xffff, 0x7f00, 1]);
    expect(expandV6("1::")).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
    expect(expandV6("1:::2")).toBeNull();
  });
});

describe("F-07/F-08: push subscriptions", () => {
  it("only real push services over https", () => {
    for (const u of ["https://fcm.googleapis.com/fcm/send/abc", "https://updates.push.services.mozilla.com/wpush/v2/x", "https://web.push.apple.com/abc", "https://db5p.notify.windows.com/w/?token=x"]) expect(isPushServiceEndpoint(u), u).toBe(true);
    for (const u of ["http://fcm.googleapis.com/x", "https://10.0.0.1/x", "https://evil.example/fcm.googleapis.com", "https://fcm.googleapis.com.evil.example/x", "https://fcm.googleapis.com:8443/x", "not a url"]) expect(isPushServiceEndpoint(u), u).toBe(false);
  });
  it("the subscribe route enforces host, per-user cap and no cross-account re-bind; sendPush refuses old bad rows", () => {
    const r = read("src/app/api/push/subscribe/route.ts");
    expect(r).toMatch(/refine\(isPushServiceEndpoint\)/);
    expect(r).toMatch(/MAX_PUSH_SUBS_PER_USER/);
    expect(r).toMatch(/existing\.userId !== me\.id && \(existing\.p256dh !== keys\.p256dh/);
    expect(read("src/core/push/push.ts")).toMatch(/if \(!isPushServiceEndpoint\(sub\.endpoint\)\) return "gone"/);
  });
});

describe("remaining fixes stay in place", () => {
  it("F-01: patched Next.js, exact image hosts, no SVG through the optimizer", () => {
    const pkg = JSON.parse(read("package.json"));
    const [maj, min, pat] = String(pkg.dependencies.next).replace(/^[^\d]*/, "").split(".").map(Number);
    expect(maj * 1e6 + min * 1e3 + pat).toBeGreaterThanOrEqual(16_004_005);
    const cfg = read("next.config.mjs");
    expect(cfg).not.toMatch(/hostname: "\*\*\.(supabase\.co|githubusercontent\.com|googleusercontent\.com)"/);
    expect(cfg).toMatch(/dangerouslyAllowSVG: false/);
  });
  it("F-04: private profiles stay private in the APIs", () => {
    expect(read("src/app/api/journal/share/activity/[userId]/route.ts")).toMatch(/profileVisibility === "private"/);
    expect(read("src/app/api/follow/list/route.ts")).toMatch(/profileVisibility === "private" && me\?\.id !== target\.id/);
  });
  it("F-05: object names are crypto-random", () => {
    const s = read("src/core/storage/storage.ts");
    expect(s).toMatch(/randomUUID/);
    expect(s).not.toMatch(/=\s*`\$\{Date\.now\(\)\.toString\(36\)\}-\$\{Math\.random/);
  });
  it("F-10/F-13/F-14: long-window and daily caps exist and are used", () => {
    const rl = read("src/core/ratelimit/ratelimit.ts");
    for (const b of ["otpEmailDaily", "aiDaily", "pointsStatsDaily"]) expect(rl, b).toMatch(new RegExp(`${b}: make\\(`));
    for (const f of ["src/app/api/chat/translate/route.ts", "src/app/api/media/voice/transcribe/route.ts", "src/app/api/academy/aneque/listen/route.ts"]) expect(read(f), f).toMatch(/rateLimit\("aiDaily"/);
    expect(read("src/app/api/auth/signup/start/route.ts")).toMatch(/rateLimit\("otpEmailDaily"/);
    expect(read("src/app/api/points/stats/route.ts")).toMatch(/rateLimit\("pointsStatsDaily"/);
  });
  it("F-11: deleting an account with a password requires the password", () => {
    expect(read("src/app/api/profile/route.ts")).toMatch(/bcrypt\.compare\(parsed\.data\.password, acct\.passwordHash\)/);
  });
  it("F-12: re-activating a challenge counts against the plan limit", () => {
    expect(read("src/app/api/journal/challenges/[id]/route.ts")).toMatch(/rest\.status === "active" && existing\.status !== "active"/);
  });
  it("F-15: signup hashes before the existence check", () => {
    const s = read("src/app/api/auth/signup/start/route.ts");
    expect(s.indexOf("bcrypt.hash(")).toBeLessThan(s.indexOf("prisma.user.findUnique"));
  });
  it("F-17: Google sign-in requires a verified email", () => {
    expect(read("src/core/auth/auth.ts")).toMatch(/account\?\.provider === "google" && .*email_verified !== true\) return false/);
  });
  it("F-18: cron workflows send the secret in a header, not the URL", () => {
    for (const f of [".github/workflows/watchdog.yml", ".github/workflows/push-dispatch.yml"]) {
      expect(read(f), f).not.toMatch(/\?secret=/);
      expect(read(f), f).toMatch(/Authorization: Bearer \$\{CRON_SECRET\}/);
    }
  });
});
