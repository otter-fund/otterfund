import { BulgaChrome } from "@/components/bulga/bulga-chrome";
import {
  requireUser,
  currentPeriod,
  dashboardOverview,
  monthlyTxCount,
  userPrefs,
} from "@/lib/dashboard-context";
import { DEFAULT_BUDGET_PLAN_ID } from "@/lib/constants";

// Persistent dashboard shell. A Next layout does NOT remount when navigating
// between its child routes, so the chrome (rail, topbar, modals, accent state)
// lives here and survives navigation. This server component runs the auth +
// onboarding guard and fetches only the data the chrome itself needs — each
// routed page fetches its own body data.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // The chrome's notice + money fields are about the CURRENT month regardless
  // of which period the picker is browsing, so the layout always fetches today.
  // Per-period body data is fetched by each page from its own searchParams.
  const { month: todayMonth, year: todayYear } = currentPeriod();

  const [overview, txThisMonth, prefs] = await Promise.all([
    dashboardOverview(user.id, todayMonth, todayYear).catch(() => null),
    monthlyTxCount(user.id, todayMonth, todayYear).catch(() => 0),
    userPrefs(user.id),
  ]);

  return (
    <BulgaChrome
      initialAccent={prefs.accent}
      todayMonth={todayMonth}
      todayYear={todayYear}
      txThisMonth={txThisMonth}
      user={{
        name: user.name ?? "",
        email: user.email ?? "",
        monthlyIncome: overview?.monthlyIncome ?? 0,
        currency: overview?.currency ?? "CAD",
        budgetTarget: overview?.budgetTarget ?? 0,
        budgetPlan: prefs.budgetPlan ?? DEFAULT_BUDGET_PLAN_ID,
      }}
      notice={{
        budgetTarget: overview?.budgetTarget ?? 0,
        monthlySpend: overview?.monthlySpend ?? 0,
        spendingByCategory: overview?.spendingByCategory ?? [],
        upcomingBills: overview?.upcomingBills ?? [],
      }}
    >
      {children}
    </BulgaChrome>
  );
}
