import { randomUUID } from "crypto";
import type { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import TwitterProvider from "next-auth/providers/twitter";
import * as Sentry from "@sentry/nextjs";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { googleEnabled, githubEnabled, twitterEnabled, isAdminEmail } from "@/lib/env";
import { verifyCode } from "@/lib/otp";
import { rateLimit, clientIpFromHeaders } from "@/lib/ratelimit";
import { generateUniqueUsername } from "@/lib/username";
import { pickPrimaryVerifiedEmail, publicImageUrl } from "@/lib/utils";

// P2021 = table missing, P2022 = column missing - both mean the DB hasn't
// picked up a schema change yet (the `db push` step in vercel-build is
// best-effort/non-fatal, so this can silently persist across deploys). Used
// below to make that loud instead of it looking like "wrong code" to users.
function isMissingSchemaError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err.code === "P2021" || err.code === "P2022");
}

interface LoginUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
  membership: string;
  passwordHash: string | null;
  failedLoginCount?: number | null;
  lockedUntil?: Date | null;
}

// A fixed, never-matched bcrypt hash used purely to normalize response time
// (see `authorize()` below) - comparing against it costs the same as a real
// bcrypt.compare, so "no such account" / "account locked" / "wrong password"
// can't be distinguished by an attacker timing responses.
const DUMMY_BCRYPT_HASH = "$2a$12$AERkE7fHnVvit4tqovioWuObx3iBGgLDSaWWul06R9n3z2g8R3t9O";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    ...(googleEnabled
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            // Link to an existing account with the same email. Safe here because
            // BOTH sides are email-verified: credentials signup requires an OTP
            // to the address, and Google only returns verified emails - so there
            // is no unverified-email takeover path. Without this, anyone who
            // signed up with email+password can't later use "Sign in with Google".
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    ...(githubEnabled
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
            // Link a GitHub login into an existing same-email account (same
            // rationale as Google). Safe ONLY because profile() below pins the
            // email to GitHub's primary+verified address and our credentials
            // signup is itself OTP-verified - so there's no unverified-email
            // account-takeover path.
            allowDangerousEmailAccountLinking: true,
            async profile(profile, tokens) {
              // Do NOT trust `profile.email` for linking: it's GitHub's *public*
              // profile email (or, when that's unset, the primary-but-not-
              // necessarily-verified address the default userinfo backfills) -
              // neither is proof the user owns it. With
              // allowDangerousEmailAccountLinking on, linking on an unverified
              // address would be an account-takeover vector. So fetch
              // /user/emails ourselves (granted by the `user:email` scope the
              // provider requests) and require primary && verified.
              let verifiedEmail: string | null = null;
              try {
                const res = await fetch("https://api.github.com/user/emails", {
                  headers: {
                    Authorization: `Bearer ${tokens.access_token}`,
                    Accept: "application/vnd.github+json",
                    "User-Agent": "xyz-crypto",
                  },
                });
                if (res.ok) verifiedEmail = pickPrimaryVerifiedEmail(await res.json());
              } catch {
                // Network/parse failure - fall through to the placeholder below.
              }
              return {
                id: String(profile.id),
                name: profile.name ?? profile.login,
                // No primary+verified email (private-email setting, missing
                // scope, or a failed lookup) -> a stable, non-deliverable
                // placeholder. User.email is required+unique, so login still
                // works; email features simply no-op; and crucially, no
                // account-linking happens on an unverified address.
                email: verifiedEmail ?? `gh-${profile.id}@users.noreply.xyzcrypto.io`,
                image: profile.avatar_url,
              };
            },
          }),
        ]
      : []),
    ...(twitterEnabled
      ? [
          TwitterProvider({
            clientId: process.env.TWITTER_CLIENT_ID!,
            clientSecret: process.env.TWITTER_CLIENT_SECRET!,
            version: "2.0", // OAuth 2.0 (X developer app)
            allowDangerousEmailAccountLinking: false,
            // X's OAuth 2.0 userinfo has NO email at all - same stable
            // placeholder strategy as GitHub so account creation works.
            profile(profile) {
              // version "2.0" always yields the v2 shape ({ data: {...} });
              // the type is a legacy/v2 union, so narrow it.
              const data = (profile as { data: { id: string; name?: string; username: string; profile_image_url?: string } }).data;
              return {
                id: data.id,
                name: data.name ?? data.username,
                email: `x-${data.id}@users.noreply.xyzcrypto.io`,
                image: data.profile_image_url?.replace("_normal", "") ?? null,
              };
            },
          }),
        ]
      : []),
    // Credentials: `login` uses email + password (rate-limited); `signup`
    // completes a verified-email registration with a one-time code.
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        code: { label: "Code", type: "text" },
        flow: { label: "Flow", type: "text" },
      },
      async authorize(credentials, req) {
        const email = credentials?.email?.toLowerCase().trim();
        const flow = credentials?.flow === "signup" ? "signup" : "login";
        if (!email) return null;

        if (flow === "signup") {
          // Verified-email registration: complete the pending signup (name+hash).
          const code = credentials?.code?.trim();
          if (!code) return null;
          // Per-account guard on top of otp.ts's own attempt counter - this is
          // the NextAuth entry point itself, so it's worth rate-limiting before
          // touching the DB/OTP-hash comparison at all, not just relying on the
          // downstream counter.
          const { success } = await rateLimit("login", `signup:${email}`);
          if (!success) return null;
          const result = await verifyCode(email, "signup", code);
          if (!result.ok) return null;
          const payload = (result.payload ?? {}) as {
            name?: string;
            passwordHash?: string;
          };
          // Create-or-get, race-safe: two parallel completions of the same
          // pending signup could both pass findUnique, so recover from the
          // unique-email collision (P2002) by re-reading the winning row.
          let user: Awaited<ReturnType<typeof prisma.user.findUnique>>;
          try {
            user = await prisma.user.findUnique({ where: { email } });
          } catch (err) {
            if (!isMissingSchemaError(err)) throw err;
            // A missing column here (e.g. `xp`, added in a schema change whose
            // `db push` silently failed at build time) makes signup fail
            // completely, but NextAuth turns any thrown authorize() error into
            // the same generic "Incorrect or expired code" message the client
            // shows for a real wrong code - indistinguishable to the user, and
            // otherwise invisible to us. Surface it loudly instead.
            Sentry.captureException(err, { tags: { area: "signup-completion" } });
            console.error("[auth] signup blocked - DB schema drift (missing column/table)", err);
            return null;
          }
          if (!user) {
            // Auto-assign a unique public handle so /u/<username> works (and the
            // navbar "Profile" link is never ambiguous with Settings).
            const username = await generateUniqueUsername(payload.name ?? email);
            try {
              user = await prisma.user.create({
                data: {
                  email,
                  name: payload.name ?? null,
                  passwordHash: payload.passwordHash ?? null,
                  provider: "credentials",
                  role: isAdminEmail(email) ? "ADMIN" : "USER",
                  username,
                },
              });
            } catch (err: any) {
              if (err?.code === "P2002") {
                // Email or handle collided with a concurrent signup - re-read the
                // winning row (it already has a handle).
                user = await prisma.user.findUnique({ where: { email } });
              } else if (isMissingSchemaError(err)) {
                Sentry.captureException(err, { tags: { area: "signup-completion" } });
                console.error("[auth] signup blocked - DB schema drift (missing column/table)", err);
                return null;
              } else {
                throw err;
              }
            }
          }
          if (!user) return null;
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            role: user.role,
            membership: user.membership,
          } as any;
        }

        // login flow - standard email + password (per-account rate limited).
        const password = credentials?.password;
        if (!password) return null;
        // Per-IP guard, independent of the per-email limiter below: every failed
        // attempt costs a real bcrypt compare (genuine synchronous CPU, not just
        // I/O - see DUMMY_BCRYPT_HASH below), so a bot rotating through many
        // fake/guessed emails from one IP would otherwise barely be throttled at
        // all despite forcing a full bcrypt op every single time.
        const ip = clientIpFromHeaders(req?.headers);
        const ipLimit = await rateLimit("loginIp", ip);
        if (!ipLimit.success) return null;
        const { success } = await rateLimit("login", email);
        if (!success) return null;
        // Consolidate user profile and lockout counters into a single query to eliminate
        // redundant sequential round-trips on every login attempt.
        let user: LoginUser | null = null;
        try {
          user = await prisma.user.findUnique({
            where: { email },
            select: {
              id: true, passwordHash: true, name: true, email: true,
              image: true, role: true, membership: true,
              failedLoginCount: true, lockedUntil: true,
            },
          });
        } catch (err) {
          // Fallback only if lockout columns are not in the DB schema yet (P2021/P2022)
          if (isMissingSchemaError(err)) {
            user = await prisma.user
              .findUnique({
                where: { email },
                select: {
                  id: true, passwordHash: true, name: true, email: true,
                  image: true, role: true, membership: true,
                },
              })
              .catch(() => null);
          } else {
            // Transient or unhandled DB error: log it, but do NOT return null early.
            // Leaving `user = null` ensures execution falls through to the dummy
            // bcrypt.compare below, preventing timing side-channel leaks.
            console.error("[auth:login] transient database error during lookup", err);
          }
        }
        if (!user || !user.passwordHash) {
          // Normalize timing with the real-account path below (dummy compare
          // costs the same ~80-150ms as a real bcrypt.compare) so a
          // nonexistent email can't be distinguished from a wrong password by
          // timing the response - a real user-enumeration vector otherwise.
          await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
          return null;
        }

        // Brute-force lockout check from the already fetched user record.
        const MAX_FAILED = 5;
        const LOCK_MS = 15 * 60 * 1000;
        if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
          // Same normalization for the locked-account fast path.
          await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
          return null;
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          // Atomic increment - a plain read-then-write ("fails = count + 1")
          // let concurrent failed attempts all read the same starting count
          // and each independently write count+1, so N parallel guesses only
          // ever advanced the stored count by 1 (lockout bypass via
          // parallelization). Prisma's `increment` compiles to a single
          // UPDATE ... SET x = x + 1, which Postgres row-locks, so parallel
          // requests serialize correctly here.
          const updated = await prisma.user
            .update({
              where: { id: user.id },
              data: { failedLoginCount: { increment: 1 } },
              select: { failedLoginCount: true },
            })
            .catch(() => null);
          if (updated && updated.failedLoginCount >= MAX_FAILED) {
            await prisma.user
              .update({
                where: { id: user.id },
                data: { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MS) },
              })
              .catch(() => null);
          }
          return null;
        }
        // Success: clear any accumulated failure state.
        if (user.failedLoginCount || user.lockedUntil) {
          await prisma.user
            .update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } })
            .catch(() => null);
        }
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          membership: user.membership,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.uid = (user as any).id;
        token.role = (user as any).role ?? "USER";
        token.membership = (user as any).membership ?? "Free";
        (token as any).syncedAt = Date.now();
        (token as any).pwdAt = Date.now();
        const sid = randomUUID();
        (token as any).sid = sid;
        if ((user as any).id) {
          await prisma.session
            ?.create({
              data: {
                sessionToken: sid,
                userId: (user as any).id,
                expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              },
            })
            .catch(() => null);
        }
      }
      // Refresh from DB when missing, on an explicit `update()` call, or once
      // this TTL has elapsed. Without the TTL, an admin granting Premium (or
      // any other role/permission change) to an already-logged-in user never
      // shows up for them - the JWT strategy doesn't touch the DB per request,
      // so once role/membership are set they'd otherwise stay frozen until the
      // next full login. Bounding staleness to a minute keeps this self-healing
      // without paying a DB read on literally every request.
      const MEMBERSHIP_TTL_MS = 60_000;
      const stale =
        typeof (token as any).syncedAt !== "number" || Date.now() - (token as any).syncedAt > MEMBERSHIP_TTL_MS;
      // This also pulls fresh name/image/username/permissions so profile + access
      // edits reflect in the UI without a re-login.
      //
      // ⚠️ This used to end "(routes always re-check DB anyway)". That was FALSE,
      // and it is the most dangerous sentence that has been in this file.
      // `requirePermission()`, `getSessionUser()` and `getAdminSession()`
      // (src/shared/utils/api.ts) all read **JWT claims only** - nothing
      // re-verifies authorization against the database. So the token *is* the
      // authorization decision, and this refresh is the only thing that makes
      // revoking a role, a membership or a permission take effect at all.
      //
      // A latency audit read that comment, concluded the TTL was redundant
      // belt-and-braces, and recommended raising it to 30 minutes. That would
      // have let a just-demoted admin keep admin - on every server-rendered
      // path - for half an hour. The recommendation was withdrawn only because
      // someone went and checked. Do not raise MEMBERSHIP_TTL_MS to save round
      // trips; cut request volume instead. See docs/AUDIT-2026-08-01-latency.md.
      if (
        token.email &&
        (!token.role || !token.membership || (token as any).isSuperAdmin === undefined || trigger === "update" || stale)
      ) {
        // Include `permissions` and `passwordChangedAt`, but tolerate a
        // not-yet-migrated DB by falling back to a select that names NEITHER, so
        // auth never breaks.
        //
        // ⚠️ Do not add new columns to the fallback. Its whole job is to be the
        // select that still works when the newest column has not landed yet - a
        // Prisma select naming a column the DB lacks throws P2022, so putting the
        // new field in BOTH means both throw and the refresh stops entirely,
        // taking role/membership/permissions freshness down with it. A missing
        // `passwordChangedAt` instead reads as undefined -> 0 below, i.e. "never
        // changed", so revocation is merely inert until the column exists. That
        // is the right degradation: this repo has had migrations fail silently on
        // every deploy for weeks (see the migration gotcha in CLAUDE.md), so the
        // pre-migration path is not hypothetical.
        let dbUser = await prisma.user
          .findUnique({
            where: { email: token.email },
            select: { id: true, role: true, membership: true, name: true, image: true, username: true, permissions: true, passwordChangedAt: true },
          })
          .catch(() => null);
        if (!dbUser) {
          dbUser = await prisma.user
            .findUnique({
              where: { email: token.email },
              select: { id: true, role: true, membership: true, name: true, image: true, username: true },
            })
            // Backfill both columns the fallback deliberately does not select, so
            // its shape matches the primary lookup. `passwordChangedAt: null` is
            // not a placeholder - on a DB without the column, "never changed" is
            // the only honest answer, and it makes revocation inert rather than
            // wrong until the migration lands.
            .then((u) => (u ? { ...u, permissions: [] as string[], passwordChangedAt: null } : null))
            .catch(() => null);
        }
        if (dbUser) {
          // ── Session revocation on password change ────────────────────────
          // Any token minted before the last password change is dead. This is
          // what makes "reset my password" actually lock out whoever else is
          // holding a session, instead of only rotating the hash while their
          // JWT stays valid for the rest of its 30-day life.
          //
          // ⚠️ This compares a timestamp WE persist in the token (`pwdAt`), NOT
          // `token.iat`. `iat` looks like the obvious choice and does not work:
          // next-auth re-encodes the token on every single session read, and
          // `encode()` calls `.setIssuedAt()` with no argument
          // (node_modules/next-auth/jwt/index.js:44), so `iat` is refreshed to
          // "now" constantly. A check against it would silently never fire.
          //
          // Note where this sits: INSIDE the TTL-gated refresh above, so
          // revocation takes effect within `MEMBERSHIP_TTL_MS` (60s) rather than
          // instantly - a token that synced 5s ago keeps working for another 55,
          // server-side reads included. That is the same window that already
          // bounds role/membership/permission revocation, and it is the price of
          // not doing a DB read on every authenticated request. Do not describe
          // this as immediate.
          //
          // 🔴 An ABSENT `pwdAt` means "we do not know when this token was
          // minted". It must NEVER be read as 0 ("minted at the epoch"), and
          // reading it that way locked people out of their own accounts.
          //
          // `pwdAt` is stamped ON the token, four lines below - so a token minted
          // one millisecond ago by a successful password check does not have one
          // yet. Defaulting it to 0 made the newest possible token look older
          // than the password change, so `dbPwdAt > 0` fired and the callback
          // threw the fresh token away. From the member's side: the correct
          // password, the button goes "Signing in…", the page redirects home, and
          // the navbar still says "Log in". **No error is ever shown, because
          // nothing failed** - `authorize()` accepted the password and this
          // discarded the result.
          //
          // `passwordChangedAt` is written ONLY by the reset and change-password
          // routes, never at signup, so it hit exactly the members who had ever
          // reset or changed a password - permanently, on every device - while
          // everyone else was fine. That is why it read as "only some devices".
          //
          // The earlier note here reasoned about DEPLOYING this feature not
          // signing the userbase out, which was right: `passwordChangedAt = null`
          // gives `dbPwdAt = 0` and `0 > 0` is false. It just never asked what a
          // brand-new token looks like on the way IN.
          //
          // Unknown is not evidence of staleness. Stamp it and move on; the next
          // password change gives us a real `pwdAt` to compare against, so
          // revocation keeps working for every token that has one. A token cannot
          // be forged or edited to drop the field - NextAuth encrypts and signs it.
          const dbPwdAt = (dbUser as any).passwordChangedAt
            ? new Date((dbUser as any).passwordChangedAt).getTime()
            : 0;
          const rawPwdAt = (token as any).pwdAt;
          const tokenPwdAt = typeof rawPwdAt === "number" ? rawPwdAt : null;
          if (tokenPwdAt !== null && dbPwdAt > tokenPwdAt) {
            // Empty token => the session callback below returns an empty session
            // => getServerSession() resolves to null and useSession() reports
            // signed-out. Every gate fails closed.
            return {};
          }
          (token as any).pwdAt = tokenPwdAt ?? dbPwdAt;

          // ── Per-device session revocation check ─────────────────────────
          // Each device holds a unique `sid`. Single-device logout deletes only
          // that row from `Session`, leaving other devices (laptop, phone) alive.
          // If this token carries a `sid` that no longer exists in `Session`, the
          // session was revoked: return an empty token to fail closed.
          const sid = (token as any).sid;
          if (sid) {
            let sessionValid = true;
            try {
              if (prisma.session) {
                const active = await prisma.session.findUnique({
                  where: { sessionToken: sid },
                  select: { id: true },
                });
                if (!active) {
                  sessionValid = false;
                }
              }
            } catch {
              // Fail open on DB blip or missing table: a transient DB error
              // must never falsely log members out.
              sessionValid = true;
            }
            if (!sessionValid) {
              return {};
            }
          } else if (dbUser.id) {
            // Existing token from before per-session tracking was deployed:
            // stamp a new `sid` now so subsequent single-device logouts work,
            // ensuring deploying this change signs nobody out.
            const newSid = randomUUID();
            (token as any).sid = newSid;
            await prisma.session
              ?.create({
                data: {
                  sessionToken: newSid,
                  userId: dbUser.id,
                  expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                },
              })
              .catch(() => null);
          }

          token.uid = dbUser.id;
          token.role = dbUser.role;
          token.membership = dbUser.membership;
          token.name = dbUser.name;
          token.picture = dbUser.image;
          token.username = dbUser.username;
          (token as any).permissions = (dbUser as any).permissions ?? [];
          (token as any).isSuperAdmin = isAdminEmail(token.email);
          (token as any).syncedAt = Date.now();
        }
      }
      // The JWT is stored in a cookie (~4 KB limit), so an inline data: URL
      // avatar (the zero-config upload path) must never go in it.
      //
      // It used to be dropped to null, and the comment here claimed "the real
      // image still renders from the DB on the profile + in comments". That was
      // wrong: those paths stripped it too, so the navbar showing initials was
      // not a small cosmetic fallback - it was the same photo being discarded
      // everywhere. Point the token at the media route instead: a short URL,
      // nowhere near the cookie limit, and the same image everyone else sees.
      if (typeof token.picture === "string" && token.picture.startsWith("data:")) {
        token.picture = publicImageUrl(token.picture, typeof token.uid === "string" ? token.uid : null);
      }
      return token;
    },
    async session({ session, token }) {
      // A token revoked by the password-change check above arrives here as `{}`.
      // Returning an empty session makes BOTH halves resolve to "signed out",
      // which is why this shape is safe rather than merely convenient:
      //   - server: next-auth/next/index.js returns the body only when
      //     `Object.keys(body).length` is truthy, else null -> getServerSession()
      //     resolves to null.
      //   - client: next-auth/client/_utils.js fetchData() returns
      //     `Object.keys(data).length > 0 ? data : null`, so useSession() reports
      //     `status: "unauthenticated"` rather than authenticated-with-no-user.
      // Both sides use the same emptiness test, so there is no window in which
      // the browser believes it is signed in while the server disagrees.
      //
      // `uid` is the right thing to test: it is set on the sign-in path and on
      // every refresh, so its absence means the token is not a usable identity.
      if (!token || !(token as any).uid) return {} as typeof session;
      if (session.user) {
        (session.user as any).id = token.uid;
        (session.user as any).role = token.role ?? "USER";
        (session.user as any).membership = token.membership ?? "Free";
        (session.user as any).username = token.username ?? null;
        (session.user as any).permissions = (token as any).permissions ?? [];
        (session.user as any).isSuperAdmin = (token as any).isSuperAdmin ?? false;
      }
      return session;
    },
  },
  events: {
    // Record last login time on every successful sign-in (email or Google).
    async signIn({ user }) {
      if (!user?.id) return;
      await prisma.user
        .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
        .catch(() => null);
    },
    // Promote the configured admin email and mint a public handle for new
    // OAuth users (so their /u/<username> profile works at once). The actual
    // provider name is stamped in linkAccount below (google/github/twitter).
    async createUser({ user }) {
      if (!user.email) return;
      const username = await generateUniqueUsername(user.name ?? user.email);
      await prisma.user
        .update({
          where: { id: user.id },
          data: {
            username,
            ...(isAdminEmail(user.email) ? { role: "ADMIN" } : {}),
          },
        })
        // Handle race on the unique username - retry once without it.
        .catch(async () => {
          await prisma.user
            .update({
              where: { id: user.id },
              data: { ...(isAdminEmail(user.email!) ? { role: "ADMIN" } : {}) },
            })
            .catch(() => null);
        });
    },
    // Fires when an OAuth account is attached (incl. first sign-up) - stamp
    // which provider this user came from (was hardcoded "google" before).
    async linkAccount({ user, account }) {
      if (!user?.id || !account?.provider) return;
      await prisma.user
        .update({ where: { id: user.id }, data: { provider: account.provider } })
        .catch(() => null);
    },
    // Invalidate session on explicit logout: remove this specific device's session
    // from the DB so any copied/stolen JWT from this device is killed on its next refresh.
    //
    // ⚠️ Crucially: do NOT bump `passwordChangedAt` here.
    // Bumping `passwordChangedAt` broke the invariant that it is written ONLY on
    // password reset/change, and it caused single-device logouts (e.g. on a phone)
    // to silently and randomly sign out all other devices (laptop, tablet, etc.).
    async signOut(message) {
      const token = (message as any)?.token;
      const sid = token?.sid ?? token?.sessionId;
      if (sid) {
        await prisma.session
          ?.deleteMany({ where: { sessionToken: sid } })
          .catch(() => null);
      }
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
