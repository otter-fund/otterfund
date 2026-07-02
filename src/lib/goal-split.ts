// Pure savings-allocation math — no I/O, no server imports — so it can run on
// both the server (persisting allocations, deriving the Goals plan) and the
// client (live-previewing how an amount would split before the user assigns
// it). Keep this file dependency-free to preserve that dual use.

/** Minimal shape the allocator needs from a goal. */
export interface AllocatableGoal {
  id: string;
  priority: number;
  saved: number;
  target: number;
}

/**
 * Splits a savings pool across under-funded goals, proportionally by priority
 * weight (even split when all weights are zero). Each goal is capped at its
 * remaining capacity (`target - saved`) and any leftover from a capped goal is
 * redistributed to the still-open goals on the next pass.
 *
 * @param goals - Candidate goals with priority, saved, and target.
 * @param pool - Dollars available to distribute (e.g. this month's savings).
 * @returns Map of `goalId` -> allocated amount (rounded to cents); goals that
 *          received nothing are omitted.
 */
export function allocatePool(
  goals: AllocatableGoal[],
  pool: number
): Map<string, number> {
  const result = new Map<string, number>();
  if (pool <= 0) return result;

  type Slot = { id: string; weight: number; cap: number; amount: number };
  const slots: Slot[] = goals
    .filter((g) => g.target - g.saved > 0.0001)
    .map((g) => ({
      id: g.id,
      weight: g.priority > 0 ? g.priority : 0,
      cap: g.target - g.saved,
      amount: 0,
    }));
  if (slots.length === 0) return result;

  let remaining = pool;
  while (remaining > 0.0001) {
    const open = slots.filter((s) => s.cap - s.amount > 0.0001);
    if (open.length === 0) break;

    const totalWeight = open.reduce((s, x) => s + x.weight, 0);
    const useEvenSplit = totalWeight <= 0;

    let distributedThisPass = 0;
    for (const slot of open) {
      const share = useEvenSplit
        ? remaining / open.length
        : (remaining * slot.weight) / totalWeight;
      const take = Math.min(share, slot.cap - slot.amount);
      slot.amount += take;
      distributedThisPass += take;
    }

    remaining -= distributedThisPass;
    if (distributedThisPass < 0.0001) break;
  }

  for (const s of slots) {
    if (s.amount > 0) result.set(s.id, Math.round(s.amount * 100) / 100);
  }
  return result;
}
