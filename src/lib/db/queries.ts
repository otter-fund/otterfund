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
import type {
  DashboardOverview,
  SpendCategory,
  GoalView,
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
