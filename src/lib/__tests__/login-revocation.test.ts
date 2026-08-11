import { beforeEach, describe, expect, it, vi } from "vitest";

// The real jwt callback, driven the way NextAuth drives it.
const DB = { passwordChangedAt: null as Date | null };
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: async () => ({
        id: "cmq9kzbdw0005bwb7taega6av",
        role: "USER",
        membership: "Free",
        name: "Aniket",
        image: null,
        username: "aniket",
        permissions: [],
        passwordChangedAt: DB.passwordChangedAt,
      }),
    },
  },
}));
vi.mock("@/lib/otp", () => ({ verifyCode: async () => true }));
vi.mock("@/lib/ratelimit", () => ({
  rateLimit: async () => ({ success: true }),
  clientIpFromHeaders: () => "1.2.3.4",
}));

import { authOptions } from "@/lib/auth";

const jwt = authOptions.callbacks!.jwt!;
const session = authOptions.callbacks!.session!;

const EMAIL = "aniketka011@gmail.com";
/** What NextAuth passes on a successful credential sign-in. */
const signIn = () =>
  jwt({
    token: { email: EMAIL, name: "Aniket" },
    user: { id: "cmq9kzbdw0005bwb7taega6av", email: EMAIL, role: "USER", membership: "Free" },
  } as never);

/** A token is "signed out" when the callback empties it. */
const signedOut = (t: Record<string, unknown>) => !t || !t.uid;

beforeEach(() => {
  DB.passwordChangedAt = null;
});

describe("signing in with the correct password", () => {
  it("works for a member who has never changed their password", async () => {
    const token = (await signIn()) as Record<string, unknown>;
    expect(signedOut(token)).toBe(false);
    expect(token.uid).toBe("cmq9kzbdw0005bwb7taega6av");
  });

  // ⚠️ THE BUG, reported from a video: correct password, the button goes
  // "Signing in…", the page redirects home - and the navbar still says "Log in".
  // No error is ever shown, because nothing failed: `authorize()` accepted the
  // password and then the jwt callback threw the brand-new token away.
  //
  // `pwdAt` is stamped ON the token, so a token minted one millisecond ago by a
  // successful password check does not have one yet. Reading that absence as `0`
  // made it look older than the password change, so the revocation check fired on
  // the one token that could not possibly be stale.
  //
  // `passwordChangedAt` is written ONLY by the reset and change-password routes,
  // never at signup - which is exactly why it hit "only some users": everyone who
  // had ever reset or changed a password was permanently locked out of their own
  // account, and everyone else was fine.
  it("works for a member who changed their password an hour ago", async () => {
    DB.passwordChangedAt = new Date(Date.now() - 60 * 60 * 1000);
    const token = (await signIn()) as Record<string, unknown>;
    expect(signedOut(token)).toBe(false);
  });

  it("works for a member who changed their password just now", async () => {
    DB.passwordChangedAt = new Date();
    const token = (await signIn()) as Record<string, unknown>;
    expect(signedOut(token)).toBe(false);
  });

  it("produces a session the client reads as signed in", async () => {
    DB.passwordChangedAt = new Date(Date.now() - 60 * 60 * 1000);
    const token = (await signIn()) as Record<string, unknown>;
    const s = (await session({ session: { user: {} }, token } as never)) as unknown as Record<string, unknown>;
    // NextAuth treats an empty object as signed out on BOTH sides.
    expect(Object.keys(s).length).toBeGreaterThan(0);
  });
});

describe("revocation still revokes what it is meant to", () => {
  // The whole point of the feature: a session held by someone else, minted
  // BEFORE the password changed, must die. That is a token carrying a real,
  // older `pwdAt` - not one carrying none.
  it("kills an existing session minted before the password change", async () => {
    DB.passwordChangedAt = new Date();
    const stale = {
      email: EMAIL,
      uid: "cmq9kzbdw0005bwb7taega6av",
      role: "USER",
      membership: "Free",
      isSuperAdmin: false,
      pwdAt: Date.now() - 24 * 60 * 60 * 1000, // minted yesterday
      syncedAt: 0, // forces the TTL-gated DB refresh
    };
    const token = (await jwt({ token: stale } as never)) as Record<string, unknown>;
    expect(signedOut(token)).toBe(true);
  });

  it("leaves a session minted after the password change alone", async () => {
    DB.passwordChangedAt = new Date(Date.now() - 60 * 60 * 1000);
    const fresh = {
      email: EMAIL,
      uid: "cmq9kzbdw0005bwb7taega6av",
      role: "USER",
      membership: "Free",
      isSuperAdmin: false,
      pwdAt: Date.now(),
      syncedAt: 0,
    };
    const token = (await jwt({ token: fresh } as never)) as Record<string, unknown>;
    expect(signedOut(token)).toBe(false);
  });
});
