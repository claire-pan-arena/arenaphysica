import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  // Let the root page handle its own auth (shows login inline)
  if (req.nextUrl.pathname === "/") {
    return NextResponse.next();
  }

  // Not authenticated — redirect to home
  if (!req.auth) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|api/tools|api/kb|api/notes|api/templates|api/reports|api/travel-preferences|api/ai|signin|_next/static|_next/image|favicon.ico|icon.svg|logo.svg).*)"],
};
