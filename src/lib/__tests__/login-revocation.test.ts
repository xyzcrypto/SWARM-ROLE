import { beforeEach, describe, expect, it, vi } from "vitest";

// The real jwt callback, driven the way NextAuth drives it.
const DB = {
  passwordChangedAt: null as Date | null,
  activeSessions: new Set<string>(),
};
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
    session: {
      create: async ({ data }: any) => {
        if (data?.sessionToken) DB.activeSessions.add(data.sessionToken);
        return { id: "sess_1", ...data };
      },
      findUnique: async ({ where }: any) => {
        if (where?.sessionToken && DB.activeSessions.has(where.sessionToken)) {
          return { id: "sess_1", sessionToken: where.sessionToken };
        }
        return null;
      },
      deleteMany: async ({ where }: any) => {
        if (where?.sessionToken) {
          DB.activeSessions.delete(where.sessionToken);
        }
        return { count: 1 };
      },
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
  DB.activeSessions.clear();
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

describe("per-device session revocation", () => {
  const signOut = authOptions.events!.signOut!;

  it("stamps a sid on sign-in and tracks it in active sessions", async () => {
    const token = (await signIn()) as Record<string, unknown>;
    expect(typeof token.sid).toBe("string");
    expect(DB.activeSessions.has(token.sid as string)).toBe(true);
  });

  it("logging out on phone revokes phone session but leaves laptop session active", async () => {
    // 1. User signs in on phone
    const phoneToken = (await signIn()) as Record<string, unknown>;
    const phoneSid = phoneToken.sid as string;

    // 2. User signs in on laptop
    const laptopToken = (await signIn()) as Record<string, unknown>;
    const laptopSid = laptopToken.sid as string;

    expect(phoneSid).not.toBe(laptopSid);
    expect(DB.activeSessions.has(phoneSid)).toBe(true);
    expect(DB.activeSessions.has(laptopSid)).toBe(true);

    // 3. User logs out on phone
    await signOut({ token: phoneToken } as never);

    // Phone session is deleted from DB
    expect(DB.activeSessions.has(phoneSid)).toBe(false);
    // Laptop session remains alive in DB
    expect(DB.activeSessions.has(laptopSid)).toBe(true);
    // passwordChangedAt is NOT touched
    expect(DB.passwordChangedAt).toBeNull();

    // 4. Laptop token refreshes - it must NOT be signed out
    const laptopRefreshed = (await jwt({
      token: { ...laptopToken, syncedAt: 0 },
    } as never)) as Record<string, unknown>;
    expect(signedOut(laptopRefreshed)).toBe(false);

    // 5. Phone token refreshes (e.g. stolen copy used after logout) - it MUST be revoked
    const phoneRefreshed = (await jwt({
      token: { ...phoneToken, syncedAt: 0 },
    } as never)) as Record<string, unknown>;
    expect(signedOut(phoneRefreshed)).toBe(true);
  });
});
