import { builder } from "../builder";
import type {
  TransactionView,
  SpendCategory,
  GoalView,
  SubscriptionView,
  AccountView,
  InsightView,
  BillView,
  DashboardOverview,
} from "@/lib/types";

// These object refs mirror the view-model interfaces in src/lib/types.ts exactly,
// so the GraphQL responses are byte-compatible with what the RSC views already
// render. Each read query returns one of these shapes from the src/lib/db service
// layer with no reshaping.

export const TransactionRef = builder
  .objectRef<TransactionView>("Transaction")
  .implement({
    fields: (t) => ({
      id: t.exposeID("id"),
      name: t.exposeString("name"),
      category: t.exposeString("category"),
      date: t.exposeString("date"),
      amount: t.exposeFloat("amount"),
      icon: t.exposeString("icon"),
      color: t.exposeString("color"),
    }),
  });

export const SpendCategoryRef = builder
  .objectRef<SpendCategory>("SpendCategory")
  .implement({
    fields: (t) => ({
      categoryId: t.exposeID("categoryId"),
      name: t.exposeString("name"),
      amount: t.exposeFloat("amount"),
      budget: t.exposeFloat("budget"),
      pct: t.exposeInt("pct"),
      color: t.exposeString("color"),
      subscriptionCommitted: t.exposeFloat("subscriptionCommitted"),
    }),
  });

export const GoalRef = builder.objectRef<GoalView>("Goal").implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    emoji: t.exposeString("emoji"),
    saved: t.exposeFloat("saved"),
    target: t.exposeFloat("target"),
    priority: t.exposeFloat("priority"),
    color: t.exposeString("color"),
    deadline: t.exposeString("deadline"),
    deadlineISO: t.exposeString("deadlineISO", { nullable: true }),
  }),
});

export const SubscriptionRef = builder
  .objectRef<SubscriptionView>("Subscription")
  .implement({
    fields: (t) => ({
      id: t.exposeID("id"),
      name: t.exposeString("name"),
      cycle: t.exposeString("cycle"),
      amount: t.exposeFloat("amount"),
      icon: t.exposeString("icon"),
      color: t.exposeString("color"),
      domain: t.exposeString("domain", { nullable: true }),
      confirmedByUser: t.exposeBoolean("confirmedByUser"),
      categoryId: t.exposeID("categoryId", { nullable: true }),
      categoryName: t.exposeString("categoryName", { nullable: true }),
      flags: t.exposeStringList("flags"),
    }),
  });

export const AccountRef = builder.objectRef<AccountView>("Account").implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    type: t.exposeString("type"),
    num: t.exposeString("num"),
    balance: t.exposeFloat("balance"),
    change: t.exposeString("change"),
    bg: t.exposeString("bg"),
    synced: t.exposeBoolean("synced", { nullable: true }),
    institution: t.exposeString("institution", { nullable: true }),
    syncedLabel: t.exposeString("syncedLabel", { nullable: true }),
    excluded: t.exposeBoolean("excluded", { nullable: true }),
  }),
});

export const InsightRef = builder.objectRef<InsightView>("Insight").implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    tag: t.exposeString("tag"),
    body: t.exposeString("body"),
    tagColor: t.exposeString("tagColor"),
    tagBg: t.exposeString("tagBg"),
  }),
});

export const BillRef = builder.objectRef<BillView>("Bill").implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    due: t.exposeString("due"),
    amount: t.exposeFloat("amount"),
    urgent: t.exposeBoolean("urgent"),
  }),
});

export const IncomeVsExpenseRef = builder
  .objectRef<DashboardOverview["incomeVsExpense"]>("IncomeVsExpense")
  .implement({
    fields: (t) => ({
      months: t.exposeStringList("months"),
      income: t.exposeFloatList("income"),
      expenses: t.exposeFloatList("expenses"),
    }),
  });

export const DashboardOverviewRef = builder
  .objectRef<DashboardOverview>("DashboardOverview")
  .implement({
    fields: (t) => ({
      netWorth: t.exposeFloat("netWorth"),
      netWorthChange: t.exposeFloat("netWorthChange"),
      monthlyIncome: t.exposeFloat("monthlyIncome"),
      monthlySpend: t.exposeFloat("monthlySpend"),
      monthlySurplus: t.exposeFloat("monthlySurplus"),
      budgetTarget: t.exposeFloat("budgetTarget"),
      savingsRate: t.exposeFloat("savingsRate"),
      savedAmount: t.exposeFloat("savedAmount"),
      currency: t.exposeString("currency"),
      spendingByCategory: t.field({
        type: [SpendCategoryRef],
        resolve: (o) => o.spendingByCategory,
      }),
      upcomingBills: t.field({
        type: [BillRef],
        resolve: (o) => o.upcomingBills,
      }),
      incomeVsExpense: t.field({
        type: IncomeVsExpenseRef,
        resolve: (o) => o.incomeVsExpense,
      }),
      netWorthTrend: t.exposeFloatList("netWorthTrend"),
      goals: t.field({ type: [GoalRef], resolve: (o) => o.goals }),
      recentTransactions: t.field({
        type: [TransactionRef],
        resolve: (o) => o.recentTransactions,
      }),
    }),
  });

export const TransactionPageRef = builder
  .objectRef<{
    transactions: TransactionView[];
    total: number;
    totalPages: number;
  }>("TransactionPage")
  .implement({
    fields: (t) => ({
      transactions: t.field({
        type: [TransactionRef],
        resolve: (o) => o.transactions,
      }),
      total: t.exposeInt("total"),
      totalPages: t.exposeInt("totalPages"),
    }),
  });
