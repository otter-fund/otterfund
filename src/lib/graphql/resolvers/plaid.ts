import { builder } from "../builder";
import { requireUser, notFound, rateLimited, badRequest } from "../errors";
import { MutationResultRef } from "../types/results";
import { prisma } from "@/lib/db/prisma";
import {
  plaid,
  PLAID_PRODUCTS,
  plaidCountryCodes,
  plaidWebhookUrl,
} from "@/lib/plaid/client";
import { encryptToken, decryptToken } from "@/lib/crypto";
import { syncItem, syncAllActiveItems, safePlaidErr } from "@/lib/plaid/sync";
import { checkLinkQuota, recordLinkEvent } from "@/lib/plaid/guards";
import { rateLimit, MINUTE, HOUR, SECOND } from "@/lib/rate-limit";

const PlaidItemRef = builder
  .objectRef<{
    itemId: string;
    institutionName: string | null;
    status: string;
    lastSyncedAt: string | null;
    accountCount: number;
  }>("PlaidItem")
  .implement({
    fields: (t) => ({
      itemId: t.exposeID("itemId"),
      institutionName: t.exposeString("institutionName", { nullable: true }),
      status: t.exposeString("status"),
      lastSyncedAt: t.exposeString("lastSyncedAt", { nullable: true }),
      accountCount: t.exposeInt("accountCount"),
    }),
  });

// Never expose accessToken — only these safe fields for the Connections tab.
builder.queryField("plaidItems", (t) =>
  t.field({
    type: [PlaidItemRef],
    resolve: async (_root, _args, ctx) => {
      const userId = requireUser(ctx);
      const items = await prisma.plaidItem.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { accounts: true } } },
      });
      return items.map((i) => ({
        itemId: i.itemId,
        institutionName: i.institutionName,
        status: i.status,
        lastSyncedAt: i.lastSyncedAt ? i.lastSyncedAt.toISOString() : null,
        accountCount: i._count.accounts,
      }));
    },
  }),
);

builder.mutationField("createPlaidLinkToken", (t) =>
  t.field({
    type: "String",
    resolve: async (_root, _args, ctx) => {
      const userId = requireUser(ctx);
      const limit = rateLimit(`plaid:link-token:${userId}`, [
        { limit: 15, windowMs: 5 * MINUTE },
      ]);
      if (!limit.ok) rateLimited(limit.retryAfterSec);
      // Fail before opening Plaid Link (completion would create a billable Item).
      const quota = await checkLinkQuota(userId);
      if (!quota.ok) rateLimited(undefined, quota.reason);

      const res = await plaid.linkTokenCreate({
        user: { client_user_id: userId },
        client_name: "otterfund",
        language: "en",
        country_codes: plaidCountryCodes(),
        products: PLAID_PRODUCTS,
        webhook: plaidWebhookUrl(),
      });
      return res.data.link_token;
    },
  }),
);

const PlaidInstitutionInput = builder.inputType("PlaidInstitutionInput", {
  fields: (t) => ({
    institutionId: t.string(),
    name: t.string(),
  }),
});

builder.mutationField("exchangePlaidToken", (t) =>
  t.field({
    type: MutationResultRef,
    args: {
      publicToken: t.arg.string({ required: true }),
      institution: t.arg({ type: PlaidInstitutionInput }),
    },
    resolve: async (_root, { publicToken, institution }, ctx) => {
      const userId = requireUser(ctx);
      const limit = rateLimit(`plaid:exchange:${userId}`, [
        { limit: 8, windowMs: 5 * MINUTE },
      ]);
      if (!limit.ok) rateLimited(limit.retryAfterSec);
      const quota = await checkLinkQuota(userId);
      if (!quota.ok) rateLimited(undefined, quota.reason);

      const exchange = await plaid.itemPublicTokenExchange({
        public_token: publicToken,
      });
      const { access_token, item_id } = exchange.data;

      // itemId is globally unique; never let one user's exchange overwrite an
      // item row owned by someone else (the update branch doesn't set userId).
      const priorItem = await prisma.plaidItem.findUnique({
        where: { itemId: item_id },
      });
      if (priorItem && priorItem.userId !== userId) {
        badRequest("This bank is already linked to another account.");
      }

      const item = await prisma.plaidItem.upsert({
        where: { itemId: item_id },
        create: {
          userId,
          itemId: item_id,
          accessToken: encryptToken(access_token),
          institutionId: institution?.institutionId ?? null,
          institutionName: institution?.name ?? null,
        },
        update: {
          accessToken: encryptToken(access_token),
          status: "active",
          error: null,
        },
      });

      await recordLinkEvent(userId);
      // Best-effort initial sync — a failure is recovered by the webhook/cron.
      try {
        await syncItem(item);
      } catch (err) {
        console.error("initial plaid sync failed:", safePlaidErr(err));
      }
      return { ok: true, id: item_id };
    },
  }),
);

builder.mutationField("createPlaidUpdateLinkToken", (t) =>
  t.field({
    type: "String",
    args: { itemId: t.arg.id(), accountId: t.arg.id() },
    resolve: async (_root, { itemId, accountId }, ctx) => {
      const userId = requireUser(ctx);
      const limit = rateLimit(`plaid:update-token:${userId}`, [
        { limit: 15, windowMs: 5 * MINUTE },
      ]);
      if (!limit.ok) rateLimited(limit.retryAfterSec);

      const item = await resolveOwnedItem(userId, itemId, accountId);
      if (!item) notFound();

      const res = await plaid.linkTokenCreate({
        user: { client_user_id: userId },
        client_name: "otterfund",
        language: "en",
        country_codes: plaidCountryCodes(),
        access_token: decryptToken(item.accessToken),
        webhook: plaidWebhookUrl(),
      });
      return res.data.link_token;
    },
  }),
);

builder.mutationField("unlinkPlaidItem", (t) =>
  t.field({
    type: MutationResultRef,
    args: { itemId: t.arg.id(), accountId: t.arg.id() },
    resolve: async (_root, { itemId, accountId }, ctx) => {
      const userId = requireUser(ctx);
      const limit = rateLimit(`plaid:unlink:${userId}`, [
        { limit: 20, windowMs: HOUR },
      ]);
      if (!limit.ok) rateLimited(limit.retryAfterSec);

      const item = await resolveOwnedItem(userId, itemId, accountId);
      if (!item) notFound();

      try {
        await plaid.itemRemove({ access_token: decryptToken(item.accessToken) });
      } catch (err) {
        // Even if Plaid rejects (already removed), still clean up locally.
        console.error("plaid itemRemove failed:", safePlaidErr(err));
      }
      await prisma.plaidItem.delete({ where: { id: item.id } });
      return { ok: true, id: item.itemId };
    },
  }),
);

builder.mutationField("syncPlaid", (t) =>
  t.field({
    type: "JSON",
    args: { itemId: t.arg.id() },
    resolve: async (_root, { itemId }, ctx) => {
      // Cron mode — the shared-secret context syncs every active Item, no session.
      if (ctx.isCron) {
        const results = await syncAllActiveItems();
        return { ok: true, count: results.length, results };
      }

      const userId = requireUser(ctx);
      const limit = rateLimit(`plaid:sync:${userId}`, [
        { limit: 1, windowMs: 15 * SECOND },
        { limit: 40, windowMs: HOUR },
      ]);
      if (!limit.ok) {
        rateLimited(limit.retryAfterSec, "You're syncing too often. Please wait a moment.");
      }

      const items = await prisma.plaidItem.findMany({
        where: itemId ? { userId, itemId } : { userId },
      });
      const results: Array<Record<string, unknown>> = [];
      for (const item of items) {
        try {
          results.push({ itemId: item.itemId, ...(await syncItem(item)) });
        } catch {
          results.push({ itemId: item.itemId, error: "sync_failed" });
        }
      }
      return { ok: true, results };
    },
  }),
);

// Resolve a PlaidItem the user owns, by itemId or by one of its accountIds.
async function resolveOwnedItem(
  userId: string,
  itemId?: string | null,
  accountId?: string | null,
) {
  if (itemId) {
    return prisma.plaidItem.findFirst({ where: { userId, itemId } });
  }
  if (accountId) {
    const acct = await prisma.account.findFirst({
      where: { id: accountId, userId },
    });
    if (acct?.plaidItemId) {
      return prisma.plaidItem.findFirst({
        where: { id: acct.plaidItemId, userId },
      });
    }
  }
  return null;
}
