import { prisma } from "./prisma";
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
import { fmt } from "@/lib/format";
import { getBudgetPlan, bucketOf } from "@/lib/constants";
import { allocatePool } from "./goal-allocation";
import type {
  DashboardOverview,
  SpendCategory,
  SpendingPlanView,
  SpendingBucket,
  SpendingCategorySlice,
  GoalView,
  GoalPlanItem,
  GoalsPlanView,
  TransactionView,
  BillView,
  SubscriptionView,
  AccountView,
  InsightView,
} from "@/lib/types";

const ACCOUNT_GRADIENTS: Record<string, string> = {
  chequing: "linear-gradient(135deg, oklch(18% 0.012 260), oklch(28% 0.015 260))",
  savings: "linear-gradient(135deg, oklch(52% 0.08 155), oklch(62% 0.09 170))",
  tfsa: "linear-gradient(135deg, oklch(44% 0.07 245), oklch(56% 0.08 255))",
  rrsp: "linear-gradient(135deg, oklch(60% 0.07 290), oklch(52% 0.09 280))",
  fhsa: "linear-gradient(135deg, oklch(58% 0.09 210), oklch(50% 0.08 220))",
  "credit-card": "linear-gradient(135deg, oklch(55% 0.09 38), oklch(65% 0.1 50))",
  investment: "linear-gradient(135deg, oklch(50% 0.08 180), oklch(60% 0.09 190))",
  other: "linear-gradient(135deg, oklch(60% 0.05 80), oklch(50% 0.05 80))",
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(d: Date): string {
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

export async function getDashboardOverview(
  userId: string,
  month: number,
  year: number
): Promise<DashboardOverview> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

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
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
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
  ]);

  // Synced accounts store Plaid's reported balance directly (bank truth, immune
  // to local tx edits); manual accounts are a starting balance plus their tx net.
  // Must match getAccounts so net worth and the accounts page agree.
  const netWorth = accounts.reduce(
    (sum, a) => sum + (a.plaidItemId ? a.balance : a.balance + (accountBalances.get(a.id) ?? 0)),
    0
  );
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
  const subscriptionImpact = await computeSubscriptionBudgetImpact(userId, month, year);

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

  // Income vs expense trend (last 7 months). Income tracks the user's
  // configured monthlyIncome (from settings) so the chart matches the
  // headline figure; expenses are still computed from transactions.
  const sevenMonthsAgo = new Date(year, month - 7, 1);
  const allRecentTxs = await prisma.transaction.findMany({
    where: {
      userId,
      amount: { lt: 0 },
      date: { gte: sevenMonthsAgo },
      ...NOT_EXCLUDED_ACCOUNT,
    },
  });

  const settingsIncome = user?.monthlyIncome ?? 0;

  const months: string[] = [];
  const incomeArr: number[] = [];
  const expenseArr: number[] = [];
  const nwTrend: number[] = [];

  for (let i = 6; i >= 0; i--) {
    const m = new Date(year, month - 1 - i, 1);
    const mEnd = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    months.push(MONTH_NAMES[m.getMonth()]);

    const mTxs = allRecentTxs.filter(
      (t) => t.date >= m && t.date < mEnd
    );
    const exp = Math.abs(mTxs.reduce((s, t) => s + t.amount, 0));
    incomeArr.push(Math.round(settingsIncome));
    expenseArr.push(Math.round(exp));
    nwTrend.push(Math.round(netWorth - (settingsIncome - exp) * i));
  }

  const netWorthChange = savedAmount;

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

  const txViews: TransactionView[] = recentTx.map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category?.name || "Other",
    date: formatDate(t.date),
    amount: t.amount,
    icon: t.icon || "circle",
    color: t.color || "#f0f0f0",
    accountId: t.accountId,
    accountName: t.account?.name ?? null,
  }));

  return {
    netWorth,
    netWorthChange,
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
 * is virtual — income minus total spend, floored at 0 (matching the app's
 * "surplus" definition). Bucket targets come from the plan's percentages of
 * income, so target and actual are directly comparable.
 */
export async function getSpendingPlan(
  userId: string,
  month: number,
  year: number
): Promise<SpendingPlanView> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);
  const [user, categorySpentMap, categories, spendAgg, goals] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { monthlyIncome: true, currency: true, budgetPlan: true },
    }),
    computeAllBudgetSpent(userId, month, year),
    prisma.category.findMany({ where: { userId } }),
    // Canonical monthly spend — ALL negative transactions (matches Overview's
    // monthlySpend/surplus). Used to reconcile the buckets so the two pages agree.
    prisma.transaction.aggregate({
      where: { userId, amount: { lt: 0 }, date: { gte: startDate, lt: endDate } },
      _sum: { amount: true },
    }),
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
  const canonicalSpend = Math.abs(spendAgg._sum.amount ?? 0);
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
  const savingsActual = Math.max(0, monthlyIncome - totalSpent);
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
  const [user, goals, summary] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { monthlyIncome: true, currency: true, budgetPlan: true },
    }),
    prisma.goal.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    computeMonthlySurplus(userId, month, year),
  ]);

  const plan = getBudgetPlan(user?.budgetPlan);
  const monthlyIncome = user?.monthlyIncome ?? 0;
  const currency = user?.currency ?? "CAD";
  const monthlySavings = Math.round((monthlyIncome * plan.savings) / 100);
  const monthlySpent = Math.round(summary.spending * 100) / 100;
  const surplus = Math.max(0, Math.round(summary.surplus * 100) / 100);

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

  const txViews: TransactionView[] = transactions.map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category?.name || "Other",
    date: formatDate(t.date),
    amount: t.amount,
    icon: t.icon || "circle",
    color: t.color || "#f0f0f0",
    accountId: t.accountId,
    accountName: t.account?.name ?? null,
  }));

  return { transactions: txViews, total, totalPages: Math.ceil(total / limit) };
}

export async function getSubscriptions(userId: string): Promise<SubscriptionView[]> {
  const [subs, priceChanges, unused] = await Promise.all([
    prisma.subscription.findMany({
      where: { userId, isActive: true },
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

export async function getAccounts(userId: string): Promise<AccountView[]> {
  const [accounts, balances] = await Promise.all([
    prisma.account.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
    computeAccountBalances(userId),
  ]);

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
    syncedLabel: a.syncedAt ? formatDate(a.syncedAt) : undefined,
    excluded: a.excluded,
  }));
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
  }));
}
