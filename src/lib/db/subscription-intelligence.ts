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
      status: "active",
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
    where: { userId, status: "active" },
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
      // No transaction name-matches this subscription in the window. Only treat
      // that as "stopped charging" when we've actually seen it before AND it has
      // since gone quiet past the window. A brand-new entry, or one paid from an
      // account the user hasn't connected, has no observed history here, so
      // flagging it "no recent charge" reads as an error when nothing is wrong.
      const last = sub.lastTransactionDate;
      if (!last) continue;
      const days = Math.floor((now - last.getTime()) / 86400000);
      if (days < UNUSED_THRESHOLD_DAYS) continue;
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
      status: "active",
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
