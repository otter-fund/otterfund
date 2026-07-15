export interface TransactionView {
  id: string;
  name: string;
  category: string;
  date: string;
  /** Local calendar day as `YYYY-MM-DD` — lets the Transactions ledger bucket
   *  rows by day and label them (Today / Yesterday / weekday). Optional so other
   *  builders (e.g. the GraphQL layer) needn't supply it; the ledger falls back
   *  to grouping by the formatted `date` string when it's absent. */
  dateISO?: string;
  amount: number;
  icon: string;
  color: string;
  /** Owning account — null for transactions with no account (rare/manual). */
  accountId: string | null;
  accountName: string | null;
  /** Where the row came from: "plaid" = live bank sync, "manual" = typed by the
   *  user, "csv" = extracted from an uploaded statement. Drives the Transactions
   *  page source filter + the "not from your bank" marker. */
  source?: "manual" | "plaid" | "csv";
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
  /** Savings slices only — the funded goal's emoji, so the Spending page can
      show the same mark the Goals page does. Null when the goal has none. */
  emoji?: string | null;
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

export interface InvestmentView {
  id: string;
  name: string;
  /** Ticker symbol, e.g. "AAPL" — "" when not provided. */
  symbol: string;
  /** One of ASSET_CLASSES: Stocks | ETFs | Crypto | Bonds | Real Estate | Cash | Other. */
  assetClass: string;
  /** Current market value the user maintains (the "how much money"). */
  value: number;
  /** Total invested — optional; when set (and > 0), enables gain/loss. */
  costBasis?: number;
  /** Units/shares held — optional. */
  quantity?: number;
  /** Resolved company domain for the logo (same idea as SubscriptionView.domain). */
  domain?: string;
  /** Linked account — optional ("in what account"). */
  accountId?: string;
  accountName?: string;
  /** value − costBasis; present only when costBasis is set (> 0). */
  gain?: number;
  /** Percent gain (gain / costBasis × 100); present only when costBasis > 0. */
  gainPct?: number;
  /** This holding's share of total portfolio value (0–100). */
  allocationPct: number;
  /** True when `value` came from a live market quote (ticker + shares resolved). */
  live?: boolean;
  /** Latest per-unit price in the display currency (live only). */
  livePrice?: number;
  /** Change on the day for this position, in the display currency (live only). */
  dayChange?: number;
  /** Percent change on the day (live only). */
  dayChangePct?: number;
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
  /** Resolved institution domain for the bank logo (e.g. "td.com"); undefined when unrecognized. */
  domain?: string;
  /** Pre-formatted last-sync date (e.g. "Jun 30"), server-computed. */
  syncedLabel?: string;
  /** Locally hidden — kept synced but omitted from net worth/totals. */
  excluded?: boolean;
  /** For synced accounts only: how many manual entries sit on this bank-linked
   *  account and so aren't reflected in its bank-truth balance. 0/undefined for
   *  manual accounts (where manual entries ARE the balance). Drives the
   *  "N not from your bank" review affordance. */
  unsyncedManualCount?: number;
}

export interface InsightView {
  id: string;
  tag: string;
  body: string;
  tagColor: string;
  tagBg: string;
  /** The data lever this insight is about — drives the click-to-drill-down.
   *  One of category|subscription|goal|income; null on legacy insights. */
  focusType?: string | null;
  /** Name of the focused entity (category/subscription/goal); null for income. */
  focusKey?: string | null;
}

/** One transaction row in an insight drill-down. */
export interface InsightDetailTx {
  id: string;
  name: string;
  amount: number;
  date: string;
  account: string | null;
}

/** The transactions behind one Spending category slice, for the drill-in drawer:
 *  the period's spend in that category and the rows that make it up. */
export interface SpendingCategoryDetail {
  categoryId: string;
  label: string;
  /** Absolute total spent in the category this period. */
  total: number;
  count: number;
  /** Every spend transaction in the category this period, largest first. */
  transactions: InsightDetailTx[];
}

/** The real data behind an insight, resolved from its focus. Shape varies by
 *  `kind`; only the fields for that kind are populated. */
export interface InsightDetail {
  kind: "category" | "subscription" | "goal" | "income";
  label: string;
  /** category — the transactions that make up the focused category. */
  total?: number;
  count?: number;
  dateRange?: { from: string; to: string } | null;
  byAccount?: { account: string; total: number; count: number }[];
  transactions?: InsightDetailTx[];
  /** subscription */
  subscription?: {
    amount: number;
    cycle: string;
    annualized: number;
    category: string | null;
    lastCharged: string | null;
  };
  /** goal */
  goal?: {
    saved: number;
    target: number;
    pct: number;
    allocations: { label: string; amount: number; status: string }[];
  };
  /** income */
  months?: { label: string; income: number; expenses: number; net: number }[];
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
  /** Cash & savings total — sum of every account in the accounts-page "cash" group (chequing, savings, other cash); excludes loans/mortgages, investments, and credit. */
  cash: number;
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

/**
 * A grounded reference the Advisor drew on for an answer. Every source is built
 * from a record actually returned by a read-only tool call during the turn — so
 * a source can't be hallucinated (unlike a figure the model might state). The UI
 * renders these as chips beneath the assistant's reply.
 */
export interface AdvisorSource {
  kind: "account" | "transaction" | "category" | "goal" | "subscription" | "summary";
  /** Stable id where the record has one (account/transaction/goal/subscription). */
  id?: string;
  /** Short chip label (e.g. the account or merchant name). */
  label: string;
  /** Secondary line (e.g. formatted amount + date). */
  detail?: string;
}

/** One turn in an Advisor conversation. */
export interface AdvisorMessage {
  role: "user" | "assistant";
  content: string;
  /** Present on assistant turns — the records the answer was grounded in. */
  sources?: AdvisorSource[];
}

/** A saved advisor chat, as shown in the conversation sidebar. */
export interface AdvisorConversationSummary {
  id: string;
  title: string;
  /** ISO timestamp of the last activity — the sidebar orders by this. */
  updatedAt: string;
}

/** A full advisor thread returned when a past conversation is reopened. */
export interface AdvisorConversation {
  id: string;
  title: string;
  messages: AdvisorMessage[];
}

export const TABS = ["Overview", "Spending", "Goals", "Transactions", "Subscriptions", "Accounts", "Insights"] as const;
export type Tab = (typeof TABS)[number];
