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
  netWorthTrend: number[];
  goals: GoalView[];
  recentTransactions: TransactionView[];
}

export const TABS = ["Overview", "Spending", "Goals", "Transactions", "Subscriptions", "Accounts", "Insights"] as const;
export type Tab = (typeof TABS)[number];
