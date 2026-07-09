import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next 16 middleware (Proxy). Auth gate + refreshes the Supabase session cookie
// on every request. Onboarding gating is NOT done here — it needs the profile
// row (onboardingDone), which requires Prisma and can't run in the Edge runtime.
// The server page guards (lib/dashboard-context requireUser + onboarding/page)
// enforce onboarding instead. Do not delete this file — it is auto-discovered.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Refresh the session; `response` carries the refreshed auth cookies.
  const { response, user } = await updateSession(request);

  // All API routes and the Supabase auth callback bypass redirect logic. API
  // routes handle their own auth (GraphQL via context, the Plaid webhook via
  // signature); /auth/callback must run unauthenticated to establish the session.
  if (pathname.startsWith("/api") || pathname.startsWith("/auth/")) {
    return response;
  }

  const isLoggedIn = !!user;
  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    // Request-a-reset screen — reached while logged OUT (you forgot your
    // password), so it must be public. NOT /reset-password: that one stays
    // protected so the recovery session from /auth/callback is what grants
    // access (and a signed-out visitor is bounced to /login).
    pathname.startsWith("/forgot-password") ||
    // Post-sign-up "check your email" screen — reachable before a session
    // exists (email confirmation pending); signed-in users get bounced on.
    pathname.startsWith("/verify-email");

  // Landing page is public; it does its own logged-in redirect.
  if (pathname === "/") return response;

  // Signed-in users shouldn't sit on the auth pages.
  if (isAuthPage) {
    return isLoggedIn
      ? redirectKeepingCookies(request, response, "/dashboard")
      : response;
  }

  // Everything else is protected.
  if (!isLoggedIn) {
    return redirectKeepingCookies(request, response, "/login");
  }

  return response;
}

// A redirect must carry the refreshed auth cookies from updateSession, or the
// session won't persist across the redirect.
function redirectKeepingCookies(
  request: NextRequest,
  from: NextResponse,
  path: string,
) {
  const redirect = NextResponse.redirect(new URL(path, request.url));
  for (const cookie of from.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

export const config = {
  // icon.svg (the app-router favicon) must bypass auth, or signed-out browsers
  // get a /login redirect instead of the icon and silently keep a stale one.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon|robots.txt|sitemap.xml|public).*)"],
};
