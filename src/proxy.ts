import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

// Optimistic redirect only — the cookie's presence is checked, not its
// validity ("THIS IS NOT SECURE", per the better-auth docs). Every page,
// server action and route handler re-validates the session server-side; this
// just avoids flashing protected UI at anonymous visitors.
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const signIn = new URL("/sign-in", request.url);
  return NextResponse.redirect(signIn);
}

export const config = {
  // Everything except the public endpoints (auth flow, health probe), the
  // auth pages themselves, and static assets.
  matcher: [
    "/((?!api/auth|api/health|sign-in|sign-up|forgot-password|reset-password|_next/static|_next/image|favicon.ico).*)",
  ],
};
