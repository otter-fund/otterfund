import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
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
  const session = await auth();
  if (!session) redirect("/login");
  if (!session.user.onboardingDone) redirect("/onboarding");
  return session.user;
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
 * The user's display prefs (brand accent + currency) in ONE row read, memoized
 * per request so the layout (accent) and pages (currency) share a single query.
 */
export const userPrefs = cache(async (userId: string) => {
  const u = await prisma.user
    .findUnique({ where: { id: userId }, select: { accent: true, currency: true } })
    .catch(() => null);
  return { accent: u?.accent ?? null, currency: u?.currency ?? "CAD" };
});

/** Convenience: the user's currency, reusing the cached userPrefs row read. */
export const userCurrency = async (userId: string) => (await userPrefs(userId)).currency;
