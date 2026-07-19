// Plaid → otterfund sync. Server-only.
//
// Pulls transaction deltas via /transactions/sync (cursor-based), upserts the
// local Account + Transaction rows, and stores each synced account's Plaid-
// reported balance DIRECTLY as the account balance (bank truth — see
// reconcileAnchor; getAccounts does NOT add the local transaction sum for synced
// accounts). Balances ride along in the sync response, so we never call the
// per-call /accounts/balance/get. Each brand-new synced row also auto-merges any
// manual entry the user had logged for the same purchase (mergeManualDuplicate).

import type {
  AccountBase,
  RemovedTransaction,
  Transaction as PlaidTransaction,
} from "plaid";
import type { PlaidItem } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decryptToken } from "@/lib/crypto";
import { plaid } from "./client";
import {
  mapPlaidAccountType,
  isDebtOtterfundType,
  plaidCategoryToOtterfund,
  iconColorFor,
} from "./mappers";
import { resolveMerchant, warmMerchantDomains } from "@/lib/merchant/resolve";
import { detectRecurringHeuristic } from "@/lib/db/recurring";

export interface SyncResult {
  added: number;
  modified: number;
  removed: number;
}

/** Pull Plaid's error_code out of an SDK/Axios error, if present. */
function plaidErrorCode(err: unknown): string | null {
  const e = err as { response?: { data?: { error_code?: string } } };
  return e?.response?.data?.error_code ?? null;
}

/**
 * Extract ONLY safe scalars from a Plaid/Axios error for logging. NEVER log the
 * raw error object: the Plaid SDK is Axios-based and AxiosError.config is an own
 * enumerable prop carrying the PLAID-SECRET request header and the account
 * access_token (config.data). console.error(rawErr) → util.inspect prints both
 * verbatim (CWE-532). Use this everywhere a Plaid call may throw.
 */
export function safePlaidErr(err: unknown): Record<string, unknown> {
  const e = err as {
    response?: {
      status?: number;
      data?: { error_code?: string; error_type?: string; request_id?: string };
    };
    message?: string;
  };
  return {
    status: e?.response?.status,
    error_code: e?.response?.data?.error_code,
    error_type: e?.response?.data?.error_type,
    request_id: e?.response?.data?.request_id,
    message: e?.message,
  };
}

/**
 * Incrementally sync one Plaid Item. Persists the new cursor and updates status.
 * Throws on Plaid API failure (after recording the error on the item).
 */
export async function syncItem(item: PlaidItem): Promise<SyncResult> {
  const accessToken = decryptToken(item.accessToken);

  // 1) Drain the cursor: accumulate all deltas until has_more is false.
  let cursor = item.cursor || undefined;
  const added: PlaidTransaction[] = [];
  const modified: PlaidTransaction[] = [];
  const removed: RemovedTransaction[] = [];
  let accounts: AccountBase[] = [];
  let hasMore = true;

  try {
    while (hasMore) {
      const { data } = await plaid.transactionsSync({
        access_token: accessToken,
        cursor,
      });
      added.push(...data.added);
      modified.push(...data.modified);
      removed.push(...data.removed);
      accounts = data.accounts;
      cursor = data.next_cursor;
      hasMore = data.has_more;
    }
  } catch (err) {
    const code = plaidErrorCode(err);
    await prisma.plaidItem.update({
      where: { id: item.id },
      data: {
        status: code === "ITEM_LOGIN_REQUIRED" ? "login_required" : "error",
        error: code ?? "unknown",
      },
    });
    throw err;
  }

  // 2) Upsert the local Account rows. /transactions/sync only returns accounts
  // that have transactions, so pull the full list via /accounts/get (free with
  // the Transactions product) to also capture zero-transaction accounts. Fall
  // back to the sync accounts if that call fails.
  let accountList = accounts;
  try {
    const acctRes = await plaid.accountsGet({ access_token: accessToken });
    if (acctRes.data.accounts?.length) accountList = acctRes.data.accounts;
  } catch (err) {
    console.error("accountsGet failed, using sync accounts:", safePlaidErr(err));
  }

  // Resolve the institution's logo domain ONCE per item (same path as
  // subscriptions: dictionary → Merchant cache → Claude), then store it on every
  // account of this bank so the UI reads it as-is.
  const institutionDomain = item.institutionName
    ? (await resolveMerchant(item.institutionName)).domain
    : null;

  const localIdByPlaid = new Map<string, string>();
  for (const acct of accountList) {
    const local = await upsertAccount(item, acct, institutionDomain);
    localIdByPlaid.set(acct.account_id, local.id);
  }

  // Category resolver with a per-run cache (find-or-create by unique userId+name).
  const categoryCache = new Map<string, string>();
  const resolveCategory = async (name: string): Promise<string> => {
    const hit = categoryCache.get(name);
    if (hit) return hit;
    const { icon, color } = iconColorFor(name);
    const cat = await prisma.category.upsert({
      where: { userId_name: { userId: item.userId, name } },
      create: { userId: item.userId, name, icon, color },
      update: {},
    });
    categoryCache.set(name, cat.id);
    return cat.id;
  };

  // 3) Upsert added + modified; delete removed (idempotent by externalId).
  for (const tx of [...added, ...modified]) {
    let accountId = localIdByPlaid.get(tx.account_id);
    if (!accountId) {
      // Rare: a transaction on an account not in the accounts array.
      const placeholder = await prisma.account.upsert({
        where: { plaidAccountId: tx.account_id },
        create: {
          userId: item.userId,
          plaidItemId: item.id,
          plaidAccountId: tx.account_id,
          name: "Account",
          type: "other",
          balance: 0,
          institution: item.institutionName ?? null,
          domain: institutionDomain,
          syncedAt: new Date(),
        },
        update: {},
      });
      accountId = placeholder.id;
      localIdByPlaid.set(tx.account_id, accountId);
    }
    await upsertTransaction(item.userId, accountId, tx, resolveCategory);
  }

  if (removed.length) {
    await prisma.transaction.deleteMany({
      where: {
        userId: item.userId,
        externalId: { in: removed.map((r) => r.transaction_id) },
      },
    });
  }

  // 4) Reconcile each synced account's anchor balance.
  for (const acct of accountList) {
    const localId = localIdByPlaid.get(acct.account_id);
    if (localId) await reconcileAnchor(localId, acct);
  }

  // 5) Persist cursor + healthy status.
  await prisma.plaidItem.update({
    where: { id: item.id },
    data: { cursor, lastSyncedAt: new Date(), status: "active", error: null },
  });

  // 6) Warm the shared merchant-logo cache for any new/updated merchants so the
  // transactions UI shows their real logos. Bounded + best-effort — steady state
  // has ~no misses, and this must never fail or noticeably slow a sync.
  try {
    const names = [...added, ...modified].map((t) => t.merchant_name || t.name);
    await warmMerchantDomains(names, { max: 20 });
  } catch (err) {
    console.error("merchant cache warm failed:", safePlaidErr(err));
  }

  // 7) Free heuristic subscription detection — ONLY when this sync actually
  // brought in new transactions, and never with an AI call. New monthly
  // patterns land in the review queue. Best-effort; must not fail the sync.
  if (added.length > 0) {
    try {
      await detectRecurringHeuristic(item.userId);
    } catch (err) {
      console.error("heuristic recurring detection failed:", err);
    }
  }

  return { added: added.length, modified: modified.length, removed: removed.length };
}

/** Create or refresh the local Account for a Plaid account. Balance set by reconcileAnchor. */
async function upsertAccount(item: PlaidItem, acct: AccountBase, domain: string | null) {
  const type = mapPlaidAccountType(
    String(acct.type),
    acct.subtype ? String(acct.subtype) : null,
    acct.name || acct.official_name
  );
  const shared = {
    userId: item.userId,
    plaidItemId: item.id,
    name: acct.name || acct.official_name || "Account",
    type,
    number: acct.mask ? `·· ${acct.mask}` : null,
    mask: acct.mask ?? null,
    institution: item.institutionName ?? null,
    domain,
    syncedAt: new Date(),
  };
  return prisma.account.upsert({
    where: { plaidAccountId: acct.account_id },
    create: { ...shared, plaidAccountId: acct.account_id, balance: 0 },
    update: shared,
  });
}

async function upsertTransaction(
  userId: string,
  accountId: string,
  tx: PlaidTransaction,
  resolveCategory: (name: string) => Promise<string>
) {
  // Plaid: positive = money OUT (debit). otterfund: positive = income. Flip.
  const amount = -tx.amount;
  const category = plaidCategoryToOtterfund(
    tx.personal_finance_category?.primary,
    tx.personal_finance_category?.detailed
  );
  const { icon, color } = iconColorFor(category);
  const categoryId = await resolveCategory(category);
  const data = {
    userId,
    accountId,
    categoryId,
    name: tx.merchant_name || tx.name || "Transaction",
    amount,
    date: new Date(tx.date),
    icon,
    color,
    source: "plaid",
    pending: tx.pending,
  };

  // Was this Plaid transaction already stored? Only a brand-new insert should
  // trigger manual-duplicate cleanup — a re-sync of an existing row must never
  // delete a manual entry the user has legitimately added since.
  const alreadyStored = await prisma.transaction.findUnique({
    where: { externalId: tx.transaction_id },
    select: { id: true },
  });

  await prisma.transaction.upsert({
    where: { externalId: tx.transaction_id },
    create: { ...data, externalId: tx.transaction_id },
    update: data,
  });

  // When a pending transaction posts, Plaid links it via pending_transaction_id;
  // drop the stale pending row so it isn't double-counted.
  if (tx.pending_transaction_id) {
    await prisma.transaction.deleteMany({
      where: { userId, externalId: tx.pending_transaction_id },
    });
  }

  if (!alreadyStored) {
    await mergeManualDuplicate(userId, accountId, amount, new Date(tx.date));
  }
}

// Fuzzy-match window for merging a manual entry into its freshly-synced bank
// counterpart. A user typically logs a purchase on its transaction date; the
// bank posts it 0–3 days later, so a ±4-day window comfortably covers the lag
// without reaching across into unrelated purchases.
const MERGE_WINDOW_DAYS = 4;
// Currency amounts compared with a small epsilon to sidestep float wobble
// (a manual "-5" and Plaid's "-5.00" must count as equal).
const MERGE_AMOUNT_EPSILON = 0.005;

/**
 * Auto-merge a manual duplicate: if the user had already logged this purchase by
 * hand (same account, matching amount, within the date window), the just-synced
 * bank row is canonical — delete the manual one so it stops double-counting in
 * spending / budgets / the savings rate. Conservative match (account + amount +
 * narrow date window) so two genuinely-different purchases are never merged; on
 * a tie we drop the manual entry closest in date to the bank row.
 */
async function mergeManualDuplicate(
  userId: string,
  accountId: string,
  amount: number,
  date: Date
) {
  const start = new Date(date);
  start.setDate(start.getDate() - MERGE_WINDOW_DAYS);
  const end = new Date(date);
  end.setDate(end.getDate() + MERGE_WINDOW_DAYS);

  const candidates = await prisma.transaction.findMany({
    where: {
      userId,
      accountId,
      source: "manual",
      externalId: null,
      date: { gte: start, lte: end },
    },
  });

  const match = candidates
    .filter((c) => Math.abs(c.amount - amount) < MERGE_AMOUNT_EPSILON)
    .sort(
      (a, b) =>
        Math.abs(a.date.getTime() - date.getTime()) -
        Math.abs(b.date.getTime() - date.getTime())
    )[0];

  if (match) {
    await prisma.transaction.delete({ where: { id: match.id } });
  }
}

/**
 * Store Plaid's reported balance DIRECTLY as the account balance. Synced
 * accounts are the bank's source of truth, so their displayed balance must equal
 * what Plaid reports and must NOT drift when local transactions are edited or
 * deleted (getAccounts skips the tx-sum for synced accounts). Debt accounts
 * (credit / loan / mortgage) are shown negative so net worth stays correct.
 */
async function reconcileAnchor(localAccountId: string, acct: AccountBase) {
  const base = acct.balances?.current ?? acct.balances?.available;
  if (base == null) return; // nothing to anchor to
  // Sign off the otterfund type (not Plaid's raw type) so a name-inferred loan/
  // mortgage is shown negative too, matching how it's grouped.
  const otterfundType = mapPlaidAccountType(
    String(acct.type),
    acct.subtype ? String(acct.subtype) : null,
    acct.name || acct.official_name
  );
  const target = isDebtOtterfundType(otterfundType) ? -Math.abs(base) : base;
  await prisma.account.update({
    where: { id: localAccountId },
    data: { balance: target },
  });
}

/** Sync every active Item (used by the daily cron). Never throws. */
export async function syncAllActiveItems() {
  const items = await prisma.plaidItem.findMany({ where: { status: "active" } });
  const results: Array<{ itemId: string } & Partial<SyncResult> & { error?: string }> = [];
  for (const item of items) {
    try {
      results.push({ itemId: item.itemId, ...(await syncItem(item)) });
    } catch (err) {
      results.push({ itemId: item.itemId, error: plaidErrorCode(err) ?? "error" });
    }
  }
  return results;
}
