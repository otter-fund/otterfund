import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { getUserRow } from "@/lib/db/user";
import { getDashboardOverview } from "@/lib/db/queries";

// Period resolution + bounds live in the client-safe lib/period so the chrome,
// picker, and server pages share ONE definition. Re-exported here so pages keep
// importing it alongside the other dashboard helpers.
export { resolvePeriod } from "@/lib/period";

// Request-scoped helpers shared by the dashboard layout and its routed pages.
// Each is wrapped in React's cache() so that calling it from both the layout
// and a page within the SAME request hits the DB / session once, not twice —
// the canonical App Router de-dup pattern. (cache() is per-request, so two
// users never share a result.)

/** Auth + onboarding guard. Returns the signed-in user; redirects otherwise. */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  // getClaims() verifies the JWT locally (asymmetric ES256 keys) against a
  // cached JWKS — no network round-trip to the Auth server per request, unlike
  // getUser(). The proxy already validated this same request; this second read
  // is just to resolve the id for the profile lookup, so keep it local + cheap.
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  // Profile row (id === Supabase auth uuid) carries name + onboarding state.
  // Shares the per-request getUserRow read with prefs and the page queries.
  const profile = await getUserRow(data.claims.sub);
  if (!profile) redirect("/login");
  if (!profile.onboardingDone) redirect("/onboarding");
  return profile;
});

/** Today's real calendar month/year — computed once per request. */
export const currentPeriod = cache(() => {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
});

/**
 * The dashboard overview, memoized per request. The layout reads it for the
 * topbar notice + the user's money fields, and the Overview page reads it for
 * the page body — this de-dups those two reads into one DB round-trip.
 */
export const dashboardOverview = cache((userId: string, month: number, year: number) =>
  getDashboardOverview(userId, month, year)
);

/** Count of the user's transactions in the given month (for the topbar). */
export const monthlyTxCount = cache((userId: string, month: number, year: number) =>
  prisma.transaction.count({
    where: { userId, date: { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) } },
  })
);

/**
 * The user's display prefs (brand accent + currency), served from the shared
 * per-request getUserRow read — no extra query.
 */
export const userPrefs = async (userId: string) => {
  const u = await getUserRow(userId).catch(() => null);
  return {
    accent: u?.accent ?? null,
    currency: u?.currency ?? "CAD",
    budgetPlan: u?.budgetPlan ?? null,
  };
};

/** Convenience: the user's currency, reusing the cached userPrefs row read. */
export const userCurrency = async (userId: string) => (await userPrefs(userId)).currency;
