export interface TransactionView {
  id: string;
  name: string;
  category: string;
  date: string;
  amount: number;
  icon: string;
  color: string;
  /** Owning account — null for transactions with no account (rare/manual). */
  accountId: string | null;
  accountName: string | null;
}

export interface SpendCategory {
  categoryId: string;
  name: string;
  amount: number;
  budget: number;
  pct: number;
  color: string;
  subscriptionCommitted: number;
}

/** One category's slice within a spending bucket (Needs / Wants). */
export interface SpendingCategorySlice {
  categoryId: string;
  name: string;
  amount: number;
  color: string;
  /** This category's share of its bucket's actual spend (0–100, rounded). */
  pctOfBucket: number;
}

/**
 * A single budget-plan bucket for the Spending page: its plan target (percent of
 * income + dollar amount) alongside this month's actual. Needs/Wants carry the
 * categories that rolled into them; Savings is virtual (income − total spend) so
 * it has no categories.
 */
export interface SpendingBucket {
  key: "needs" | "wants" | "savings";
  label: string;
  targetPct: number;
  targetAmount: number;
  actualAmount: number;
  categories: SpendingCategorySlice[];
}

/** The Spending page's whole view-model: the active plan, income, and buckets. */
export interface SpendingPlanView {
  planId: string;
  planName: string;
  monthlyIncome: number;
  currency: string;
  totalSpent: number;
  /** Ordered [Needs, Wants, Savings]. */
  buckets: SpendingBucket[];
}

export interface GoalView {
  id: string;
  name: string;
  emoji: string;
  saved: number;
  target: number;
  priority: number;
  color: string;
  deadline: string;
  deadlineISO?: string;
}

/**
 * A goal enriched with its place in the monthly savings plan. `share`,
 * `monthlyContribution`, and the ETA fields are derived server-side from the
 * user's budget-plan savings pool split across all under-funded goals by
 * priority — see `getGoalsPlan`.
 */
export interface GoalPlanItem extends GoalView {
  /** Whole percent complete (saved / target), 0 when target is 0. */
  pct: number;
  /** Amount still needed to reach target (never negative). */
  remaining: number;
  /** True once saved >= target. */
  done: boolean;
  /** Dollars/month this goal draws from the savings pool this month. */
  monthlyContribution: number;
  /** This goal's share of the savings pool (0–100). Shares total 100 when the pool is fully allocated. */
  share: number;
  /** Months to finish at the current contribution; null when unfunded or done. */
  etaMonths: number | null;
  /** Pre-formatted projected completion (e.g. "March 2027"); null when unfunded or done. */
  etaLabel: string | null;
  /**
   * Deadline pacing: true = projected to finish on/before deadline, false =
   * behind (or unfunded with a deadline), null = no deadline (or already done).
   */
  onTrack: boolean | null;
}

/**
 * The Goals page view-model: the monthly savings pool derived from the user's
 * budget plan, and every goal enriched with its funded share of that pool.
 */
export interface GoalsPlanView {
  currency: string;
  monthlyIncome: number;
  /** Monthly savings pool = income × plan.savings% (whole dollars). */
  monthlySavings: number;
  /** Actual spending this month (absolute sum of outflows). */
  monthlySpent: number;
  /** Actual money left this month (income − spend, floored at 0) — the real cash available to assign. */
  surplus: number;
  /** Plan's savings percentage (0–100). */
  savingsPct: number;
  planId: string;
  planName: string;
  totalSaved: number;
  totalTarget: number;
  /** Sum of every goal's monthlyContribution (<= monthlySavings). */
  allocated: number;
  /** Pool left after funding goals (e.g. all goals fully funded). */
  unallocated: number;
  /**
   * Real cash still available to assign this month = surplus − what's already
   * been assigned to goals this month. Drives the "Assign" action; once 0 the
   * surplus is spent and can't be assigned again.
   */
  assignable: number;
  goals: GoalPlanItem[];
}

export interface GoalAllocationView {
  id: string;
  goalId: string;
  goalName: string;
  goalEmoji: string;
  amount: number;
  status: "pending" | "applied" | "overridden";
}

export interface BillView {
  id: string;
  name: string;
  due: string;
  amount: number;
  urgent: boolean;
}

export interface SubscriptionView {
  id: string;
  name: string;
  cycle: string;
  amount: number;
  icon: string;
  color: string;
  domain?: string;
  confirmedByUser: boolean;
  categoryId?: string;
  categoryName?: string;
  flags: string[];
}

export interface AccountView {
  id: string;
  name: string;
  type: string;
  num: string;
  balance: number;
  change: string;
  bg: string;
  /** True for accounts synced from a linked bank (Plaid). */
  synced?: boolean;
  /** Institution name for synced accounts (e.g. "TD"). */
  institution?: string;
  /** Pre-formatted last-sync date (e.g. "Jun 30"), server-computed. */
  syncedLabel?: string;
  /** Locally hidden — kept synced but omitted from net worth/totals. */
  excluded?: boolean;
}

export interface InsightView {
  id: string;
  tag: string;
  body: string;
  tagColor: string;
  tagBg: string;
}

export interface MonthlySummary {
  income: number;
  spending: number;
  surplus: number;
}

/**
 * One month in the net-worth history: the balance at that month's end and the
 * net cash flow that occurred during the month. Powers the Overview sparkline
 * and its hover tooltip.
 */
export interface NetWorthPoint {
  /** Short month label, e.g. "Jun". */
  label: string;
  /** Net worth at the end of this month. */
  value: number;
  /** Net cash flow during the month (income − spend); positive = net worth rose. */
  change: number;
}

export interface DashboardOverview {
  netWorth: number;
  netWorthChange: number;
  monthlyIncome: number;
  monthlySpend: number;
  monthlySurplus: number;
  budgetTarget: number;
  savingsRate: number;
  savedAmount: number;
  currency: string;
  spendingByCategory: SpendCategory[];
  upcomingBills: BillView[];
  incomeVsExpense: { months: string[]; income: number[]; expenses: number[] };
  netWorthTrend: NetWorthPoint[];
  goals: GoalView[];
  recentTransactions: TransactionView[];
}

export const TABS = ["Overview", "Spending", "Goals", "Transactions", "Subscriptions", "Accounts", "Insights"] as const;
export type Tab = (typeof TABS)[number];
