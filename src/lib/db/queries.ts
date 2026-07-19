import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getUserRow } from "./user";
import {
  computeAccountBalances,
  computeAllBudgetSpent,
  computeMonthlySurplus,
  NOT_EXCLUDED_ACCOUNT,
} from "./calculations";
import {
  detectPriceChanges,
  detectUnusedSubscriptions,
  computeSubscriptionBudgetImpact,
} from "./subscription-intelligence";
import { fmt, round2 } from "@/lib/format";
import { getBudgetPlan, bucketOf, accountGroupOf } from "@/lib/constants";
import { allocatePool } from "./goal-allocation";
import { resolveDomainsCached } from "@/lib/merchant/resolve";
import { getQuotes, type Quote } from "@/lib/market/prices";
import type {
  DashboardOverview,
  SpendCategory,
  SpendingPlanView,
  SpendingBucket,
  SpendingCategorySlice,
  SpendingCategoryDetail,
  GoalView,
  GoalPlanItem,
  GoalsPlanView,
  TransactionView,
  BillView,
  SubscriptionView,
  AccountView,
  InvestmentView,
  InsightView,
  InsightDetail,
  NetWorthPoint,
} from "@/lib/types";

const ACCOUNT_GRADIENTS: Record<string, string> = {
  chequing: "linear-gradient(135deg, oklch(18% 0.012 260), oklch(28% 0.015 260))",
  savings: "linear-gradient(135deg, oklch(52% 0.08 155), oklch(62% 0.09 170))",
  tfsa: "linear-gradient(135deg, oklch(44% 0.07 245), oklch(56% 0.08 255))",
  rrsp: "linear-gradient(135deg, oklch(60% 0.07 290), oklch(52% 0.09 280))",
  fhsa: "linear-gradient(135deg, oklch(58% 0.09 210), oklch(50% 0.08 220))",
  "credit-card": "linear-gradient(135deg, oklch(55% 0.09 38), oklch(65% 0.1 50))",
  investment: "linear-gradient(135deg, oklch(50% 0.08 180), oklch(60% 0.09 190))",
  loan: "linear-gradient(135deg, oklch(50% 0.06 100), oklch(42% 0.06 95))",
  mortgage: "linear-gradient(135deg, oklch(48% 0.07 90), oklch(40% 0.07 85))",
  other: "linear-gradient(135deg, oklch(60% 0.05 80), oklch(50% 0.05 80))",
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(d: Date): string {
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

/** Local calendar day as `YYYY-MM-DD` for the Transactions ledger's day
 *  buckets. Uses the same local getFullYear/getMonth/getDate as formatDate so
 *  the ISO key and the "Jul 12" label can never disagree by a day. */
function formatDayISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function getDashboardOverview(
  userId: string,
  month: number,
  year: number
): Promise<DashboardOverview> {
  const sevenMonthsAgo = new Date(year, month - 7, 1);

  const [
    user,
    accounts,
    accountBalances,
    summary,
    categorySpentMap,
    goals,
    bills,
    recentTx,
    categories,
    budgets,
    subscriptionImpact,
    windowTxs,
    firstTxAgg,
  ] = await Promise.all([
    getUserRow(userId),
    // Excluded accounts are hidden from net worth (kept synced, but omitted).
    prisma.account.findMany({ where: { userId, excluded: false } }),
    computeAccountBalances(userId),
    computeMonthlySurplus(userId, month, year),
    computeAllBudgetSpent(userId, month, year),
    prisma.goal.findMany({ where: { userId } }),
    prisma.bill.findMany({
      where: { userId, isPaid: false },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.transaction.findMany({
      where: { userId },
      include: { category: true, account: true },
      orderBy: { date: "desc" },
      take: 7,
    }),
    prisma.category.findMany({ where: { userId } }),
    prisma.budget.findMany({
      where: { userId, month, year },
      include: { category: true },
    }),
    computeSubscriptionBudgetImpact(userId, month, year),
    // Every non-excluded transaction in the trailing 7-month window — both
    // trend series below derive from this one read.
    prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: sevenMonthsAgo },
        ...NOT_EXCLUDED_ACCOUNT,
      },
      select: { date: true, amount: true, accountId: true },
    }),
    // Earliest transaction per account — a manual entry can be backdated to
    // before its account row was created, so "when does this account's history
    // start" is min(createdAt, first transaction).
    prisma.transaction.groupBy({
      by: ["accountId"],
      where: { userId, accountId: { not: null } },
      _min: { date: true },
    }),
  ]);

  // Synced accounts store Plaid's reported balance directly (bank truth, immune
  // to local tx edits); manual accounts are a starting balance plus their tx net.
  // Must match getAccounts so net worth and the accounts page agree.
  const balanceOf = (a: (typeof accounts)[number]) =>
    a.plaidItemId ? a.balance : a.balance + (accountBalances.get(a.id) ?? 0);
  const netWorth = accounts.reduce((sum, a) => sum + balanceOf(a), 0);
  // Cash & savings total — every account in the accounts-page "cash" group
  // (chequing, savings, other/uncategorized cash). Excludes loans/mortgages,
  // registered/investment accounts, and credit. Uses the shared grouping so
  // this figure equals the accounts page's "Cash & savings" subtotal.
  const cash = accounts
    .filter((a) => accountGroupOf(a.type) === "cash")
    .reduce((sum, a) => sum + balanceOf(a), 0);
  const monthlyIncome = summary.income;
  const monthlySpend = summary.spending;
  const monthlySurplus = summary.surplus;
  const budgetTarget = user?.budgetTarget || 0;
  const savedAmount = monthlySurplus;
  const savingsRate = monthlyIncome > 0 ? (savedAmount / monthlyIncome) * 100 : 0;

  // Spending by category — computed via efficient groupBy in calculations layer.
  const categorySpend = new Map<string, number>();
  for (const c of categories) {
    const amt = categorySpentMap.get(c.id) ?? 0;
    if (amt > 0) categorySpend.set(c.name, amt);
  }

  const budgetMap = new Map(budgets.map((b) => [b.category.name, b.amount]));
  const totalSpend = Array.from(categorySpend.values()).reduce((a, b) => a + b, 0) || 1;

  const spendingByCategory: SpendCategory[] = categories
    .filter((c) => c.name !== "Income")
    .map((c) => {
      const amount = categorySpend.get(c.name) || 0;
      return {
        categoryId: c.id,
        name: c.name,
        amount,
        budget: budgetMap.get(c.name) || 0,
        pct: Math.round((amount / totalSpend) * 100),
        color: c.color || "oklch(68% 0.04 80)",
        subscriptionCommitted: subscriptionImpact.get(c.id) ?? 0,
      };
    })
    .filter((c) => c.amount > 0 || c.budget > 0)
    .sort((a, b) => b.amount - a.amount);

  // Last-7-months trends, derived from the windowTxs read above. Both series
  // are actuals — no settings-derived figures mixed in.
  //
  // Net worth history is real, not projected: an account's balance at a past
  // month-end is its current balance minus its transactions after that month —
  // each later transaction is exactly what moved the balance from then to now.
  // This holds for manual and synced accounts alike (a synced account's stored
  // balance is its current reported truth, and its transactions account for the
  // deltas), so it matches the headline `netWorth` at the final point. Two
  // truth rules keep the history honest:
  //  - An account only exists in history from its first activity (creation or
  //    earliest backdated transaction). Before that, its balance is unknown —
  //    plotting it flat would be invented history. Months before ANY account
  //    existed are dropped entirely, so a new user's chart starts at month one.
  //  - Only account-linked transactions move net worth (an account-less manual
  //    transaction is cash flow, but no tracked balance changed).
  const firstTxByAccount = new Map(
    firstTxAgg
      .filter((r) => r.accountId && r._min.date)
      .map((r) => [r.accountId as string, r._min.date as Date]),
  );
  const startById = new Map(
    accounts.map((a) => {
      const firstTx = firstTxByAccount.get(a.id);
      return [a.id, firstTx && firstTx < a.createdAt ? firstTx : a.createdAt];
    }),
  );
  const firstActivity = accounts.length
    ? [...startById.values()].reduce((a, b) => (a < b ? a : b))
    : null;

  const months: string[] = [];
  const incomeArr: number[] = [];
  const expenseArr: number[] = [];
  const nwTrend: NetWorthPoint[] = [];

  for (let i = 6; i >= 0; i--) {
    const m = new Date(year, month - 1 - i, 1);
    const mEnd = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    const existsAt = (accountId: string | null) => {
      const start = accountId ? startById.get(accountId) : undefined;
      return start !== undefined && start < mEnd;
    };

    let monthIn = 0;
    let monthOut = 0;
    let monthDelta = 0;
    let afterEnd = 0;
    for (const t of windowTxs) {
      if (t.date >= mEnd) {
        if (existsAt(t.accountId)) afterEnd += t.amount;
      } else if (t.date >= m) {
        if (t.amount < 0) monthOut += -t.amount;
        else monthIn += t.amount;
        if (t.accountId) monthDelta += t.amount;
      }
    }

    months.push(MONTH_NAMES[m.getMonth()]);
    incomeArr.push(Math.round(monthIn));
    expenseArr.push(Math.round(monthOut));

    // Net worth is undefined before the first account existed — skip, don't fake.
    if (!firstActivity || firstActivity >= mEnd) continue;
    let value = 0;
    for (const a of accounts) {
      if (existsAt(a.id)) value += balanceOf(a);
    }
    // A month's `change` is the visible step from the previous point, so the
    // tooltip and the line can never disagree. Usually that step equals the
    // month's transactions, but when an account joins tracking mid-window its
    // starting balance is part of the step too (tracked net worth genuinely
    // rose by it). The first plotted month has no prior point, so it uses its
    // within-month transaction delta — a typed-in opening balance is not a gain.
    const pointValue = round2(value - afterEnd);
    const prev = nwTrend[nwTrend.length - 1];
    nwTrend.push({
      label: MONTH_NAMES[m.getMonth()],
      value: pointValue,
      change: round2(prev ? pointValue - prev.value : monthDelta),
    });
  }

  // The headline "this month" badge is the real net-worth movement — the same
  // figure as the trend's final point, so the badge and the chart always agree.
  const netWorthChange = nwTrend.length ? nwTrend[nwTrend.length - 1].change : 0;

  const goalViews: GoalView[] = goals.map((g) => ({
    id: g.id,
    name: g.name,
    emoji: g.emoji || "",
    saved: g.saved,
    target: g.target,
    priority: g.priority,
    color: g.color || "oklch(60% 0.09 155)",
    deadline: g.deadline
      ? `${MONTH_NAMES[g.deadline.getMonth()]} ${g.deadline.getFullYear()}`
      : "",
    deadlineISO: g.deadline ? g.deadline.toISOString().slice(0, 10) : undefined,
  }));

  const billViews: BillView[] = bills.map((b) => ({
    id: b.id,
    name: b.name,
    due: formatDate(b.dueDate),
    amount: b.amount,
    urgent: b.isUrgent || (b.dueDate.getTime() - Date.now() < 3 * 86400000),
  }));

  const recentDomains = await resolveDomainsCached(recentTx.map((t) => t.name));
  const txViews: TransactionView[] = recentTx.map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category?.name || "Other",
    date: formatDate(t.date),
    dateISO: formatDayISO(t.date),
    amount: t.amount,
    icon: t.icon || "circle",
    color: t.color || "#f0f0f0",
    domain: recentDomains.get(t.name) ?? undefined,
    accountId: t.accountId,
    accountName: t.account?.name ?? null,
    source: t.source as TransactionView["source"],
  }));

  return {
    netWorth,
    netWorthChange,
    cash,
    monthlyIncome,
    monthlySpend,
    monthlySurplus,
    budgetTarget,
    savingsRate,
    savedAmount,
    currency: user?.currency || "CAD",
    spendingByCategory,
    upcomingBills: billViews,
    incomeVsExpense: { months, income: incomeArr, expenses: expenseArr },
    netWorthTrend: nwTrend,
    goals: goalViews,
    recentTransactions: txViews,
  };
}

export async function getSpendingData(userId: string, month: number, year: number) {
  const [categorySpentMap, budgets, categories, subscriptionImpact] = await Promise.all([
    computeAllBudgetSpent(userId, month, year),
    prisma.budget.findMany({
      where: { userId, month, year },
      include: { category: true },
    }),
    prisma.category.findMany({ where: { userId } }),
    computeSubscriptionBudgetImpact(userId, month, year),
  ]);

  const budgetMap = new Map(budgets.map((b) => [b.category.name, b.amount]));
  const totalSpend =
    Array.from(categorySpentMap.values()).reduce((a, b) => a + b, 0) || 1;

  const spendCategories: SpendCategory[] = categories
    .filter((c) => c.name !== "Income")
    .map((c) => {
      const amount = categorySpentMap.get(c.id) || 0;
      return {
        categoryId: c.id,
        name: c.name,
        amount,
        budget: budgetMap.get(c.name) || 0,
        pct: Math.round((amount / totalSpend) * 100),
        color: c.color || "oklch(68% 0.04 80)",
        subscriptionCommitted: subscriptionImpact.get(c.id) ?? 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  return spendCategories;
}

/**
 * The Spending page view-model: the user's active budget plan, monthly income,
 * and this month's actual utilization grouped into Needs / Wants / Savings
 * buckets. Needs & Wants roll up category spend (via CATEGORY_BUCKETS); Savings
 * is virtual — actual income minus total spend, floored at 0 (matching the
 * Overview's "surplus" definition). Bucket targets come from the plan's
 * percentages of the configured monthly income — that's the plan side; the
 * actual side is transactions only.
 */
export async function getSpendingPlan(
  userId: string,
  month: number,
  year: number
): Promise<SpendingPlanView> {
  const [user, categorySpentMap, categories, summary, goals] = await Promise.all([
    getUserRow(userId),
    computeAllBudgetSpent(userId, month, year),
    prisma.category.findMany({ where: { userId } }),
    // Canonical monthly income/spend — the same aggregation the Overview uses
    // (excluded accounts and all), so the two pages always reconcile.
    computeMonthlySurplus(userId, month, year),
    prisma.goal.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
  ]);

  const plan = getBudgetPlan(user?.budgetPlan);
  const monthlyIncome = user?.monthlyIncome ?? 0;
  const currency = user?.currency ?? "CAD";

  const slices: Record<"needs" | "wants", SpendingCategorySlice[]> = {
    needs: [],
    wants: [],
  };
  const bucketActual: Record<"needs" | "wants", number> = { needs: 0, wants: 0 };

  for (const c of categories) {
    const bucket = bucketOf(c.name); // null for Income
    if (!bucket) continue;
    const amount = categorySpentMap.get(c.id) ?? 0;
    if (amount <= 0) continue;
    slices[bucket].push({
      categoryId: c.id,
      name: c.name,
      amount,
      color: c.color || "oklch(68% 0.04 80)",
      pctOfBucket: 0,
    });
    bucketActual[bucket] += amount;
  }

  // Fold any spend the buckets missed — uncategorized negatives and negatives
  // tagged "Income" (both dropped by the category rollup) — into Wants as an
  // explicit slice, so totalSpent equals the canonical monthly spend and savings
  // equals the surplus the Overview shows.
  const canonicalSpend = summary.spending;
  const uncategorized = Math.max(0, canonicalSpend - (bucketActual.needs + bucketActual.wants));
  if (uncategorized > 0.005) {
    slices.wants.push({
      categoryId: "uncategorized",
      name: "Uncategorized",
      amount: uncategorized,
      color: "oklch(80% 0.015 80)",
      pctOfBucket: 0,
    });
    bucketActual.wants += uncategorized;
  }

  for (const key of ["needs", "wants"] as const) {
    slices[key].sort((a, b) => b.amount - a.amount);
    const total = bucketActual[key];
    for (const s of slices[key]) {
      s.pctOfBucket = total > 0 ? Math.round((s.amount / total) * 100) : 0;
    }
  }

  const totalSpent = bucketActual.needs + bucketActual.wants;
  // Actual savings = what actually stayed this month (real income − real spend,
  // i.e. the Overview's surplus). Plan targets below still derive from the
  // configured monthlyIncome — that's the plan; this is what happened.
  const savingsActual = Math.max(0, summary.income - totalSpent);
  const targetAmount = (pct: number) => Math.round((monthlyIncome * pct) / 100);

  // Savings breakdown = where the planned savings goes. Split the savings
  // target across the user's goals (same allocator the Goals page uses) so the
  // Savings bucket shows the goals it funds, not an empty list.
  const savingsTarget = targetAmount(plan.savings);
  const goalAlloc = allocatePool(
    goals.map((g) => ({ id: g.id, priority: g.priority, saved: g.saved, target: g.target })),
    savingsTarget,
  );
  const savingsSlices: SpendingCategorySlice[] = goals
    .filter((g) => (goalAlloc.get(g.id) ?? 0) > 0)
    .map((g) => {
      const amount = goalAlloc.get(g.id) ?? 0;
      return {
        categoryId: g.id,
        name: g.name,
        amount,
        color: g.color || "oklch(60% 0.09 155)",
        pctOfBucket: savingsTarget > 0 ? Math.round((amount / savingsTarget) * 100) : 0,
        emoji: g.emoji,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const buckets: SpendingBucket[] = [
    {
      key: "needs",
      label: "Needs",
      targetPct: plan.needs,
      targetAmount: targetAmount(plan.needs),
      actualAmount: bucketActual.needs,
      categories: slices.needs,
    },
    {
      key: "wants",
      label: "Wants",
      targetPct: plan.wants,
      targetAmount: targetAmount(plan.wants),
      actualAmount: bucketActual.wants,
      categories: slices.wants,
    },
    {
      key: "savings",
      label: "Savings",
      targetPct: plan.savings,
      targetAmount: savingsTarget,
      actualAmount: savingsActual,
      categories: savingsSlices,
    },
  ];

  return {
    planId: plan.id,
    planName: plan.name,
    monthlyIncome,
    currency,
    totalSpent,
    buckets,
  };
}

/**
 * The spend transactions behind one Spending category slice, for the drill-in
 * drawer. Mirrors getSpendingPlan's categorisation so the drawer reconciles with
 * the row that opened it: expenses only (amount < 0), the same period window and
 * excluded-account rule. `categoryId` is a real category id, or the synthetic
 * "uncategorized" slice — the spend the buckets folded into Wants: transactions
 * with no category, plus any tagged "Income" (both dropped by the rollup).
 * Returns null when the id isn't a spend category the caller owns.
 */
export async function getSpendingCategoryDetail(
  userId: string,
  categoryId: string,
  month: number,
  year: number
): Promise<SpendingCategoryDetail | null> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);
  const period = { gte: startDate, lt: endDate };

  let where: Prisma.TransactionWhereInput;
  let label: string;

  if (categoryId === "uncategorized") {
    // The fold-in bucket: spend with no category, or spend tagged "Income"
    // (bucketOf returns null only for Income). Everything else maps to a bucket.
    const income = await prisma.category.findFirst({ where: { userId, name: "Income" } });
    where = {
      userId,
      amount: { lt: 0 },
      date: period,
      ...NOT_EXCLUDED_ACCOUNT,
      OR: [{ categoryId: null }, ...(income ? [{ categoryId: income.id }] : [])],
    };
    label = "Uncategorized";
  } else {
    const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
    // Only real spend categories drill in — Income and non-spend rows (savings
    // slices are goals, not transactions) return null so the row stays inert.
    if (!category || bucketOf(category.name) === null) return null;
    where = { userId, categoryId: category.id, amount: { lt: 0 }, date: period, ...NOT_EXCLUDED_ACCOUNT };
    label = category.name;
  }

  const txns = await prisma.transaction.findMany({
    where,
    include: { account: true },
    orderBy: { date: "desc" },
  });

  const total = txns.reduce((s, t) => s + Math.abs(t.amount), 0);
  return {
    categoryId,
    label,
    total,
    count: txns.length,
    transactions: [...txns]
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      .map((t) => ({
        id: t.id,
        name: t.name,
        amount: t.amount,
        date: formatDate(t.date),
        account: t.account?.name ?? null,
      })),
  };
}

export async function getGoals(userId: string): Promise<GoalView[]> {
  const goals = await prisma.goal.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return goals.map((g) => ({
    id: g.id,
    name: g.name,
    emoji: g.emoji || "",
    saved: g.saved,
    target: g.target,
    priority: g.priority,
    color: g.color || "oklch(60% 0.09 155)",
    deadline: g.deadline
      ? `${MONTH_NAMES[g.deadline.getMonth()]} ${g.deadline.getFullYear()}`
      : "",
    deadlineISO: g.deadline ? g.deadline.toISOString().slice(0, 10) : undefined,
  }));
}

/**
 * The Goals page view-model. Derives the monthly savings pool from the user's
 * budget plan (income × savings%), splits it across under-funded goals by
 * priority (via `allocatePool`), and enriches each goal with its funded share,
 * monthly contribution, projected finish date, and deadline pacing. This is the
 * single source that connects goals to the plan-driven Savings bucket shown on
 * the Spending page.
 *
 * @param userId - Owner of the goals.
 * @param month - 1-indexed month the projection starts from.
 * @param year - 4-digit year the projection starts from.
 */
export async function getGoalsPlan(
  userId: string,
  month: number,
  year: number,
): Promise<GoalsPlanView> {
  const [user, goals, summary, assignedAgg] = await Promise.all([
    getUserRow(userId),
    prisma.goal.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    computeMonthlySurplus(userId, month, year),
    // How much surplus has already been assigned to goals this month — so the
    // Assign action can't spend the same cash twice.
    prisma.goalAllocation.aggregate({
      where: { userId, month, year, status: "applied" },
      _sum: { amount: true },
    }),
  ]);

  const plan = getBudgetPlan(user?.budgetPlan);
  const monthlyIncome = user?.monthlyIncome ?? 0;
  const currency = user?.currency ?? "CAD";
  const monthlySavings = Math.round((monthlyIncome * plan.savings) / 100);
  const monthlySpent = Math.round(summary.spending * 100) / 100;
  const surplus = Math.max(0, Math.round(summary.surplus * 100) / 100);
  const assignedThisMonth = assignedAgg._sum.amount ?? 0;
  const assignable = Math.max(0, Math.round((surplus - assignedThisMonth) * 100) / 100);

  const alloc = allocatePool(
    goals.map((g) => ({ id: g.id, priority: g.priority, saved: g.saved, target: g.target })),
    monthlySavings,
  );

  let totalSaved = 0;
  let totalTarget = 0;
  let allocated = 0;

  const items: GoalPlanItem[] = goals.map((g) => {
    totalSaved += g.saved;
    totalTarget += g.target;

    const remaining = Math.max(g.target - g.saved, 0);
    const pct = g.target > 0 ? Math.round((g.saved / g.target) * 100) : 0;
    const done = g.target > 0 && g.saved >= g.target;
    const monthlyContribution = alloc.get(g.id) ?? 0;
    allocated += monthlyContribution;
    const share = monthlySavings > 0 ? Math.round((monthlyContribution / monthlySavings) * 100) : 0;

    let etaMonths: number | null = null;
    let etaLabel: string | null = null;
    let onTrack: boolean | null = null;

    if (!done && monthlyContribution > 0) {
      etaMonths = Math.ceil(remaining / monthlyContribution);
      const finish = new Date(year, month - 1 + etaMonths, 1);
      etaLabel = `${MONTH_NAMES[finish.getMonth()]} ${finish.getFullYear()}`;
      if (g.deadline) {
        // On track when the projected finish month is on/before the deadline month.
        onTrack = finish <= new Date(g.deadline.getFullYear(), g.deadline.getMonth() + 1, 1);
      }
    } else if (!done && g.deadline) {
      // Has a deadline but nothing funding it — behind by definition.
      onTrack = false;
    }

    return {
      id: g.id,
      name: g.name,
      emoji: g.emoji || "",
      saved: g.saved,
      target: g.target,
      priority: g.priority,
      color: g.color || "oklch(60% 0.09 155)",
      deadline: g.deadline
        ? `${MONTH_NAMES[g.deadline.getMonth()]} ${g.deadline.getFullYear()}`
        : "",
      deadlineISO: g.deadline ? g.deadline.toISOString().slice(0, 10) : undefined,
      pct,
      remaining,
      done,
      monthlyContribution,
      share,
      etaMonths,
      etaLabel,
      onTrack,
    };
  });

  return {
    currency,
    monthlyIncome,
    monthlySavings,
    monthlySpent,
    surplus,
    savingsPct: plan.savings,
    planId: plan.id,
    planName: plan.name,
    totalSaved,
    totalTarget,
    allocated: Math.round(allocated * 100) / 100,
    unallocated: Math.max(0, Math.round((monthlySavings - allocated) * 100) / 100),
    assignable,
    goals: items,
  };
}

export async function getTransactions(
  userId: string,
  options: {
    page?: number;
    limit?: number;
    search?: string;
    month?: number;
    year?: number;
  } = {}
) {
  const { page = 1, limit = 20, search, month, year } = options;

  const where: Record<string, unknown> = { userId };
  if (search) where.name = { contains: search };
  if (month && year) {
    where.date = {
      gte: new Date(year, month - 1, 1),
      lt: new Date(year, month, 1),
    };
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { category: true, account: true },
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  // Resolve merchant logos for this page from the dictionary + cache only (no
  // AI at read time): a known retailer shows its logo, an unknown one falls
  // back to the first letter in MerchantAvatar.
  const domainByName = await resolveDomainsCached(transactions.map((t) => t.name));

  const txViews: TransactionView[] = transactions.map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category?.name || "Other",
    date: formatDate(t.date),
    dateISO: formatDayISO(t.date),
    amount: t.amount,
    icon: t.icon || "circle",
    color: t.color || "#f0f0f0",
    domain: domainByName.get(t.name) ?? undefined,
    accountId: t.accountId,
    accountName: t.account?.name ?? null,
    source: t.source as TransactionView["source"],
    isRecurring: t.isRecurring,
  }));

  return { transactions: txViews, total, totalPages: Math.ceil(total / limit) };
}

export async function getSubscriptions(userId: string): Promise<SubscriptionView[]> {
  const [subs, priceChanges, unused] = await Promise.all([
    prisma.subscription.findMany({
      where: { userId, status: "active" },
      include: { category: true },
      orderBy: { amount: "desc" },
    }),
    detectPriceChanges(userId),
    detectUnusedSubscriptions(userId),
  ]);

  const priceChangeMap = new Map(priceChanges.map((p) => [p.subscriptionId, p]));
  const unusedMap = new Map(unused.map((u) => [u.subscriptionId, u]));

  return subs.map((s) => {
    const flags: string[] = [];
    const pc = priceChangeMap.get(s.id);
    if (pc) {
      flags.push(`Price changed: ${fmt(pc.oldAmount)} → ${fmt(pc.newAmount)}`);
    }
    const un = unusedMap.get(s.id);
    if (un) {
      flags.push(`No matching charge in ${un.daysSinceLastTransaction} days`);
    }

    return {
      id: s.id,
      name: s.name,
      cycle: s.cycle,
      amount: s.amount,
      icon: s.icon || "tv",
      color: s.color || "#fde8e8",
      domain: s.domain ?? undefined,
      confirmedByUser: s.confirmedByUser,
      categoryId: s.categoryId ?? undefined,
      categoryName: s.category?.name ?? undefined,
      flags,
    };
  });
}

/** Auto-detected subscriptions awaiting the user's review (status "suggested").
    Same shape as getSubscriptions but with no flags — these aren't tracked yet,
    so the price-change / unused signals don't apply. Ordered newest first so the
    freshest detections lead the review queue. */
export async function getSubscriptionSuggestions(userId: string): Promise<SubscriptionView[]> {
  const subs = await prisma.subscription.findMany({
    where: { userId, status: "suggested" },
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });

  return subs.map((s) => ({
    id: s.id,
    name: s.name,
    cycle: s.cycle,
    amount: s.amount,
    icon: s.icon || "tv",
    color: s.color || "#fde8e8",
    domain: s.domain ?? undefined,
    confirmedByUser: s.confirmedByUser,
    categoryId: s.categoryId ?? undefined,
    categoryName: s.category?.name ?? undefined,
    flags: [],
  }));
}

/** How many accounts the user has (linked or manual). Drives the app-wide
    cold-start empty states — 0 means "nothing connected yet". */
export function countAccounts(userId: string): Promise<number> {
  return prisma.account.count({ where: { userId } });
}

/** Count of auto-detected subscriptions awaiting review — drives the sidebar
    review badge (shown only when > 0). */
export function countPendingSubscriptions(userId: string): Promise<number> {
  return prisma.subscription.count({ where: { userId, status: "suggested" } });
}

/** id + name only — for filter dropdowns; skips the balance aggregation. */
export function getAccountOptions(userId: string): Promise<{ id: string; name: string }[]> {
  return prisma.account.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
}

export async function getAccounts(userId: string): Promise<AccountView[]> {
  const [accounts, balances, manualCounts] = await Promise.all([
    prisma.account.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
    computeAccountBalances(userId),
    // Manual entries per account — surfaced on synced accounts as "not from your
    // bank" (they don't move the bank-truth balance, but they do exist in the
    // ledger and can be reviewed/removed). "manual" only; csv-imported rows are
    // their own thing and aren't flagged here.
    prisma.transaction.groupBy({
      by: ["accountId"],
      where: { userId, source: "manual", accountId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const manualByAccount = new Map<string, number>();
  for (const row of manualCounts) {
    if (row.accountId) manualByAccount.set(row.accountId, row._count._all);
  }

  return accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    num: a.number || "",
    // Synced accounts store Plaid's reported balance directly — the bank's
    // truth, immune to local transaction edits. Manual accounts are a starting
    // balance plus the net of their transactions.
    balance: a.plaidItemId ? a.balance : a.balance + (balances.get(a.id) ?? 0),
    change: "",
    bg: a.gradient || ACCOUNT_GRADIENTS[a.type] || ACCOUNT_GRADIENTS.other,
    synced: !!a.plaidItemId,
    institution: a.institution ?? undefined,
    domain: a.domain ?? undefined,
    syncedLabel: a.syncedAt ? formatDate(a.syncedAt) : undefined,
    excluded: a.excluded,
    // Only meaningful for synced accounts — a manual account's entries ARE its
    // balance, so there's nothing "unreflected" to flag.
    unsyncedManualCount: a.plaidItemId ? (manualByAccount.get(a.id) ?? 0) : 0,
  }));
}

export async function getInvestments(userId: string): Promise<InvestmentView[]> {
  const [investments, user] = await Promise.all([
    prisma.investment.findMany({
      where: { userId },
      include: { account: { select: { name: true } } },
      orderBy: { value: "desc" },
    }),
    getUserRow(userId),
  ]);
  const currency = user?.currency ?? "CAD";

  // Live quotes for holdings that carry a ticker + a share count. Everything
  // degrades gracefully: no key / unknown symbol / offline → no quote, and the
  // holding falls back to its stored value.
  const quotable = investments
    .filter((i) => i.symbol?.trim() && i.quantity != null && i.quantity > 0)
    .map((i) => ({ symbol: i.symbol as string, assetClass: i.assetClass }));
  const quotes: Map<string, Quote> = quotable.length ? await getQuotes(quotable, currency) : new Map();

  // First pass: resolve each holding's current value (live price × shares when we
  // have a quote, else the stored value) so the portfolio total is consistent.
  const items = investments.map((i) => {
    const sym = i.symbol?.trim().toUpperCase();
    const q = sym && i.quantity != null && i.quantity > 0 ? quotes.get(sym) : undefined;
    const value = q ? q.price * (i.quantity as number) : i.value;
    return { i, q, value };
  });
  // Portfolio total drives each holding's allocation share.
  const total = items.reduce((sum, x) => sum + x.value, 0);

  return items.map(({ i, q, value }) => {
    // A cost basis of 0 (or absent) means "no performance to show" — the > 0
    // guard also avoids a divide-by-zero in the percent.
    const hasCost = i.costBasis != null && i.costBasis > 0;
    const gain = hasCost ? value - (i.costBasis as number) : undefined;
    return {
      id: i.id,
      name: i.name,
      symbol: i.symbol ?? "",
      assetClass: i.assetClass,
      value,
      costBasis: i.costBasis ?? undefined,
      quantity: i.quantity ?? undefined,
      domain: i.domain ?? undefined,
      accountId: i.accountId ?? undefined,
      accountName: i.account?.name ?? undefined,
      gain,
      gainPct: hasCost ? (gain! / (i.costBasis as number)) * 100 : undefined,
      allocationPct: total > 0 ? (value / total) * 100 : 0,
      live: !!q,
      livePrice: q ? q.price : undefined,
      dayChange: q ? q.change * (i.quantity as number) : undefined,
      dayChangePct: q ? q.changePct : undefined,
    };
  });
}

export async function getInsights(userId: string): Promise<InsightView[]> {
  const insights = await prisma.insight.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return insights.map((i) => ({
    id: i.id,
    tag: i.tag,
    body: i.body,
    tagColor: i.tagColor || "oklch(60% 0.09 155)",
    tagBg: i.tagBg || "oklch(93% 0.04 155)",
    focusType: i.focusType,
    focusKey: i.focusKey,
  }));
}

const CYCLE_PER_YEAR: Record<string, number> = {
  weekly: 52,
  biweekly: 26,
  monthly: 12,
  quarterly: 4,
  yearly: 1,
  annual: 1,
};

/**
 * The real data behind one insight, resolved from its stored focus. Uses the
 * SAME 3-month window as generation so drilled totals reconcile with the number
 * the card quotes. Returns null when the insight has no focus (legacy rows) or
 * the focused entity can no longer be found.
 */
export async function getInsightDetail(
  userId: string,
  insightId: string
): Promise<InsightDetail | null> {
  const insight = await prisma.insight.findFirst({
    where: { id: insightId, userId },
  });
  if (!insight || !insight.focusType) return null;

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  if (insight.focusType === "category" && insight.focusKey) {
    const category = await prisma.category.findFirst({
      where: { userId, name: insight.focusKey },
    });
    if (!category) return null;

    // Expenses only (negative amounts) — matches how generation totalled spend.
    const txns = await prisma.transaction.findMany({
      where: { userId, categoryId: category.id, amount: { lt: 0 }, date: { gte: threeMonthsAgo } },
      include: { account: true },
      orderBy: { date: "desc" },
    });
    if (txns.length === 0) {
      return { kind: "category", label: category.name, total: 0, count: 0, dateRange: null, byAccount: [], transactions: [] };
    }

    const total = txns.reduce((s, t) => s + Math.abs(t.amount), 0);
    const dates = txns.map((t) => t.date.getTime());
    const byAccountMap = new Map<string, { total: number; count: number }>();
    for (const t of txns) {
      const name = t.account?.name ?? "Unlinked";
      const e = byAccountMap.get(name) || { total: 0, count: 0 };
      e.total += Math.abs(t.amount);
      e.count += 1;
      byAccountMap.set(name, e);
    }

    return {
      kind: "category",
      label: category.name,
      total,
      count: txns.length,
      dateRange: { from: formatDate(new Date(Math.min(...dates))), to: formatDate(new Date(Math.max(...dates))) },
      byAccount: Array.from(byAccountMap.entries())
        .map(([account, v]) => ({ account, ...v }))
        .sort((a, b) => b.total - a.total),
      transactions: [...txns]
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
        .slice(0, 15)
        .map((t) => ({
          id: t.id,
          name: t.name,
          amount: t.amount,
          date: formatDate(t.date),
          account: t.account?.name ?? null,
        })),
    };
  }

  if (insight.focusType === "subscription" && insight.focusKey) {
    const sub = await prisma.subscription.findFirst({
      where: { userId, name: insight.focusKey },
      include: { category: true },
    });
    if (!sub) return null;
    const perYear = CYCLE_PER_YEAR[sub.cycle.toLowerCase()] ?? 12;
    return {
      kind: "subscription",
      label: sub.name,
      subscription: {
        amount: sub.amount,
        cycle: sub.cycle,
        annualized: sub.amount * perYear,
        category: sub.category?.name ?? null,
        lastCharged: sub.lastTransactionDate ? formatDate(sub.lastTransactionDate) : null,
      },
    };
  }

  if (insight.focusType === "goal" && insight.focusKey) {
    const goal = await prisma.goal.findFirst({
      where: { userId, name: insight.focusKey },
      include: { allocations: { orderBy: [{ year: "desc" }, { month: "desc" }], take: 6 } },
    });
    if (!goal) return null;
    return {
      kind: "goal",
      label: goal.name,
      goal: {
        saved: goal.saved,
        target: goal.target,
        pct: goal.target > 0 ? Math.round((goal.saved / goal.target) * 100) : 0,
        allocations: goal.allocations.map((a) => ({
          label: `${MONTH_NAMES[a.month - 1]} ${a.year}`,
          amount: a.amount,
          status: a.status,
        })),
      },
    };
  }

  // income — monthly income vs expenses over the window.
  const txns = await prisma.transaction.findMany({
    where: { userId, date: { gte: threeMonthsAgo } },
  });
  const monthly = new Map<string, { income: number; expenses: number }>();
  for (const t of txns) {
    const key = `${t.date.getFullYear()}-${t.date.getMonth()}`;
    const e = monthly.get(key) || { income: 0, expenses: 0 };
    if (t.amount > 0) e.income += t.amount;
    else e.expenses += Math.abs(t.amount);
    monthly.set(key, e);
  }
  const months = Array.from(monthly.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, v]) => {
      const [, m] = key.split("-");
      return { label: MONTH_NAMES[Number(m)], income: v.income, expenses: v.expenses, net: v.income - v.expenses };
    });
  return { kind: "income", label: "Income & spending", months };
}
