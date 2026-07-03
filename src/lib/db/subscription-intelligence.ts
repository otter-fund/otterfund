import { cache } from "react";
import { prisma } from "./prisma";

const UNUSED_THRESHOLD_DAYS = 60;

export interface PriceChange {
  subscriptionId: string;
  name: string;
  oldAmount: number;
  newAmount: number;
}

export interface UnusedSubscription {
  subscriptionId: string;
  name: string;
  daysSinceLastTransaction: number;
}

/**
 * Returns active subscriptions whose `previousAmount` is set and differs from
 * their current `amount` — indicating the price has changed since the last
 * confirmed amount.
 *
 * @param userId - Owner of the subscriptions.
 */
export async function detectPriceChanges(
  userId: string
): Promise<PriceChange[]> {
  const subs = await prisma.subscription.findMany({
    where: {
      userId,
      isActive: true,
      previousAmount: { not: null },
    },
  });

  return subs
    .filter((s) => s.previousAmount !== null && s.previousAmount !== s.amount)
    .map((s) => ({
      subscriptionId: s.id,
      name: s.name,
      oldAmount: s.previousAmount as number,
      newAmount: s.amount,
    }));
}

/**
 * Flags active subscriptions whose name has not appeared in any transaction
 * within the last `UNUSED_THRESHOLD_DAYS` days. Match is case-insensitive
 * substring on the transaction name.
 *
 * @param userId - Owner of the subscriptions.
 */
export async function detectUnusedSubscriptions(
  userId: string
): Promise<UnusedSubscription[]> {
  const subs = await prisma.subscription.findMany({
    where: { userId, isActive: true },
  });
  if (subs.length === 0) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - UNUSED_THRESHOLD_DAYS);

  const recentTxs = await prisma.transaction.findMany({
    where: { userId, date: { gte: cutoff } },
    select: { name: true, date: true },
  });

  const now = Date.now();
  const flagged: UnusedSubscription[] = [];

  for (const sub of subs) {
    // Annual subscriptions legitimately charge only once a year, so a 60-day
    // no-charge window would flag every one of them. Skip them — this signal
    // only makes sense for cycles that should bill within the window.
    if (sub.cycle === "Annual") continue;

    const needle = sub.name.toLowerCase();
    let mostRecent: Date | null = null;
    for (const t of recentTxs) {
      if (t.name.toLowerCase().includes(needle)) {
        if (!mostRecent || t.date > mostRecent) mostRecent = t.date;
      }
    }

    if (!mostRecent) {
      const days = sub.lastTransactionDate
        ? Math.floor((now - sub.lastTransactionDate.getTime()) / 86400000)
        : UNUSED_THRESHOLD_DAYS;
      flagged.push({
        subscriptionId: sub.id,
        name: sub.name,
        daysSinceLastTransaction: days,
      });
    }
  }

  return flagged;
}

/**
 * Aggregates the monthly cost of active subscriptions per linked budget
 * category. Annual subscriptions are amortized to a monthly figure (/12).
 *
 * @param userId - Owner of the subscriptions.
 * @param _month - 1-indexed month (currently unused; reserved for future
 *                 cycle-aware computations).
 * @param _year - 4-digit year (currently unused).
 * @returns Map of `categoryId` -> committed monthly cost.
 */
export const computeSubscriptionBudgetImpact = cache(async (
  userId: string,
  _month: number,
  _year: number
): Promise<Map<string, number>> => {
  const subs = await prisma.subscription.findMany({
    where: {
      userId,
      isActive: true,
      categoryId: { not: null },
    },
  });

  const map = new Map<string, number>();
  for (const s of subs) {
    if (!s.categoryId) continue;
    const monthly = s.cycle === "Annual" ? s.amount / 12 : s.amount;
    map.set(s.categoryId, (map.get(s.categoryId) ?? 0) + monthly);
  }
  return map;
});
