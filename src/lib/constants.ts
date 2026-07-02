// Shared domain constants. Single source of truth so add/edit forms,
// onboarding, and settings can't drift apart.

export const ACCOUNT_TYPES = [
  "Chequing",
  "Savings",
  "TFSA",
  "RRSP",
  "FHSA",
  "Credit Card",
  "Investment",
  "Other",
] as const;

export const CURRENCIES = ["CAD", "USD", "EUR", "GBP"] as const;

/** Billing cadences a subscription can have. */
export const SUBSCRIPTION_CYCLES = ["Monthly", "Annual"] as const;

// ── Budget plans ──────────────────────────────────────────────────────────
// A budget plan splits monthly income into three buckets — Needs, Wants, and
// Savings — as percentages that total 100. The user picks one during onboarding
// (and can change it in Settings). The Spending page reports actual utilization
// against these targets; onboarding/settings derive per-category budgets from
// them (see lib/db/seed-categories budgetAmountsForPlan). Client-safe.

export type BucketKey = "needs" | "wants" | "savings";

export interface BudgetPlan {
  id: string;
  name: string;
  /** Percent of monthly income (0–100). needs + wants + savings === 100. */
  needs: number;
  wants: number;
  savings: number;
  blurb: string;
  recommended?: boolean;
}

export const BUDGET_PLANS: BudgetPlan[] = [
  {
    id: "50-30-20",
    name: "50/30/20 Rule",
    needs: 50,
    wants: 30,
    savings: 20,
    blurb: "The classic balance — half to essentials, a third to lifestyle, a fifth to savings.",
    recommended: true,
  },
  {
    id: "70-20-10",
    name: "70/20/10",
    needs: 70,
    wants: 20,
    savings: 10,
    blurb: "Room for high fixed costs like rent — save a little each month.",
  },
  {
    id: "60-20-20",
    name: "60/20/20",
    needs: 60,
    wants: 20,
    savings: 20,
    blurb: "A steady saver with a modest budget for the fun stuff.",
  },
  {
    id: "50-20-30",
    name: "Aggressive Saver",
    needs: 50,
    wants: 20,
    savings: 30,
    blurb: "Tighten wants and push nearly a third of income into savings.",
  },
];

export const DEFAULT_BUDGET_PLAN_ID = "50-30-20";

/** Resolve a plan by id, falling back to the recommended default when unknown/null. */
export function getBudgetPlan(id?: string | null): BudgetPlan {
  return BUDGET_PLANS.find((p) => p.id === id) ?? BUDGET_PLANS[0];
}

/**
 * Which spending bucket each default category belongs to. "Income" is excluded
 * by callers (it isn't spending); "Savings" is virtual (income − spend), never a
 * category. Unknown/custom categories default to "wants" so their spend is still
 * counted — this keeps needs + wants === total spend.
 */
export const CATEGORY_BUCKETS: Record<string, "needs" | "wants"> = {
  Housing: "needs",
  Groceries: "needs",
  Transport: "needs",
  Bills: "needs",
  Health: "needs",
  "Dining Out": "wants",
  Subscriptions: "wants",
  Entertainment: "wants",
  Other: "wants",
};

/** Bucket for a spending category. Excludes Income (returns null). */
export function bucketOf(categoryName: string): "needs" | "wants" | null {
  if (categoryName === "Income") return null;
  return CATEGORY_BUCKETS[categoryName] ?? "wants";
}

/** Full month names (1-indexed by `MONTH_NAMES[month - 1]`). */
export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;
