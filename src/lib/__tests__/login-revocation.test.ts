import { beforeEach, describe, expect, it, vi } from "vitest";

// The real jwt callback, driven the way NextAuth drives it.
const DB = {
  passwordChangedAt: null as Date | null,
  activeSessions: new Map<string, { userId: string; expires: Date }>(),
  sessionCreateThrows: false,
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
        if (DB.sessionCreateThrows) {
          throw new Error("P1001: Can't reach database server");
        }
        if (data?.sessionToken) {
          DB.activeSessions.set(data.sessionToken, {
            userId: data.userId,
            expires: data.expires ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          });
        }
        return { id: "sess_1", ...data };
      },
      findUnique: async ({ where }: any) => {
        if (!where?.sessionToken) return null;
        const record = DB.activeSessions.get(where.sessionToken);
        if (!record) return null;
        if (where.expires?.gt && !(record.expires > where.expires.gt)) {
          return null;
        }
        return { id: "sess_1", sessionToken: where.sessionToken, expires: record.expires };
      },
      deleteMany: async ({ where }: any) => {
        let count = 0;
        if (where?.sessionToken) {
          if (DB.activeSessions.delete(where.sessionToken)) count++;
        }
        if (where?.userId) {
          for (const [sid, sess] of Array.from(DB.activeSessions.entries())) {
            if (sess.userId === where.userId) {
              if (where.expires?.lt) {
                if (sess.expires < where.expires.lt) {
                  DB.activeSessions.delete(sid);
                  count++;
                }
              } else {
                DB.activeSessions.delete(sid);
                count++;
              }
            }
          }
        }
        return { count };
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
  DB.sessionCreateThrows = false;
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

describe("resilience to session write failure", () => {
  it("keeps member signed in if session.create throws at login", async () => {
    DB.sessionCreateThrows = true;
    const token = (await signIn()) as Record<string, unknown>;
    // Crucial: transient DB failure at login must NOT bounce the user
    expect(signedOut(token)).toBe(false);
    expect(token.uid).toBe("cmq9kzbdw0005bwb7taega6av");
    // sid must not be claimed if row was not confirmed written
    expect(token.sid).toBeUndefined();
  });

  it("keeps legacy member signed in if backfill session.create throws", async () => {
    // Legacy token with no sid
    const legacyToken = {
      email: EMAIL,
      uid: "cmq9kzbdw0005bwb7taega6av",
      role: "USER",
      membership: "Free",
      isSuperAdmin: false,
      pwdAt: Date.now(),
      syncedAt: 0,
    };
    DB.sessionCreateThrows = true;
    const refreshed = (await jwt({ token: legacyToken } as never)) as Record<string, unknown>;
    expect(signedOut(refreshed)).toBe(false);
    expect(refreshed.sid).toBeUndefined();

    // Even on the subsequent refresh after DB recovers, they must still stay signed in
    DB.sessionCreateThrows = false;
    const secondRefresh = (await jwt({
      token: { ...refreshed, syncedAt: 0 },
    } as never)) as Record<string, unknown>;
    expect(signedOut(secondRefresh)).toBe(false);
  });
});

describe("session expiration enforcement and cleanup", () => {
  it("rejects an expired session row even if it exists in DB", async () => {
    // Manually plant an expired session in DB
    const expiredSid = "expired_session_123";
    DB.activeSessions.set(expiredSid, {
      userId: "cmq9kzbdw0005bwb7taega6av",
      expires: new Date(Date.now() - 1000), // expired 1s ago
    });

    const token = {
      email: EMAIL,
      uid: "cmq9kzbdw0005bwb7taega6av",
      role: "USER",
      membership: "Free",
      isSuperAdmin: false,
      sid: expiredSid,
      syncedAt: 0, // trigger DB check
    };

    const refreshed = (await jwt({ token } as never)) as Record<string, unknown>;
    // Because expires < now, lookup rejects it -> signed out
    expect(signedOut(refreshed)).toBe(true);
  });

  it("accepts a session row whose expiry is in the future", async () => {
    const validSid = "valid_session_123";
    DB.activeSessions.set(validSid, {
      userId: "cmq9kzbdw0005bwb7taega6av",
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const token = {
      email: EMAIL,
      uid: "cmq9kzbdw0005bwb7taega6av",
      role: "USER",
      membership: "Free",
      isSuperAdmin: false,
      sid: validSid,
      syncedAt: 0,
    };

    const refreshed = (await jwt({ token } as never)) as Record<string, unknown>;
    expect(signedOut(refreshed)).toBe(false);
    expect(refreshed.sid).toBe(validSid);
  });

  it("deletes expired sessions on login while preserving active sessions", async () => {
    // 1 expired session and 1 active session for this user
    const expiredSid = "old_expired_sid";
    const activeSid = "active_other_device_sid";
    DB.activeSessions.set(expiredSid, {
      userId: "cmq9kzbdw0005bwb7taega6av",
      expires: new Date(Date.now() - 24 * 60 * 60 * 1000), // expired yesterday
    });
    DB.activeSessions.set(activeSid, {
      userId: "cmq9kzbdw0005bwb7taega6av",
      expires: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days left
    });

    // Login creates a new session and purges expired ones
    const token = (await signIn()) as Record<string, unknown>;
    expect(signedOut(token)).toBe(false);

    // Expired session was deleted
    expect(DB.activeSessions.has(expiredSid)).toBe(false);
    // Active session on other device remains intact
    expect(DB.activeSessions.has(activeSid)).toBe(true);
    // Brand-new session was added
    expect(DB.activeSessions.has(token.sid as string)).toBe(true);
  });
});


