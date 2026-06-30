import { requireUser, currentPeriod, resolvePeriod, dashboardOverview } from "@/lib/dashboard-context";
import { OverviewView } from "@/components/bulga/pages/overview-view";

const EMPTY_OVERVIEW = {
  netWorth: 0, netWorthChange: 0, monthlyIncome: 0, monthlySpend: 0, monthlySurplus: 0,
  budgetTarget: 0, savingsRate: 0, savedAmount: 0, currency: "CAD",
  spendingByCategory: [], upcomingBills: [],
  incomeVsExpense: { months: [], income: [], expenses: [] },
  netWorthTrend: [], goals: [], recentTransactions: [],
};

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const user = await requireUser();
  const { month, year } = resolvePeriod(await searchParams, currentPeriod());
  const overview = await dashboardOverview(user.id, month, year).catch(() => null);
  return <OverviewView overview={overview ?? EMPTY_OVERVIEW} />;
}
