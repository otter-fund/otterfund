import { timingSafeEqual } from "node:crypto";
import type { YogaInitialContext } from "graphql-yoga";
import { createClient } from "@/lib/supabase/server";

/** Length-safe constant-time string compare (avoids early-exit timing leaks). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Per-request GraphQL context. `userId` is the Supabase auth user id (which, under
 * the profile-table pattern, equals User.id). Every user-scoped resolver derives
 * its userId from here via requireUser(). `isCron` lets machine callers (the Plaid
 * sync job) invoke cron-only mutations with a shared secret instead of a session.
 */
export interface GraphQLContext {
  userId: string | null;
  isCron: boolean;
  request: Request;
}

export async function createContext(
  initial: YogaInitialContext,
): Promise<GraphQLContext> {
  const { request } = initial;

  const cronSecret = process.env.CRON_SECRET;
  const header = request.headers.get("x-cron-secret");
  const isCron = !!cronSecret && !!header && safeEqual(header, cronSecret);

  let userId: string | null = null;
  if (!isCron) {
    const supabase = await createClient();
    // getClaims() verifies the JWT locally (asymmetric ES256 keys) against a
    // cached JWKS — no per-request network hop, unlike getUser(). Runs on every
    // GraphQL request, so this is the hottest of the auth reads.
    const { data } = await supabase.auth.getClaims();
    userId = data?.claims?.sub ?? null;
  }

  return { userId, isCron, request };
}
