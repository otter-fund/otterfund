import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  MAINTENANCE_COOKIE,
  isMaintenanceMode,
  maintenanceToken,
  safeEqual,
} from "@/lib/maintenance";

// Next 16 middleware (Proxy). Auth gate + refreshes the Supabase session cookie
// on every request. Onboarding gating is NOT done here — it needs the profile
// row (onboardingDone), which requires Prisma and can't run in the Edge runtime.
// The server page guards (lib/dashboard-context requireUser + onboarding/page)
// enforce onboarding instead. Do not delete this file — it is auto-discovered.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Maintenance gate — takes precedence over everything, including auth and the
  // API. When MAINTENANCE_MODE=true the whole site is served the /maintenance
  // page unless this browser carries a valid bypass cookie (set after a dev
  // enters the admin password). The maintenance page and its unlock endpoint
  // stay reachable so devs can get in; static assets bypass via config.matcher.
  if (isMaintenanceMode()) {
    const isGateRoute =
      pathname === "/maintenance" || pathname === "/api/maintenance/unlock";
    // Serve the gate page/endpoint directly — no auth, no Supabase call (the
    // whole point of the gate is to work with the DB down/unreachable).
    if (isGateRoute) {
      return NextResponse.next();
    }
    const token = request.cookies.get(MAINTENANCE_COOKIE)?.value ?? "";
    const expected = await maintenanceToken();
    const unlocked = !!expected && safeEqual(token, expected);
    if (!unlocked) {
      // API callers (Plaid webhook, GraphQL, uptime monitors) must get a real
      // 503 — a rewrite to the HTML page returns 200, which they read as
      // success and never retry, silently dropping events.
      if (pathname.startsWith("/api")) {
        return NextResponse.json(
          { error: "Service temporarily unavailable for maintenance." },
          { status: 503 },
        );
      }
      return NextResponse.rewrite(new URL("/maintenance", request.url));
    }
    // Unlocked → fall through to the normal auth/session flow below.
  }

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

  // Public marketing pages — crawlable, no auth. The landing page does its own
  // logged-in redirect (to dashboard/onboarding); pricing is open to everyone.
  // Keep this list in sync with the sitemap (app/sitemap.ts).
  if (
    pathname === "/" ||
    pathname === "/pricing" ||
    pathname === "/privacy" ||
    pathname === "/terms"
  ) {
    return response;
  }

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
  // Public, crawlable metadata assets must bypass auth, or signed-out visitors
  // (and search-engine / social crawlers) get a /login redirect instead of the
  // real asset — which breaks favicons, share previews, and the manifest.
  // Covers: favicon.ico / icon.svg / icon.png / apple-icon (favicons),
  // opengraph-image + twitter-image (social cards), manifest.webmanifest,
  // robots.txt, sitemap.xml. (No "public" token: files in public/ are served
  // at the site root, not under /public/*, so such a token would match nothing.
  // Any root-served public/ asset needed unauthenticated must be named here.)
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|icon.png|apple-icon|opengraph-image|twitter-image|manifest.webmanifest|robots.txt|sitemap.xml).*)",
  ],
};
