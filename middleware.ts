import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";

const SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";

function getCookieName(req: NextRequest) {
  if (req.cookies.has("__Secure-authjs.session-token")) return "__Secure-authjs.session-token";
  if (req.cookies.has("authjs.session-token")) return "authjs.session-token";
  return "next-auth.session-token";
}

export async function middleware(request: NextRequest) {
  // Let the root page handle its own auth
  if (request.nextUrl.pathname === "/") {
    return NextResponse.next();
  }

  const cookieName = getCookieName(request);
  const token = await getToken({ req: request, secret: SECRET, cookieName });

  if (!token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Check if access token needs refresh (5 min buffer)
  const bufferMs = 5 * 60 * 1000;
  const expiresAt = token.expiresAt as number | undefined;
  if (expiresAt && Date.now() > expiresAt - bufferMs && token.refreshToken) {
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

      if (res.ok) {
        token.accessToken = data.access_token;
        token.expiresAt = Date.now() + data.expires_in * 1000;
        if (data.refresh_token) {
          token.refreshToken = data.refresh_token;
        }
        delete token.error;

        // Write refreshed token back to cookie
        const newToken = await encode({ token, secret: SECRET, salt: cookieName });
        const response = NextResponse.next();
        const isSecure = cookieName.startsWith("__Secure-");
        response.cookies.set(cookieName, newToken, {
          httpOnly: true,
          secure: isSecure || process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        });
        return response;
      }
    } catch {
      // Refresh failed — continue with existing token
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|api/tools|api/kb|api/notes|api/templates|api/reports|api/travel-preferences|api/ai|signin|_next/static|_next/image|favicon.ico|icon.svg|logo.svg).*)"],
};
