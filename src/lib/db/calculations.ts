import { cache } from "react";
import { prisma } from "./prisma";
import type { MonthlySummary } from "@/lib/types";
import { accountGroupOf, type AccountGroup } from "@/lib/constants";

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

// Names banks use for a credit-card / line-of-credit payment drawn from a cash
// account (the outgoing leg of a card paydown, e.g. Scotiabank's "Customer
// Transfer Dr. MB-CREDIT CARD/LOC PAY."). The incoming leg needs no pattern —
// it is caught structurally (any deposit onto a credit/loan account).
const CARD_PAYMENT_FROM_CASH =
  /credit card\s*\/?\s*loc|card\/loc pay|credit card payment|line of credit payment|\bc\.?c\.? payment\b|(?:master|visa|amex|mastercard) ?payment/i;

/**
 * True when a transaction is an internal transfer (money moving between the
 * user's own accounts) rather than real income or consumption, so the monthly
 * surplus isn't inflated by it. Two clear-cut cases, both legs of a credit-card
 * paydown:
 *   1. Any deposit landing ON a credit-card or loan account — a payment received
 *      or a refund, never income.
 *   2. Its funding leg — a credit-card / LOC payment drawn FROM a cash account.
 * Interac e-transfers are deliberately NOT treated as transfers: they can be
 * genuine income (a side gig, a client), and the goal-allocation cash cap
 * (see computeGoalCashHeadroom) guards against over-allocating regardless.
 */
export function isInternalTransfer(name: string, group: AccountGroup | null, amount: number): boolean {
  if ((group === "credit" || group === "loans") && amount > 0) return true;
  if (group === "cash" && amount < 0 && CARD_PAYMENT_FROM_CASH.test(name)) return true;
  return false;
}

/**
 * Computes income, spending, and surplus (income - spending) for a month —
 * all from actual transactions, so the three figures always reconcile.
 *
 * Income is the sum of positive-amount transactions in the month; spending is
 * the absolute sum of negative ones. Internal transfers are excluded from both
 * sides (see isInternalTransfer): a credit-card paydown is not income when it
 * lands on the card, nor spending when it leaves the chequing account — counting
 * it made the surplus (and the "available to allocate" figure) balloon with
 * money the user never actually gained.
 *
 * The user's configured `monthlyIncome` setting is deliberately NOT used here —
 * it is a budget-plan input (drives budget targets), not money that actually
 * arrived. Mixing it in produced "left over" amounts that never existed in any
 * account.
 *
 * @param userId - Owner of the transactions.
 * @param month - 1-indexed month.
 * @param year - 4-digit year.
 * @returns Actual income, spending (absolute), and surplus for the month.
 */
export const computeMonthlySurplus = cache(async (
  userId: string,
  month: number,
  year: number
): Promise<MonthlySummary> => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const txs = await prisma.transaction.findMany({
    where: {
      userId,
      date: { gte: startDate, lt: endDate },
      ...NOT_EXCLUDED_ACCOUNT,
    },
    select: { amount: true, name: true, account: { select: { type: true } } },
  });

  let income = 0;
  let spending = 0;
  for (const t of txs) {
    const group = t.account ? accountGroupOf(t.account.type) : null;
    if (isInternalTransfer(t.name, group, t.amount)) continue;
    if (t.amount > 0) income += t.amount;
    else spending += -t.amount;
  }
  return { income, spending, surplus: income - spending };
});

/**
 * Liquid cash on hand — the total balance of a user's non-excluded cash &
 * savings accounts (the accounts-page "cash" group: chequing, savings, other),
 * floored at 0. This is money physically available to move, so it caps how much
 * can be earmarked to savings goals. Uses the same balance rule as net worth:
 * synced accounts trust Plaid's stored balance; manual accounts are their
 * starting balance plus their transaction net.
 *
 * @param userId - Owner of the accounts.
 * @returns Total cash & savings balance, never below 0.
 */
export const computeLiquidCash = cache(async (userId: string): Promise<number> => {
  const [accounts, balances] = await Promise.all([
    prisma.account.findMany({
      where: { userId, excluded: false },
      select: { id: true, type: true, balance: true, plaidItemId: true },
    }),
    computeAccountBalances(userId),
  ]);
  const total = accounts
    .filter((a) => accountGroupOf(a.type) === "cash")
    .reduce(
      (sum, a) => sum + (a.plaidItemId ? a.balance : a.balance + (balances.get(a.id) ?? 0)),
      0,
    );
  return Math.max(0, Math.round(total * 100) / 100);
});

/**
 * The hard ceiling on new goal allocations: liquid cash on hand minus everything
 * already earmarked across the user's goals (sum of `goal.saved`), floored at 0.
 * You can't set aside cash you don't hold, and cash already promised to one goal
 * can't be promised again — so this bounds both the "available to allocate"
 * figure and every server-side allocation, independent of the monthly surplus.
 *
 * @param userId - Owner of the goals and accounts.
 * @returns Cash still free to earmark, never below 0.
 */
export const computeGoalCashHeadroom = cache(async (userId: string): Promise<number> => {
  const [liquid, earmarked] = await Promise.all([
    computeLiquidCash(userId),
    prisma.goal.aggregate({ where: { userId }, _sum: { saved: true } }),
  ]);
  return Math.max(0, Math.round((liquid - (earmarked._sum.saved ?? 0)) * 100) / 100);
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
