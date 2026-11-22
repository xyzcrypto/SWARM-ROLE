/**
 * Verifying signed realtime events in the browser (security audit F-02).
 *
 * The community channel is a public Supabase Realtime topic, joined with the
 * anon key that every browser ships. Public channels accept broadcasts from
 * ANY client holding that key, and the chat used to render whatever arrived:
 * anyone could post a message "from" the admin with a phishing link to every
 * member online, rewrite real messages, or make them vanish.
 *
 * The server now signs every chat event with an ECDSA P-256 key
 * (`core/realtime/signing.ts`); browsers verify with the public half before
 * showing anything. Forged events fail verification and are dropped. No extra
 * requests: verifying costs a fraction of a millisecond in WebCrypto.
 *
 * Pure parts (canonical JSON, envelope handling) are shared with the server so
 * both sides sign and check byte-identical strings.
 */

/** JSON with object keys sorted, so the same value always serialises the same way. Pure. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map((x) => (x === undefined || typeof x === "function" ? "null" : stableStringify(x))).join(",")}]`;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o)
    .filter((k) => o[k] !== undefined && typeof o[k] !== "function")
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
}

/** The exact string that is signed for one event. Pure. */
export function signingInput(topic: string, event: string, ts: number, payload: unknown): string {
  return stableStringify({ e: event, p: payload, t: topic, ts });
}

export type SignedFields = { _ts?: number; _sig?: string };
export type PublicJwk = { kty: "EC"; crv: "P-256"; x: string; y: string };

/** Split a received payload into the event body and its signature fields. Pure. */
export function splitSigned(payload: unknown): { body: Record<string, unknown>; ts: number | null; sig: string | null } {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown> & SignedFields;
  const { _ts, _sig, ...body } = p;
  return { body, ts: typeof _ts === "number" ? _ts : null, sig: typeof _sig === "string" ? _sig : null };
}

/** A signed event older (or newer) than this is refused, so old genuine events cannot be replayed later. */
export const MAX_EVENT_AGE_MS = 10 * 60_000;

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let keyCache: { jwk: string; key: Promise<CryptoKey | null> } | null = null;
function importKey(jwk: PublicJwk): Promise<CryptoKey | null> {
  const id = `${jwk.x}.${jwk.y}`;
  if (keyCache?.jwk === id) return keyCache.key;
  const key = (async () => {
    try {
      return await crypto.subtle.importKey("jwk", { ...jwk, ext: true }, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    } catch {
      return null;
    }
  })();
  keyCache = { jwk: id, key };
  return key;
}

/**
 * The event body if the signature is valid and fresh, else null. Never throws.
 * Callers must treat null as "this did not come from our server".
 */
export async function verifyEvent(jwk: PublicJwk | null | undefined, topic: string, event: string, payload: unknown, now = Date.now()): Promise<Record<string, unknown> | null> {
  if (!jwk || typeof crypto === "undefined" || !crypto.subtle) return null;
  const { body, ts, sig } = splitSigned(payload);
  if (ts == null || !sig || Math.abs(now - ts) > MAX_EVENT_AGE_MS) return null;
  try {
    const key = await importKey(jwk);
    if (!key) return null;
    const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, b64urlToBytes(sig), new TextEncoder().encode(signingInput(topic, event, ts, body)));
    return ok ? body : null;
  } catch {
    return null;
  }
}
