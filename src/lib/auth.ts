import type { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { googleEnabled, isAdminEmail } from "@/lib/env";
import { verifyCode } from "@/lib/otp";

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
    // Email + one-time code. Password is verified earlier (in /api/auth/*/start,
    // which then emails the OTP); this step completes the session only when a
    // valid, unexpired code is presented — giving us 2FA login and verified
    // signup. `flow` selects whether we are completing a signup or a login.
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" },
        flow: { label: "Flow", type: "text" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const code = credentials?.code?.trim();
        const flow = credentials?.flow === "signup" ? "signup" : "login";
        if (!email || !code) return null;

        const result = await verifyCode(email, flow, code);
        if (!result.ok) return null;

        if (flow === "signup") {
          // Complete the pending signup stored with the code (name + hash).
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
          } as any;
        }

        // login flow — the code was only issued after a correct password.
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = (user as any).id;
        token.role = (user as any).role ?? "USER";
      }
      // Keep role fresh from DB on each refresh when possible
      if (token.email && !token.role) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
          select: { id: true, role: true },
        });
        if (dbUser) {
          token.uid = dbUser.id;
          token.role = dbUser.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.uid;
        (session.user as any).role = token.role ?? "USER";
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
