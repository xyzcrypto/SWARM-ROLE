import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export type OtpPurpose = "signup" | "login" | "reset";

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

/** Cryptographically-random 6-digit code (zero-padded). */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * Issue a fresh code for an email + purpose. Any previous codes for the same
 * email/purpose are removed (only the latest is valid). Returns the plaintext
 * code for the caller to email — only the bcrypt hash is stored.
 */
export async function issueCode(
  email: string,
  purpose: OtpPurpose,
  payload?: Record<string, unknown>
): Promise<string> {
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  await prisma.verificationCode.deleteMany({ where: { email, purpose } });
  await prisma.verificationCode.create({
    data: {
      email,
      purpose,
      codeHash,
      payload: payload ? JSON.stringify(payload) : null,
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  });
  return code;
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

  const match = await bcrypt.compare(code, rec.codeHash);
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
