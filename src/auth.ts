import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { getDb, isGoogleConfigured } from "@/server/db";
import { clientIp } from "@/server/http";
import { verifyAgainstDummy, verifyPassword } from "@/server/password";
import { withinRateLimit } from "@/server/rate-limit";
import { accounts, users } from "@/server/schema";

const WINDOW_MS = 15 * 60 * 1000;

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().max(254),
  password: z.string().min(1).max(128),
});

// Configuration is built per request, so a missing DATABASE_URL/AUTH_SECRET never breaks the build or the
// local-only mode of the app.
export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const db = getDb();
  return {
    adapter: db ? DrizzleAdapter(db, { usersTable: users, accountsTable: accounts }) : undefined,
    session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
    trustHost:
      process.env.NODE_ENV !== "production" ||
      process.env.VERCEL === "1" ||
      process.env.AUTH_TRUST_HOST === "true",
    pages: { signIn: "/app", error: "/app" },
    providers: [
      ...(isGoogleConfigured() ? [Google] : []),
      Credentials({
        credentials: { email: {}, password: {} },
        async authorize(credentials, request) {
          if (!db) return null;
          const parsed = credentialsSchema.safeParse(credentials);
          if (!parsed.success) return null;
          const { email, password } = parsed.data;

          const ip = clientIp(request.headers);
          const allowed =
            (await withinRateLimit(db, `login:ip:${ip}`, 30, WINDOW_MS)) &&
            (await withinRateLimit(db, `login:email:${email}`, 10, WINDOW_MS));
          if (!allowed) return null;

          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1)
            .catch((error: unknown) => {
              console.error(
                "sign-in lookup failed:",
                error instanceof Error ? error.message : "unknown error",
              );
              throw error;
            });
          if (!user?.passwordHash) {
            await verifyAgainstDummy(password);
            return null;
          }
          if (!(await verifyPassword(password, user.passwordHash))) return null;
          return { id: user.id, email: user.email, name: user.name };
        },
      }),
    ],
    callbacks: {
      jwt({ token, user }) {
        if (user?.id) token.id = user.id;
        return token;
      },
      session({ session, token }) {
        if (session.user && typeof token.id === "string") session.user.id = token.id;
        else if (session.user && token.sub) session.user.id = token.sub;
        return session;
      },
    },
  };
});
