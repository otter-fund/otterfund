// Recurring-subscription detection + persistence (server-only).
//
// One code path turns "recurring expenses" into `Subscription` rows, shared by
// every entry point: the automatic pass that runs after a bank link or a
// statement import, and the manual toggle on a single transaction. The AI
// primitive (detectRecurringExpenses) only surfaces candidates; the sign
// convention, dedup, confidence gating, and cadence mapping all live here so
// the three callers stay consistent.

import { prisma } from "./prisma";
import { detectRecurringExpenses } from "@/lib/ai/detect-recurring";
import { resolveMerchant, lookupMerchantsCached, normalizeKey } from "@/lib/merchant/resolve";
import { SUBSCRIPTION_CYCLES } from "@/lib/constants";

// At or above this confidence we add the subscription outright (status
// "active"); anything the detector is less sure of is filed as "suggested" for
// the user to accept or decline in the review queue rather than dropped.
const AUTO_ADD_CONFIDENCE = 0.85;

// Mirror the per-user cap enforced by createSubscription so an over-eager
// detection pass can't balloon a user's list.
const MAX_SUBSCRIPTIONS = 200;

// Deterministic backstop behind the AI prompt: budget categories that are
// habitual spending, never subscriptions. If every categorized transaction
// behind a detected "subscription" falls in one of these, drop it — defends
// against the model occasionally flagging a grocery/restaurant/fuel merchant.
const NON_SUBSCRIPTION_CATEGORY = /grocer|dining|restaurant|fast\s*food|coffee|caf[eé]|takeout|\bfuel\b|\bgas\b/i;

// Thresholds for the free (no-AI) heuristic detector.
const HEURISTIC = {
  minOccurrences: 3, // need ≥3 charges to establish a pattern
  amountTolerance: 0.2, // each charge within ±20% of the median (subscriptions are stable)
  monthlyMinDays: 24, // a "monthly" gap sits in this day band…
  monthlyMaxDays: 38, // …up to here
  recentDays: 45, // the most recent charge must be this fresh (else likely cancelled)
} as const;

const median = (nums: number[]): number => {
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/** Normalized key for name-based dedup (trim + lowercase). */
const nameKey = (s: string) => s.trim().toLowerCase();

/** Map the detector's finer-grained cadence onto the two cycles the product
 *  supports. Annual stays annual; weekly/monthly/quarterly all read as Monthly
 *  (the user can retune it in the Recurring section). */
function toCycle(frequency: string | undefined): (typeof SUBSCRIPTION_CYCLES)[number] {
  return frequency === "Annual" ? "Annual" : "Monthly";
}

/**
 * Detect recurring expenses from the user's recent history and persist any that
 * aren't already tracked. High-confidence matches land as active subscriptions;
 * the rest go to the review queue. Best-effort and side-effect-only — callers
 * (link / import) should not fail if this throws.
 *
 * @returns counts of newly added (active) and suggested (review-queue) rows.
 */
export async function detectAndStoreRecurring(
  userId: string,
): Promise<{ added: number; suggested: number }> {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const transactions = await prisma.transaction.findMany({
    where: { userId, date: { gte: sixMonthsAgo }, amount: { lt: 0 } },
    orderBy: { date: "asc" },
    select: {
      id: true,
      name: true,
      amount: true,
      date: true,
      categoryId: true,
      category: { select: { name: true } },
    },
  });
  if (transactions.length < 5) return { added: 0, suggested: 0 };

  const suggestions = await detectRecurringExpenses(
    transactions.map((tx) => ({
      id: tx.id,
      name: tx.name,
      amount: tx.amount,
      date: tx.date.toISOString().split("T")[0],
      category: tx.category?.name ?? undefined,
    })),
  );
  if (suggestions.length === 0) return { added: 0, suggested: 0 };

  // Dedup against EVERY subscription the user already has — active, already
  // suggested, or previously dismissed — so we never duplicate a tracked
  // service nor re-surface one they've explicitly declined.
  const existing = await prisma.subscription.findMany({
    where: { userId },
    select: { name: true },
  });
  const seen = new Set(existing.map((s) => nameKey(s.name)));
  // So a detected sub inherits the budget category of the transactions behind
  // it (drives the per-category "committed" figure).
  const categoryByTx = new Map(transactions.map((t) => [t.id, t.categoryId]));
  const categoryNameByTx = new Map(transactions.map((t) => [t.id, t.category?.name ?? ""]));

  let headroom = MAX_SUBSCRIPTIONS - existing.length;
  let added = 0;
  let suggested = 0;

  for (const s of suggestions) {
    if (headroom <= 0) break;
    const name = (s.merchantName ?? "").trim();
    if (!name) continue;
    const key = nameKey(name);
    if (seen.has(key)) continue;

    const amount = Math.abs(Number(s.amount) || 0);
    if (amount <= 0) continue;

    // Backstop: if every categorized transaction behind this suggestion is
    // habitual spending (groceries/dining/fuel/…), it isn't a subscription —
    // skip it even if the model returned it.
    const cats = (s.transactionIds ?? [])
      .map((id) => categoryNameByTx.get(id) ?? "")
      .filter(Boolean);
    if (cats.length > 0 && cats.every((c) => NON_SUBSCRIPTION_CATEGORY.test(c))) continue;

    seen.add(key);
    headroom--;

    const isAuto = (Number(s.confidence) || 0) >= AUTO_ADD_CONFIDENCE;
    const categoryId =
      (s.transactionIds ?? [])
        .map((id) => categoryByTx.get(id))
        .find((c): c is string => Boolean(c)) ?? undefined;

    // A failed logo lookup must not abort the whole pass — degrade to no logo.
    const merchant = await resolveMerchant(name).catch(() => ({ domain: null }));

    await prisma.subscription.create({
      data: {
        userId,
        name,
        amount,
        cycle: toCycle(s.frequency),
        categoryId,
        domain: merchant.domain,
        status: isAuto ? "active" : "suggested",
        isActive: isAuto,
        // Auto-detected, not hand-confirmed — even the high-confidence ones were
        // added on the user's behalf, so leave confirmedByUser false until they
        // touch it.
        confirmedByUser: false,
        lastTransactionDate: new Date(),
      },
    });

    if (isAuto) added++;
    else suggested++;
  }

  return { added, suggested };
}

/**
 * FREE (no-AI) recurring detection for the ongoing sync path. Pure arithmetic
 * over the last 6 months of expenses: group by merchant, then flag a merchant
 * as a likely MONTHLY subscription when it charges a consistent amount on a
 * roughly-monthly cadence and is still active. Deliberately conservative and
 * routes everything to the review queue (status "suggested") — the thorough,
 * brand-aware AI pass stays reserved for bank-link / import / manual scan, so
 * routine syncs cost nothing in Claude tokens.
 *
 * @returns count of new suggestions queued.
 */
export async function detectRecurringHeuristic(userId: string): Promise<{ suggested: number }> {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const txns = await prisma.transaction.findMany({
    where: { userId, date: { gte: sixMonthsAgo }, amount: { lt: 0 } },
    orderBy: { date: "asc" },
    select: { name: true, amount: true, date: true, categoryId: true, category: { select: { name: true } } },
  });
  if (txns.length < HEURISTIC.minOccurrences) return { suggested: 0 };

  // Group by normalized merchant key, preserving date order within each group.
  const groups = new Map<string, { name: string; items: typeof txns }>();
  for (const t of txns) {
    const key = normalizeKey(t.name);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, { name: t.name, items: [] });
    groups.get(key)!.items.push(t);
  }

  // Dedup against every subscription the user already has (any status), so we
  // never duplicate a tracked one nor re-surface a dismissed one.
  const existing = await prisma.subscription.findMany({ where: { userId }, select: { name: true } });
  const seen = new Set(existing.map((s) => normalizeKey(s.name)).filter(Boolean));
  let headroom = MAX_SUBSCRIPTIONS - existing.length;

  const now = Date.now();
  const picks: { name: string; amount: number; categoryId: string | null }[] = [];

  for (const [key, g] of groups) {
    if (headroom <= 0) break;
    if (seen.has(key)) continue;
    const items = g.items;
    if (items.length < HEURISTIC.minOccurrences) continue;

    // Still active — most recent charge is fresh.
    const last = items[items.length - 1].date.getTime();
    if ((now - last) / 86_400_000 > HEURISTIC.recentDays) continue;

    // Consistent amount (subscriptions bill the same each cycle).
    const amounts = items.map((t) => Math.abs(t.amount));
    const med = median(amounts);
    if (med <= 0) continue;
    if (!amounts.every((a) => Math.abs(a - med) <= HEURISTIC.amountTolerance * med)) continue;

    // Roughly-monthly cadence — and NOT many charges bunched together (which is
    // habitual spending, not a subscription): the day-gaps must sit in the
    // monthly band and be regular.
    const gaps: number[] = [];
    for (let i = 1; i < items.length; i++) {
      gaps.push((items[i].date.getTime() - items[i - 1].date.getTime()) / 86_400_000);
    }
    const medGap = median(gaps);
    if (medGap < HEURISTIC.monthlyMinDays || medGap > HEURISTIC.monthlyMaxDays) continue;
    const regular = gaps.filter((gp) => Math.abs(gp - medGap) <= 0.5 * medGap).length >= Math.ceil(gaps.length * 0.6);
    if (!regular) continue;

    // Category backstop — never a grocery/dining/fuel merchant.
    const cats = items.map((t) => t.category?.name ?? "").filter(Boolean);
    if (cats.length > 0 && cats.every((c) => NON_SUBSCRIPTION_CATEGORY.test(c))) continue;

    seen.add(key);
    headroom--;
    picks.push({ name: g.name.trim(), amount: med, categoryId: items.find((t) => t.categoryId)?.categoryId ?? null });
  }

  if (picks.length === 0) return { suggested: 0 };

  // Clean display name + logo from the dictionary/cache only — no Claude. The
  // sync's merchant-cache warm runs before this, so known merchants resolve.
  const resolved = await lookupMerchantsCached(picks.map((p) => p.name));

  for (const p of picks) {
    const m = resolved.get(p.name);
    await prisma.subscription.create({
      data: {
        userId,
        name: m?.displayName?.trim() || p.name,
        amount: p.amount,
        cycle: "Monthly",
        categoryId: p.categoryId ?? undefined,
        domain: m?.domain ?? null,
        status: "suggested",
        isActive: false,
        confirmedByUser: false,
        lastTransactionDate: new Date(),
      },
    });
  }

  return { suggested: picks.length };
}

/**
 * Reflect the "recurring subscription" toggle on a single transaction.
 *
 * Checking it promotes an existing suggestion or creates a fresh active,
 * user-confirmed subscription (deduped by name). Unchecking dismisses the
 * matching active subscription (kept as "dismissed", not deleted, so detection
 * won't re-suggest it).
 */
export async function setSubscriptionForTransaction(
  userId: string,
  fields: { name: string; amount: number; cycle: string; categoryId?: string | null },
  active: boolean,
): Promise<void> {
  const name = fields.name.trim();
  if (!name) return;
  const cycle = toCycle(fields.cycle);
  const amount = Math.abs(fields.amount);

  const existing = await prisma.subscription.findFirst({
    where: { userId, name: { equals: name, mode: "insensitive" } },
  });

  if (active) {
    if (existing) {
      await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          status: "active",
          isActive: true,
          confirmedByUser: true,
          amount: amount > 0 ? amount : existing.amount,
          cycle,
          categoryId: fields.categoryId ?? existing.categoryId,
          lastTransactionDate: new Date(),
        },
      });
      return;
    }
    if ((await prisma.subscription.count({ where: { userId } })) >= MAX_SUBSCRIPTIONS) return;
    const merchant = await resolveMerchant(name).catch(() => ({ domain: null }));
    await prisma.subscription.create({
      data: {
        userId,
        name,
        amount,
        cycle,
        categoryId: fields.categoryId ?? undefined,
        domain: merchant.domain,
        status: "active",
        isActive: true,
        confirmedByUser: true,
        lastTransactionDate: new Date(),
      },
    });
    return;
  }

  // Unchecking — retire the tracked subscription if we have one.
  if (existing && existing.status === "active") {
    await prisma.subscription.update({
      where: { id: existing.id },
      data: { status: "dismissed", isActive: false },
    });
  }
}
