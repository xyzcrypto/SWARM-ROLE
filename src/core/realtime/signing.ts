import "server-only";
import { createECDH, createPrivateKey, hkdfSync, sign, type KeyObject } from "node:crypto";
import { env } from "@/lib/env";
import { signingInput, type PublicJwk } from "@shared/utils/realtime-verify";

/**
 * Signing realtime events (security audit F-02). See `shared/utils/realtime-verify.ts`
 * for why: public Supabase channels accept broadcasts from anyone with the
 * anon key, so the browser must be able to tell our server's events apart.
 *
 * The P-256 key pair is DERIVED from NEXTAUTH_SECRET (HKDF, its own label), so
 * there is no new secret to configure in Vercel and every serverless instance
 * agrees on the key. Rotating NEXTAUTH_SECRET rotates this key too; pages pick
 * up the new public key on their next render.
 */

const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

type Keys = { priv: KeyObject; pub: PublicJwk };
let cached: Keys | null | undefined;

function keys(): Keys | null {
  if (cached !== undefined) return cached;
  const secret = env.NEXTAUTH_SECRET;
  if (!secret) return (cached = null);
  try {
    // A P-256 private scalar is any 32-byte value in [1, n). HKDF output is
    // uniform, so a value outside that range is astronomically unlikely; the
    // counter just makes the derivation total.
    for (let i = 0; i < 8; i++) {
      const d = Buffer.from(hkdfSync("sha256", secret, "xyz-realtime-signing", `p256-${i}`, 32));
      try {
        const ecdh = createECDH("prime256v1");
        ecdh.setPrivateKey(d);
        const pt = ecdh.getPublicKey(); // 0x04 || X || Y
        const x = b64url(pt.subarray(1, 33));
        const y = b64url(pt.subarray(33, 65));
        const priv = createPrivateKey({ key: { kty: "EC", crv: "P-256", d: b64url(d), x, y }, format: "jwk" });
        return (cached = { priv, pub: { kty: "EC", crv: "P-256", x, y } });
      } catch {
        /* out of range: next counter */
      }
    }
  } catch {
    /* no key: events go out unsigned and clients refetch instead of trusting them */
  }
  return (cached = null);
}

/** The public half, for the browser. Null when no NEXTAUTH_SECRET is configured. */
export function realtimePublicJwk(): PublicJwk | null {
  return keys()?.pub ?? null;
}

/**
 * Normalise the payload exactly as it will travel (JSON), sign it, and return
 * it with `_ts` and `_sig` attached. Without a key the payload goes out as is.
 */
export function signRealtimePayload(topic: string, event: string, payload: unknown, now = Date.now()): Record<string, unknown> {
  const body = JSON.parse(JSON.stringify(payload ?? {})) as Record<string, unknown>;
  const k = keys();
  if (!k) return body;
  const sig = sign("sha256", Buffer.from(signingInput(topic, event, now, body)), { key: k.priv, dsaEncoding: "ieee-p1363" });
  return { ...body, _ts: now, _sig: b64url(sig) };
}
