/**
 * Describe the SHAPE of a Supabase key without ever revealing it.
 *
 * Why this exists: `/api/media/health` reported "the bucket likely doesn't
 * exist" when Supabase had actually answered `Invalid Compact JWS` - i.e. the
 * service-role key was not a well-formed JWT at all. That is diagnosable
 * locally, before any network call, and naming it directly turns a wild goose
 * chase (create a bucket that was never the problem) into a one-line fix.
 *
 * Nothing here returns key material: only its length, its structure, and the
 * `role` claim, which is what distinguishes "pasted the anon key by mistake"
 * from "pasted the right one".
 */

export type KeyShape = {
  length: number;
  segments: number;
  looksLikeJwt: boolean;
  hasSurroundingWhitespace: boolean;
  hasSurroundingQuotes: boolean;
  role: string | null;
  expired: boolean | null;
  verdict: string | null;
};

function decodeSegment(seg: string): Record<string, unknown> | null {
  try {
    const pad = seg.length % 4 === 0 ? seg : seg + "=".repeat(4 - (seg.length % 4));
    const json = Buffer.from(pad.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const parsed: unknown = JSON.parse(json);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function describeKey(raw: string | undefined | null, expectedRole?: string): KeyShape {
  const value = raw ?? "";
  const trimmed = value.trim();
  const unquoted = trimmed.replace(/^["']|["']$/g, "");
  const segments = unquoted.split(".").length;
  const looksLikeJwt = segments === 3 && unquoted.startsWith("eyJ");

  const payload = looksLikeJwt ? decodeSegment(unquoted.split(".")[1]!) : null;
  const role = typeof payload?.role === "string" ? payload.role : null;
  const exp = typeof payload?.exp === "number" ? payload.exp : null;
  const expired = exp === null ? null : exp * 1000 < Date.now();

  const shape: KeyShape = {
    length: value.length,
    segments,
    looksLikeJwt,
    hasSurroundingWhitespace: value !== trimmed,
    hasSurroundingQuotes: trimmed !== unquoted,
    role,
    expired,
    verdict: null,
  };

  // Most specific first - each of these has a different one-line fix.
  if (!value) shape.verdict = "Not set.";
  else if (value !== trimmed)
    shape.verdict =
      "The value has whitespace or a newline around it. Re-paste it into Vercel with no trailing newline, then redeploy.";
  else if (trimmed !== unquoted)
    shape.verdict = "The value is wrapped in quotes. Vercel stores the value literally - paste it without quotes.";
  else if (unquoted.startsWith("sb_secret_") || unquoted.startsWith("sb_publishable_"))
    shape.verdict =
      "This is one of Supabase's NEW API keys (sb_secret_… / sb_publishable_…). The Storage REST API here authenticates with the legacy JWT key - use the one that starts with `eyJ` from Supabase → Settings → API Keys → Legacy API keys.";
  else if (!looksLikeJwt)
    shape.verdict = `Not a JWT: expected 3 dot-separated parts starting with "eyJ", got ${segments} part(s). This is what Supabase reports as "Invalid Compact JWS". The value is probably truncated or is not the key at all.`;
  else if (expired) shape.verdict = "This key is a valid JWT but has EXPIRED. Issue a fresh one in Supabase.";
  else if (expectedRole && role && role !== expectedRole)
    shape.verdict = `This is the "${role}" key, not "${expectedRole}". Copy the ${expectedRole} key instead.`;
  else if (expectedRole && !role)
    shape.verdict = `Well-formed JWT, but it carries no "role" claim - it may not be a Supabase key.`;

  return shape;
}
