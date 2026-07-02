import { prisma } from "./prisma";
import { computeMonthlySurplus } from "./calculations";
import { allocatePool } from "@/lib/goal-split";

// Re-exported so existing server callers keep importing the allocator from here;
// the implementation lives in the client-safe `@/lib/goal-split`.
export { allocatePool } from "@/lib/goal-split";
export type { AllocatableGoal } from "@/lib/goal-split";

export interface GoalAllocationPlan {
  goalId: string;
  amount: number;
}

/**
 * Assigns this month's *remaining* real surplus across under-funded goals and
 * records it, so the same cash can't be assigned twice. Available = surplus −
 * what's already been assigned this month (sum of applied GoalAllocation rows).
 * Each funded goal's `saved` is incremented and its month's applied allocation
 * is bumped by the same amount, all in one transaction. Server-authoritative:
 * the amount is derived here, never taken from the client.
 *
 * @param userId - Owner of the goals.
 * @param month - 1-indexed month.
 * @param year - 4-digit year.
 * @returns The total assigned and how many goals were funded (0 when there's
 *          nothing left to assign or no under-funded goals).
 */
export async function assignAvailableSurplus(
  userId: string,
  month: number,
  year: number
): Promise<{ assigned: number; goalsFunded: number }> {
  const [summary, goals, assignedAgg] = await Promise.all([
    computeMonthlySurplus(userId, month, year),
    prisma.goal.findMany({ where: { userId } }),
    prisma.goalAllocation.aggregate({
      where: { userId, month, year, status: "applied" },
      _sum: { amount: true },
    }),
  ]);

  const surplus = Math.max(0, summary.surplus);
  const already = assignedAgg._sum.amount ?? 0;
  const available = Math.max(0, Math.round((surplus - already) * 100) / 100);
  if (available <= 0) return { assigned: 0, goalsFunded: 0 };

  const split = allocatePool(goals, available);
  if (split.size === 0) return { assigned: 0, goalsFunded: 0 };

  let assigned = 0;
  await prisma.$transaction(async (tx) => {
    for (const [goalId, amt] of split.entries()) {
      assigned += amt;
      await tx.goal.update({ where: { id: goalId }, data: { saved: { increment: amt } } });
      await tx.goalAllocation.upsert({
        where: { userId_goalId_month_year: { userId, goalId, month, year } },
        create: { userId, goalId, month, year, amount: amt, status: "applied" },
        update: { amount: { increment: amt }, status: "applied" },
      });
    }
  });

  return { assigned: Math.round(assigned * 100) / 100, goalsFunded: split.size };
}

/**
 * Computes how the current month's surplus should be split across active
 * (under-funded) goals. Splits proportionally by priority weight; when all
 * priorities are zero, splits evenly. Caps each goal at `target - saved`
 * and redistributes any leftover amount to remaining uncapped goals.
 *
 * @param userId - Owner of the goals.
 * @param month - 1-indexed month for the surplus computation.
 * @param year - 4-digit year for the surplus computation.
 * @returns Array of `{ goalId, amount }` allocations. Empty when surplus <= 0
 *          or there are no under-funded goals.
 */
export async function computeGoalAllocations(
  userId: string,
  month: number,
  year: number
): Promise<GoalAllocationPlan[]> {
  const [summary, goals] = await Promise.all([
    computeMonthlySurplus(userId, month, year),
    prisma.goal.findMany({ where: { userId } }),
  ]);

  if (summary.surplus <= 0) return [];

  const alloc = allocatePool(goals, summary.surplus);
  return [...alloc.entries()].map(([goalId, amount]) => ({ goalId, amount }));
}

/**
 * Inserts or updates `pending` GoalAllocation rows for a month/year using the
 * unique `(userId, goalId, month, year)` constraint. Existing applied or
 * overridden rows are reset to pending with the new amount.
 *
 * @param userId - Owner of the allocations.
 * @param month - 1-indexed month.
 * @param year - 4-digit year.
 * @param allocations - Computed allocation plans to persist.
 */
export async function upsertGoalAllocations(
  userId: string,
  month: number,
  year: number,
  allocations: GoalAllocationPlan[]
): Promise<void> {
  await Promise.all(
    allocations.map((a) =>
      prisma.goalAllocation.upsert({
        where: {
          userId_goalId_month_year: {
            userId,
            goalId: a.goalId,
            month,
            year,
          },
        },
        create: {
          userId,
          goalId: a.goalId,
          month,
          year,
          amount: a.amount,
          status: "pending",
        },
        update: {
          amount: a.amount,
          status: "pending",
        },
      })
    )
  );
}

/**
 * Applies all pending or overridden allocations for the given month/year:
 * adds each allocation amount to the linked goal's `saved` and marks the
 * allocation as `applied`. Runs in a single transaction.
 *
 * @param userId - Owner of the allocations.
 * @param month - 1-indexed month.
 * @param year - 4-digit year.
 * @returns Number of allocations applied.
 */
export async function applyGoalAllocations(
  userId: string,
  month: number,
  year: number
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const pending = await tx.goalAllocation.findMany({
      where: {
        userId,
        month,
        year,
        status: { in: ["pending", "overridden"] },
      },
    });

    for (const a of pending) {
      await tx.goal.update({
        where: { id: a.goalId },
        data: { saved: { increment: a.amount } },
      });
      await tx.goalAllocation.update({
        where: { id: a.id },
        data: { status: "applied" },
      });
    }

    return pending.length;
  });
}
