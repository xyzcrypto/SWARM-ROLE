import type { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import TwitterProvider from "next-auth/providers/twitter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { googleEnabled, githubEnabled, twitterEnabled, isAdminEmail } from "@/lib/env";
import { verifyCode } from "@/lib/otp";
import { rateLimit } from "@/lib/ratelimit";
import { generateUniqueUsername } from "@/lib/username";

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
            // to the address, and Google only returns verified emails — so there
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
            // Same rationale as Google: GitHub returns the account's verified
            // primary email, and our credentials signup is OTP-verified, so
            // linking by email is safe and lets existing users use GitHub.
            allowDangerousEmailAccountLinking: true,
            // GitHub can hide the email (private-email setting). Our User.email
            // is required+unique, so fall back to a non-deliverable but stable
            // placeholder — login still works; email features simply no-op.
            profile(profile) {
              return {
                id: String(profile.id),
                name: profile.name ?? profile.login,
                email: profile.email ?? `gh-${profile.id}@users.noreply.xyzcrypto.io`,
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
            // X's OAuth 2.0 userinfo has NO email at all — same stable
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
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const flow = credentials?.flow === "signup" ? "signup" : "login";
        if (!email) return null;

        if (flow === "signup") {
          // Verified-email registration: complete the pending signup (name+hash).
          const code = credentials?.code?.trim();
          if (!code) return null;
          const result = await verifyCode(email, "signup", code);
          if (!result.ok) return null;
          const payload = (result.payload ?? {}) as {
            name?: string;
            passwordHash?: string;
          };
          // Create-or-get, race-safe: two parallel completions of the same
          // pending signup could both pass findUnique, so recover from the
          // unique-email collision (P2002) by re-reading the winning row.
          let user = await prisma.user.findUnique({ where: { email } });
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
        if (!user || !user.passwordHash) return null;

        // Brute-force lockout. Read/write the counters in guarded queries so a
        // not-yet-migrated DB (no lockout columns) simply skips the feature
        // rather than blocking sign-in.
        const MAX_FAILED = 5;
        const LOCK_MS = 15 * 60 * 1000;
        const lock = await prisma.user
          .findUnique({ where: { id: user.id }, select: { failedLoginCount: true, lockedUntil: true } })
          .catch(() => null);
        if (lock?.lockedUntil && lock.lockedUntil.getTime() > Date.now()) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          const fails = (lock?.failedLoginCount ?? 0) + 1;
          const locked = fails >= MAX_FAILED;
          await prisma.user
            .update({
              where: { id: user.id },
              data: {
                failedLoginCount: locked ? 0 : fails,
                lockedUntil: locked ? new Date(Date.now() + LOCK_MS) : lock?.lockedUntil ?? null,
              },
            })
            .catch(() => null);
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
    // Fires when an OAuth account is attached (incl. first sign-up) — stamp
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
