// Server-only helper to mint a unique public handle for a user. Kept separate
// from `profile.ts` (which is import-safe on the client) because this touches the
// database. Reuses the same normalization + validation rules so generated
// handles satisfy the public-profile constraints.
import { prisma } from "@/lib/prisma";
import { normalizeUsername, USERNAME_RE, RESERVED_USERNAMES } from "@/lib/profile";

function randomSuffix(n = 4): string {
  return Math.random().toString(36).slice(2, 2 + n);
}

/** Reduce a name/email to a clean handle base (lowercase [a-z0-9_], >= 3 chars). */
function baseFrom(input?: string | null): string {
  const raw = (input ?? "").split("@")[0] ?? "";
  let v = normalizeUsername(raw).replace(/[^a-z0-9_]/g, "");
  if (v.length < 3) v = `user${v}`;
  return v.slice(0, 16) || "user";
}

/**
 * Generate a unique, valid username derived from a name/email seed. Tries the
 * clean base first, then appends a short random suffix on collision, retrying a
 * bounded number of times. Server-only (queries the DB for availability).
 */
export async function generateUniqueUsername(seed?: string | null): Promise<string> {
  const base = baseFrom(seed);
  for (let attempt = 0; attempt < 12; attempt++) {
    let candidate = attempt === 0 ? base : `${base.slice(0, 14)}_${randomSuffix(attempt < 4 ? 3 : 5)}`;
    candidate = candidate.slice(0, 20);
    if (!USERNAME_RE.test(candidate) || RESERVED_USERNAMES.has(candidate)) continue;
    const existing = await prisma.user
      .findUnique({ where: { username: candidate }, select: { id: true } })
      .catch(() => null);
    if (!existing) return candidate;
  }
  // Extremely unlikely fallback - guaranteed-valid random handle.
  return `user_${randomSuffix(8)}`.slice(0, 20);
}
