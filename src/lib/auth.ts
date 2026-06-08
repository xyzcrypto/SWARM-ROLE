import type { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const googleEnabled =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

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
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });
        if (!user || !user.passwordHash) return null;
        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;
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
        // Initial sign-in: seed token from the authenticated user object
        token.uid = (user as any).id;
        token.role = (user as any).role ?? "USER";
        token.isMember = (user as any).isMember ?? false;
        token.refreshedAt = Date.now();
      }
      // Re-read role + membership from DB every 5 minutes so permission
      // changes (e.g. admin toggle) propagate without waiting for JWT expiry.
      const FIVE_MIN = 5 * 60 * 1000;
      if (token.uid && Date.now() - (token.refreshedAt ?? 0) > FIVE_MIN) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.uid },
          select: { role: true, isMember: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.isMember = dbUser.isMember;
          token.refreshedAt = Date.now();
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.uid;
        (session.user as any).role = token.role ?? "USER";
        (session.user as any).isMember = token.isMember ?? false;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (user.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      }
    },
    // Promote the configured admin email & tag the provider for OAuth users.
    async createUser({ user }) {
      const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
      if (user.email && adminEmail && user.email.toLowerCase() === adminEmail) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: "ADMIN", provider: "google" },
        });
      } else if (user.email) {
        await prisma.user.update({
          where: { id: user.id },
          data: { provider: "google" },
        });
      }
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
