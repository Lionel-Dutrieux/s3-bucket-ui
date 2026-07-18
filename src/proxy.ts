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
  // Everything except the public endpoints (auth flow, health probe, public
  // share links), the auth pages themselves, and static assets.
  // `two-factor` MUST stay excluded: during a 2FA challenge better-auth has
  // already deleted the session cookie (only a short-lived 2FA cookie exists),
  // so the optimistic session-cookie check below would bounce the challenge
  // page straight back to /sign-in and the code prompt would never show.
  // The upload route MUST stay excluded too: routing a request through the
  // proxy makes Next.js buffer its body in memory, silently truncated at
  // proxyClientMaxBodySize (10 MB) — uploads above that were corrupted without
  // any error. The route enforces auth itself (requireSourceAccess + canEdit).
  // The public drop link surfaces (deposit page `d/` and its upload route
  // `api/d/`) MUST stay excluded: they have no session, and the upload route —
  // like the authenticated one — must not be routed through the proxy, which
  // buffers and truncates bodies over proxyClientMaxBodySize (10 MB). Both
  // enforce their own authorization from the token.
  matcher: [
    "/((?!api/auth|api/health|api/s/|s/|api/d/|d/|api/sources/[^/]+/upload|sign-in|sign-up|two-factor|forgot-password|reset-password|_next/static|_next/image|favicon.ico).*)",
  ],
};
