import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

type AuthToken = {
  sub?: string;
  email?: string | null;
  userId?: string;
};

const providers = [];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        url: "https://accounts.google.com/o/oauth2/v2/auth",
        params: {
          scope: "openid email profile",
          prompt: "select_account",
        },
      },
      token: "https://oauth2.googleapis.com/token",
      userinfo: "https://openidconnect.googleapis.com/v1/userinfo",
      issuer: "https://accounts.google.com",
    }),
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers,
  pages: {
    signIn: "/auth",
  },
  session: {
    strategy: "jwt",
  },
  trustHost: true,
  callbacks: {
    async jwt({ token, user }) {
      const authToken = token as typeof token & AuthToken;

      if (user?.id) {
        authToken.userId = user.id;
      }

      if (!authToken.userId && authToken.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: authToken.email },
          select: { id: true },
        });

        if (dbUser?.id) {
          authToken.userId = dbUser.id;
        }
      }

      if (!authToken.sub && authToken.userId) {
        authToken.sub = String(authToken.userId);
      }

      return authToken;
    },
    async session({ session, user, token }) {
      const authToken = token as typeof token & AuthToken;

      if (session.user) {
        session.user.id = authToken.userId ?? user?.id ?? (authToken.sub as string);
      }

      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
