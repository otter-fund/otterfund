import { requireUser, currentPeriod } from "@/lib/dashboard-context";
import { getGoalsPlan } from "@/lib/db/queries";
import { getBudgetPlan } from "@/lib/constants";
import { GoalsView } from "@/components/bulga/pages/goals-view";
import type { GoalsPlanView } from "@/lib/types";

// Fallback keeps the page's structure rendering if the query fails.
function emptyPlan(): GoalsPlanView {
  const plan = getBudgetPlan(null);
  return {
    currency: "CAD",
    monthlyIncome: 0,
    monthlySavings: 0,
    monthlySpent: 0,
    surplus: 0,
    savingsPct: plan.savings,
    planId: plan.id,
    planName: plan.name,
    totalSaved: 0,
    totalTarget: 0,
    allocated: 0,
    unallocated: 0,
    goals: [],
  };
}

export default async function GoalsPage() {
  const user = await requireUser();
  const { month, year } = currentPeriod();
  const plan = await getGoalsPlan(user.id, month, year).catch(() => emptyPlan());
  return <GoalsView plan={plan} />;
}
