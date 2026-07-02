export const DEFAULT_CATEGORIES = [
  { name: "Housing", icon: "home", color: "oklch(60% 0.09 155)" },
  { name: "Groceries", icon: "shopping-cart", color: "oklch(50% 0.07 245)" },
  { name: "Dining Out", icon: "coffee", color: "oklch(63% 0.1 38)" },
  { name: "Transport", icon: "fuel", color: "oklch(58% 0.09 290)" },
  { name: "Subscriptions", icon: "tv", color: "oklch(62% 0.09 210)" },
  { name: "Entertainment", icon: "music", color: "oklch(65% 0.08 60)" },
  { name: "Health", icon: "pill", color: "oklch(58% 0.08 330)" },
  { name: "Bills", icon: "smartphone", color: "oklch(55% 0.07 200)" },
  { name: "Income", icon: "briefcase", color: "oklch(60% 0.09 155)" },
  { name: "Other", icon: "circle", color: "oklch(68% 0.04 80)" },
] as const;

export const DEFAULT_BUDGET_SPLITS: Record<string, number> = {
  Housing: 0.35,
  Groceries: 0.12,
  "Dining Out": 0.08,
  Transport: 0.06,
  Subscriptions: 0.04,
  Entertainment: 0.05,
  Health: 0.03,
  Bills: 0.12,
  Other: 0.05,
};

import { CATEGORY_BUCKETS, type BudgetPlan } from "@/lib/constants";

/**
 * Per-category budget amounts (in dollars) for a given plan + monthly income.
 *
 * The plan defines the bucket targets (needs/wants % of income). Within each
 * bucket, the target dollars are distributed across that bucket's categories in
 * proportion to their DEFAULT_BUDGET_SPLITS weight (renormalized within the
 * bucket) — so the per-category budgets always sum to the plan's bucket targets.
 * Returns a `{ categoryName: amount }` map covering only the default categories.
 */
export function budgetAmountsForPlan(
  plan: BudgetPlan,
  monthlyIncome: number
): Record<string, number> {
  const bucketTarget: Record<"needs" | "wants", number> = {
    needs: (monthlyIncome * plan.needs) / 100,
    wants: (monthlyIncome * plan.wants) / 100,
  };

  const weightSum: Record<"needs" | "wants", number> = { needs: 0, wants: 0 };
  for (const [name, weight] of Object.entries(DEFAULT_BUDGET_SPLITS)) {
    const bucket = CATEGORY_BUCKETS[name];
    if (bucket) weightSum[bucket] += weight;
  }

  const amounts: Record<string, number> = {};
  for (const [name, weight] of Object.entries(DEFAULT_BUDGET_SPLITS)) {
    const bucket = CATEGORY_BUCKETS[name];
    if (!bucket) continue;
    const share = weightSum[bucket] > 0 ? weight / weightSum[bucket] : 0;
    amounts[name] = Math.round(bucketTarget[bucket] * share);
  }
  return amounts;
}
