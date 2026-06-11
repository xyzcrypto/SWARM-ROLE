import type { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { googleEnabled, isAdminEmail } from "@/lib/env";
import { verifyCode } from "@/lib/otp";
import { rateLimit } from "@/lib/ratelimit";

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
            // Safer default: do not auto-link an OAuth login to an existing
            // credentials account with the same email (prevents takeover).
            allowDangerousEmailAccountLinking: false,
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
          const existing = await prisma.user.findUnique({ where: { email } });
          const user =
            existing ??
            (await prisma.user.create({
              data: {
                email,
                name: payload.name ?? null,
                passwordHash: payload.passwordHash ?? null,
                provider: "credentials",
                role: isAdminEmail(email) ? "ADMIN" : "USER",
              },
            }));
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            role: user.role,
            membership: user.membership,
          } as any;
        }

        // login flow — standard email + password (per-account rate limited).
        const password = credentials?.password;
        if (!password) return null;
        const { success } = await rateLimit("login", email);
        if (!success) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
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
      // also pulls fresh name/image/username so profile edits reflect in the UI
      // without a re-login (membership is a client hint — routes re-check DB).
      if (token.email && (!token.role || !token.membership || trigger === "update")) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
          select: { id: true, role: true, membership: true, name: true, image: true, username: true },
        });
        if (dbUser) {
          token.uid = dbUser.id;
          token.role = dbUser.role;
          token.membership = dbUser.membership;
          token.name = dbUser.name;
          token.picture = dbUser.image;
          token.username = dbUser.username;
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
    // Promote the configured admin email & tag the provider for OAuth users.
    async createUser({ user }) {
      if (!user.email) return;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          provider: "google",
          ...(isAdminEmail(user.email) ? { role: "ADMIN" } : {}),
        },
      });
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
