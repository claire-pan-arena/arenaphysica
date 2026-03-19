import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getDb } from "@/lib/db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    async signIn({ profile }) {
      return profile?.email?.endsWith("@arena-ai.com") ?? false;
    },
    async jwt({ token, account }) {
      // Initial sign-in — store tokens
      if (account) {
        console.log("[auth] Initial sign-in, refresh_token present:", !!account.refresh_token);
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at ? account.expires_at * 1000 : Date.now() + 3600 * 1000;

        // Persist refresh token to DB for team calendar
        if (account.refresh_token && token.email) {
          try {
            const sql = getDb();
            await sql`
              INSERT INTO team_members (email, name, refresh_token, updated_at)
              VALUES (${token.email as string}, ${(token.name as string) || ''}, ${account.refresh_token}, NOW())
              ON CONFLICT (email) DO UPDATE SET
                name = EXCLUDED.name,
                refresh_token = EXCLUDED.refresh_token,
                updated_at = NOW()
            `;
          } catch (err) {
            console.error("[auth] Failed to persist refresh token:", err);
          }
        }
        return token;
      }

      // Return token if it hasn't expired yet (refresh 5 min early to avoid edge cases)
      const bufferMs = 5 * 60 * 1000;
      if (Date.now() < (token.expiresAt as number) - bufferMs) {
        return token;
      }

      // No refresh token — can't refresh
      if (!token.refreshToken) {
        console.error("[auth] No refresh token available — user must re-sign-in");
        token.error = "RefreshTokenError";
        return token;
      }

      // Token expired (or about to) — refresh it
      console.log("[auth] Access token expired, refreshing...");
      try {
        const res = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            grant_type: "refresh_token",
            refresh_token: token.refreshToken as string,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          console.error("[auth] Token refresh failed:", data.error, data.error_description);
          token.error = "RefreshTokenError";
          return token;
        }

        console.log("[auth] Token refreshed successfully, expires_in:", data.expires_in);
        token.accessToken = data.access_token;
        token.expiresAt = Date.now() + data.expires_in * 1000;
        // Google may rotate the refresh token
        if (data.refresh_token) {
          token.refreshToken = data.refresh_token;
          // Update DB with rotated token
          if (token.email) {
            try {
              const sql = getDb();
              await sql`UPDATE team_members SET refresh_token = ${data.refresh_token}, updated_at = NOW() WHERE email = ${token.email as string}`;
            } catch {}
          }
        }
        // Clear any previous error
        delete token.error;
        return token;
      } catch (err) {
        console.error("[auth] Token refresh exception:", err);
        token.error = "RefreshTokenError";
        return token;
      }
    },
    async session({ session, token }) {
      (session as any).accessToken = token.accessToken;
      (session as any).error = token.error;
      return session;
    },
  },
});
