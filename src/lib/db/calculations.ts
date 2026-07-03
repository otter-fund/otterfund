import { cache } from "react";
import { prisma } from "./prisma";
import { getUserRow } from "./user";
import type { MonthlySummary } from "@/lib/types";

// The grouped aggregations below are cache()-wrapped: several view-models call
// the same one within a single render (e.g. the overview and the accounts page
// both need account balances), and cache() collapses those into one query per
// request. Outside an RSC render (route handlers) cache() is a pass-through.

/**
 * Prisma `where` fragment that drops transactions belonging to an excluded
 * (locally hidden) account, while keeping manual transactions that have no
 * account (`accountId: null`). Spread into any spending/budget/income
 * aggregation so "hidden" is consistent with net worth — a hidden account's
 * transactions must not count toward spending, budgets, or the savings rate.
 * Single source of truth so the rule can't drift across aggregations.
 */
export const NOT_EXCLUDED_ACCOUNT = {
  OR: [{ accountId: null }, { account: { excluded: false } }],
};

/**
 * Computes the live balance of an account as the sum of all its transactions.
 *
 * @param accountId - Account to compute balance for.
 * @returns Sum of `transaction.amount` for the account, or 0 if none exist.
 */
export async function computeAccountBalance(accountId: string): Promise<number> {
  const result = await prisma.transaction.aggregate({
    where: { accountId },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

/**
 * Computes balances for every account belonging to a user in a single query.
 * Accounts with no transactions will not appear in the returned map (callers
 * should default to 0).
 *
 * @param userId - Owner of the accounts.
 * @returns Map of `accountId` -> computed balance.
 */
export const computeAccountBalances = cache(async (
  userId: string
): Promise<Map<string, number>> => {
  const rows = await prisma.transaction.groupBy({
    by: ["accountId"],
    where: { userId, accountId: { not: null } },
    _sum: { amount: true },
  });

  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.accountId) {
      map.set(row.accountId, row._sum.amount ?? 0);
    }
  }
  return map;
});

/**
 * Computes the spending in a single budget category for a given month.
 *
 * @param userId - Owner of the transactions.
 * @param categoryId - Category to filter on.
 * @param month - 1-indexed month (1 = January).
 * @param year - 4-digit year.
 * @returns Absolute total of negative-amount transactions in that category.
 */
export async function computeBudgetSpent(
  userId: string,
  categoryId: string,
  month: number,
  year: number
): Promise<number> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const result = await prisma.transaction.aggregate({
    where: {
      userId,
      categoryId,
      amount: { lt: 0 },
      date: { gte: startDate, lt: endDate },
      ...NOT_EXCLUDED_ACCOUNT,
    },
    _sum: { amount: true },
  });

  return Math.abs(result._sum.amount ?? 0);
}

/**
 * Computes spent amounts for every category in a single grouped query.
 *
 * @param userId - Owner of the transactions.
 * @param month - 1-indexed month.
 * @param year - 4-digit year.
 * @returns Map of `categoryId` -> absolute spent amount (only negative txns).
 */
export const computeAllBudgetSpent = cache(async (
  userId: string,
  month: number,
  year: number
): Promise<Map<string, number>> => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const rows = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      userId,
      amount: { lt: 0 },
      categoryId: { not: null },
      date: { gte: startDate, lt: endDate },
      ...NOT_EXCLUDED_ACCOUNT,
    },
    _sum: { amount: true },
  });

  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.categoryId) {
      map.set(row.categoryId, Math.abs(row._sum.amount ?? 0));
    }
  }
  return map;
});

/**
 * Computes income, spending, and surplus (income - spending) for a month.
 *
 * Income is sourced from the user's configured `monthlyIncome` in settings —
 * not from positive-amount transactions — so that the figure shown across the
 * app matches what the user explicitly entered. Spending is still computed
 * live from negative transactions in the month.
 *
 * @param userId - Owner of the transactions.
 * @param month - 1-indexed month.
 * @param year - 4-digit year.
 * @returns Income (from settings), spending (absolute), and surplus for the month.
 */
export const computeMonthlySurplus = cache(async (
  userId: string,
  month: number,
  year: number
): Promise<MonthlySummary> => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const [user, spendAgg] = await Promise.all([
    getUserRow(userId),
    prisma.transaction.aggregate({
      where: {
        userId,
        amount: { lt: 0 },
        date: { gte: startDate, lt: endDate },
        ...NOT_EXCLUDED_ACCOUNT,
      },
      _sum: { amount: true },
    }),
  ]);

  const income = user?.monthlyIncome ?? 0;
  const spending = Math.abs(spendAgg._sum.amount ?? 0);
  return { income, spending, surplus: income - spending };
});

/**
 * Estimate a user's typical monthly income from their imported transactions —
 * used to pre-fill the figure during bank-connect onboarding so we don't have to
 * ask for it. Prefers deposits Plaid classified as "Income" (avoiding transfers
 * and refunds, which land in "Other"); if that category caught nothing, falls
 * back to all positive-amount deposits. The total is averaged over the distinct
 * calendar months that actually have income, so a partial first import (e.g.
 * only 90 days) still yields a sensible per-month figure.
 *
 * @param userId - Owner of the transactions.
 * @returns Rounded average monthly income, or 0 when no deposits are found.
 */
export async function deriveMonthlyIncome(userId: string): Promise<number> {
  const incomeCategory = await prisma.category.findUnique({
    where: { userId_name: { userId, name: "Income" } },
    select: { id: true },
  });

  let deposits = await prisma.transaction.findMany({
    where: {
      userId,
      amount: { gt: 0 },
      ...(incomeCategory ? { categoryId: incomeCategory.id } : {}),
    },
    select: { amount: true, date: true },
  });

  // Safety net: the Income category existed but matched nothing (e.g. Plaid
  // mislabelled the paychecks) — fall back to every deposit rather than $0.
  if (incomeCategory && deposits.length === 0) {
    deposits = await prisma.transaction.findMany({
      where: { userId, amount: { gt: 0 } },
      select: { amount: true, date: true },
    });
  }

  if (deposits.length === 0) return 0;

  const total = deposits.reduce((sum, t) => sum + t.amount, 0);
  const months = new Set(
    deposits.map((t) => `${t.date.getFullYear()}-${t.date.getMonth()}`)
  );
  return Math.round(total / Math.max(1, months.size));
}
