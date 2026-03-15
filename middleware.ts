import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // Let the root page handle its own auth (shows login inline)
  if (request.nextUrl.pathname === "/") {
    return NextResponse.next();
  }

  // Try both v5 (authjs) and v4 (next-auth) cookie names
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    cookieName: request.cookies.has("authjs.session-token")
      ? "authjs.session-token"
      : request.cookies.has("__Secure-authjs.session-token")
        ? "__Secure-authjs.session-token"
        : "next-auth.session-token",
  });

  if (!token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|api/tools|api/kb|api/notes|api/templates|api/reports|signin|_next/static|_next/image|favicon.ico|icon.svg|logo.svg).*)"],
};
