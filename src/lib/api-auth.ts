import { createClient } from "@/lib/supabase/server";

/**
 * Current authenticated user id from the Supabase session cookie, or null.
 * The `request` arg is accepted for call-site compatibility with the existing
 * REST routes but is no longer used — the session lives in cookies, read via
 * next/headers inside createClient().
 */
export async function getApiUser(
  _request?: Request,
): Promise<{ id: string } | null> {
  const supabase = await createClient();
  // getClaims() verifies the JWT locally (asymmetric ES256 keys) against a
  // cached JWKS — no per-request network hop, unlike getUser().
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return null;
  return { id: data.claims.sub };
}
