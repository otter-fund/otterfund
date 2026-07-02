import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** The minimal identity the proxy needs — id is enough for its redirect gate. */
type SessionUser = { id: string };

/**
 * Refreshes the Supabase auth session on every request and surfaces the current
 * user for the proxy's redirect logic. Returns the response carrying refreshed
 * auth cookies — the caller must return this response (or copy its cookies onto
 * any redirect it issues) or the session won't persist.
 */
export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: SessionUser | null }> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      // Pin cookie attributes (Secure in prod, SameSite=Lax) — @supabase/ssr
      // never sets Secure on its own.
      cookieOptions: {
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getClaims() verifies the JWT signature LOCALLY (this project uses asymmetric
  // ES256 keys) via WebCrypto against a cached JWKS — no per-request network hop
  // to the Auth server, unlike getUser(). It still refreshes an expiring session
  // first, so cookies stay fresh. Do NOT swap for getSession() (no verification).
  const { data } = await supabase.auth.getClaims();

  return { response, user: data?.claims ? { id: data.claims.sub } : null };
}
