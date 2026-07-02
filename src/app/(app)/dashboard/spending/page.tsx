import { requireUser, currentPeriod, resolvePeriod } from "@/lib/dashboard-context";
import { getSpendingPlan } from "@/lib/db/queries";
import { getBudgetPlan } from "@/lib/constants";
import { SpendingView } from "@/components/bulga/pages/spending-view";
import type { SpendingPlanView } from "@/lib/types";

// Fallback when the query fails — the default plan with zeroed figures, so the
// page still renders its structure rather than erroring.
function emptyPlan(): SpendingPlanView {
  const plan = getBudgetPlan(null);
  return {
    planId: plan.id,
    planName: plan.name,
    monthlyIncome: 0,
    currency: "CAD",
    totalSpent: 0,
    buckets: [
      { key: "needs", label: "Needs", targetPct: plan.needs, targetAmount: 0, actualAmount: 0, categories: [] },
      { key: "wants", label: "Wants", targetPct: plan.wants, targetAmount: 0, actualAmount: 0, categories: [] },
      { key: "savings", label: "Savings", targetPct: plan.savings, targetAmount: 0, actualAmount: 0, categories: [] },
    ],
  };
}

export default async function SpendingPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const user = await requireUser();
  const { month, year } = resolvePeriod(await searchParams, currentPeriod());
  const plan = await getSpendingPlan(user.id, month, year).catch(() => emptyPlan());
  return <SpendingView plan={plan} />;
}
