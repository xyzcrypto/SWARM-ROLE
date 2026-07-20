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
import { pickPrimaryVerifiedEmail } from "@/lib/utils";

// P2021 = table missing, P2022 = column missing - both mean the DB hasn't
// picked up a schema change yet (the `db push` step in vercel-build is
// best-effort/non-fatal, so this can silently persist across deploys). Used
// below to make that loud instead of it looking like "wrong code" to users.
function isMissingSchemaError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err.code === "P2021" || err.code === "P2022");
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
        // Explicit select keeps the login path independent of the lockout
        // columns, so auth keeps working even before that migration is applied.
        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true, passwordHash: true, name: true, email: true,
            image: true, role: true, membership: true,
          },
        });
        if (!user || !user.passwordHash) {
          // Normalize timing with the real-account path below (dummy compare
          // costs the same ~80-150ms as a real bcrypt.compare) so a
          // nonexistent email can't be distinguished from a wrong password by
          // timing the response - a real user-enumeration vector otherwise.
          await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
          return null;
        }

        // Brute-force lockout. Read/write the counters in guarded queries so a
        // not-yet-migrated DB (no lockout columns) simply skips the feature
        // rather than blocking sign-in.
        const MAX_FAILED = 5;
        const LOCK_MS = 15 * 60 * 1000;
        const lock = await prisma.user
          .findUnique({ where: { id: user.id }, select: { failedLoginCount: true, lockedUntil: true } })
          .catch(() => null);
        if (lock?.lockedUntil && lock.lockedUntil.getTime() > Date.now()) {
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
        if (lock && (lock.failedLoginCount || lock.lockedUntil)) {
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
      }
      // Refresh from DB when missing, or on an explicit `update()` call. This
      // also pulls fresh name/image/username/permissions so profile + access edits
      // reflect in the UI without a re-login (routes always re-check DB anyway).
      if (
        token.email &&
        (!token.role || !token.membership || (token as any).isSuperAdmin === undefined || trigger === "update")
      ) {
        // Include `permissions`, but tolerate a not-yet-migrated DB (no column)
        // by falling back to the pre-permissions select so auth never breaks.
        let dbUser = await prisma.user
          .findUnique({
            where: { email: token.email },
            select: { id: true, role: true, membership: true, name: true, image: true, username: true, permissions: true },
          })
          .catch(() => null);
        if (!dbUser) {
          dbUser = await prisma.user
            .findUnique({
              where: { email: token.email },
              select: { id: true, role: true, membership: true, name: true, image: true, username: true },
            })
            .then((u) => (u ? { ...u, permissions: [] as string[] } : null))
            .catch(() => null);
        }
        if (dbUser) {
          token.uid = dbUser.id;
          token.role = dbUser.role;
          token.membership = dbUser.membership;
          token.name = dbUser.name;
          token.picture = dbUser.image;
          token.username = dbUser.username;
          (token as any).permissions = (dbUser as any).permissions ?? [];
          (token as any).isSuperAdmin = isAdminEmail(token.email);
        }
      }
      // The JWT is stored in a cookie (~4 KB limit). If the avatar is an inline
      // data: URL (zero-config upload path), keep it OUT of the token so it can't
      // bloat/break the session cookie - the real image still renders from the DB
      // on the profile + in comments; the navbar just falls back to initials.
      if (typeof token.picture === "string" && token.picture.startsWith("data:")) {
        token.picture = null;
      }
      return token;
    },
    async session({ session, token }) {
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
  },
  secret: process.env.NEXTAUTH_SECRET,
};
