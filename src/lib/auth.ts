import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

export const authOptions: AuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // 8 ساعات - §38 Session security
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "البريد الإلكتروني", type: "email" },
        password: { label: "كلمة المرور", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        if (!user || !user.isActive) {
          await writeAuditLog({
            userId: null,
            action: "LOGIN_FAILED",
            entity: "User",
            entityId: null,
            reason: `محاولة دخول فاشلة: ${credentials.email}`,
          });
          return null;
        }

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) {
          await writeAuditLog({
            userId: user.id,
            action: "LOGIN_FAILED",
            entity: "User",
            entityId: user.id,
          });
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        await writeAuditLog({ userId: user.id, action: "LOGIN_SUCCESS", entity: "User", entityId: user.id });

        return {
          id: user.id,
          name: user.fullName,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: "SUPER_ADMIN" | "EVALUATOR" }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "SUPER_ADMIN" | "EVALUATOR";
      }
      return session;
    },
  },
};
