import { randomInt, createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

export type OtpPurpose = "signup" | "login" | "reset";

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

function getOtpSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  // Fail closed: never hash OTP codes with the guessable dev fallback in production
  if (
    process.env.NODE_ENV === "production" &&
    (!secret || secret === "insecure-dev-secret")
  ) {
    throw new Error("NEXTAUTH_SECRET must be set in production (OTP hashing).");
  }
  return secret || "insecure-dev-secret";
}

/** Cryptographically-random 6-digit code (zero-padded). */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

// Codes are short-lived (10 min) and attempt-limited (5), so a keyed HMAC is
// both fast and secure: an attacker can't brute-force the stored hash offline
// without NEXTAUTH_SECRET. Much faster than bcrypt on the hot auth path.
function hashCode(code: string): string {
  return createHmac("sha256", getOtpSecret()).update(code).digest("hex");
}

function codesMatch(code: string, storedHash: string): boolean {
  const a = Buffer.from(hashCode(code));
  const b = Buffer.from(storedHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Issue a fresh code for an email + purpose. Any previous codes for the same
 * email/purpose are removed (only the latest is valid). Returns the plaintext
 * code for the caller to email - only the bcrypt hash is stored.
 */
export async function issueCode(
  email: string,
  purpose: OtpPurpose,
  payload?: Record<string, unknown>
): Promise<string> {
  const code = generateCode();
  const codeHash = hashCode(code);
  // Atomic transaction: invalidate previous codes for this user + issue fresh code.
  // Scoped to (email, purpose) so this hot auth path stays ultra-fast on @@index([email, purpose])
  // without scanning or locking other users' expired rows.
  await prisma.$transaction([
    prisma.verificationCode.deleteMany({
      where: { email, purpose },
    }),
    prisma.verificationCode.create({
      data: {
        email,
        purpose,
        codeHash,
        payload: payload ? JSON.stringify(payload) : null,
        expiresAt: new Date(Date.now() + TTL_MS),
      },
    }),
  ]);
  return code;
}

/**
 * Purge all expired verification codes across the database.
 * Uses @@index([expiresAt]) to perform a fast index scan.
 */
export async function purgeExpiredVerificationCodes(): Promise<number> {
  const res = await prisma.verificationCode
    .deleteMany({
      where: { expiresAt: { lt: new Date() } },
    })
    .catch(() => ({ count: 0 }));
  return res.count;
}

type VerifyResult =
  | { ok: true; payload: Record<string, unknown> | undefined }
  | { ok: false; error: string };

/**
 * Verify a submitted code. On success the code is consumed (single use) and any
 * stored payload returned. Wrong codes increment an attempt counter; the code
 * is invalidated after too many attempts or once expired.
 */
export async function verifyCode(
  email: string,
  purpose: OtpPurpose,
  code: string
): Promise<VerifyResult> {
  const rec = await prisma.verificationCode.findFirst({
    where: { email, purpose },
    orderBy: { createdAt: "desc" },
  });
  if (!rec) return { ok: false, error: "No code found. Please request a new one." };

  if (rec.expiresAt.getTime() < Date.now()) {
    await prisma.verificationCode.delete({ where: { id: rec.id } });
    return { ok: false, error: "Code expired. Please request a new one." };
  }
  if (rec.attempts >= MAX_ATTEMPTS) {
    await prisma.verificationCode.delete({ where: { id: rec.id } });
    return { ok: false, error: "Too many incorrect attempts. Please request a new code." };
  }

  const match = codesMatch(code, rec.codeHash);
  if (!match) {
    await prisma.verificationCode.update({
      where: { id: rec.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, error: "Incorrect code. Please try again." };
  }

  const payload = rec.payload ? (JSON.parse(rec.payload) as Record<string, unknown>) : undefined;
  await prisma.verificationCode.delete({ where: { id: rec.id } });
  return { ok: true, payload };
}
